"""
===========================================
Eye Web Backend — Auth Service
===========================================
Serviço para verificação de login com código de 2 dígitos.
Usa Resend para envio de emails.
"""

import random
import string
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
import logging
import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def generate_verification_codes() -> Tuple[List[str], str]:
    """
    Gera 3 códigos únicos de 2 dígitos e retorna qual é o correto.
    
    Returns:
        Tuple contendo:
        - Lista de 3 códigos únicos
        - O código correto (um dos 3)
    """
    # Gerar 3 códigos únicos de 2 dígitos (10-99)
    codes = set()
    while len(codes) < 3:
        code = str(random.randint(10, 99))
        codes.add(code)
    
    codes_list = list(codes)
    random.shuffle(codes_list)  # Baralhar a ordem
    
    # Escolher um como o correto
    correct_code = random.choice(codes_list)
    
    return codes_list, correct_code


def generate_session_id() -> str:
    """Gera um ID de sessão único para esta verificação."""
    return secrets.token_urlsafe(32)


async def store_verification_code(
    email: str,
    session_id: str,
    correct_code: str,
    expires_minutes: int = 5
) -> bool:
    """
    Armazena o código de verificação no Supabase.
    
    Args:
        email: Email do utilizador
        session_id: ID da sessão de verificação
        correct_code: Código correto (2 dígitos)
        expires_minutes: Tempo de expiração em minutos
        
    Returns:
        True se armazenado com sucesso
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.error("Supabase não configurado")
        return False
    
    expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
    
    try:
        async with httpx.AsyncClient() as client:
            # Primeiro, remover códigos antigos para este email
            await client.delete(
                f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                params={"email": f"eq.{email}"}
            )
            
            # Inserir novo código
            response = await client.post(
                f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                json={
                    "email": email,
                    "session_id": session_id,
                    "correct_code": correct_code,
                    "expires_at": expires_at.isoformat(),
                    "attempts": 0
                }
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Código armazenado para {email[:3]}***")
                return True
            else:
                logger.error(f"Erro ao armazenar código: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Erro ao armazenar código: {e}")
        return False


async def verify_code(
    session_id: str,
    submitted_code: str
) -> Tuple[bool, str]:
    """
    Verifica se o código submetido está correto.
    
    Args:
        session_id: ID da sessão de verificação
        submitted_code: Código submetido pelo utilizador
        
    Returns:
        Tuple: (sucesso, mensagem)
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return False, "Serviço não configurado"
    
    try:
        async with httpx.AsyncClient() as client:
            # Buscar o código pelo session_id
            response = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                params={
                    "session_id": f"eq.{session_id}",
                    "select": "*"
                }
            )
            
            if response.status_code != 200:
                return False, "Erro ao verificar código"
            
            data = response.json()
            
            if not data:
                return False, "Sessão não encontrada ou expirada"
            
            record = data[0]
            
            # Verificar expiração
            expires_at = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
            if datetime.now(expires_at.tzinfo) > expires_at:
                # Apagar código expirado
                await client.delete(
                    f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    },
                    params={"session_id": f"eq.{session_id}"}
                )
                return False, "Código expirado. Por favor, tenta novamente."
            
            # Verificar tentativas
            attempts = record.get("attempts", 0)
            if attempts >= 3:
                # Apagar após muitas tentativas
                await client.delete(
                    f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    },
                    params={"session_id": f"eq.{session_id}"}
                )
                return False, "Demasiadas tentativas. Por favor, faz login novamente."
            
            # Verificar código
            if submitted_code == record["correct_code"]:
                # Código correto - apagar o registo
                await client.delete(
                    f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    },
                    params={"session_id": f"eq.{session_id}"}
                )
                return True, "Código verificado com sucesso"
            else:
                # Código errado - incrementar tentativas
                await client.patch(
                    f"{settings.SUPABASE_URL}/rest/v1/verification_codes",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json"
                    },
                    params={"session_id": f"eq.{session_id}"},
                    json={"attempts": attempts + 1}
                )
                remaining = 2 - attempts
                return False, f"Código incorreto. Tens mais {remaining} tentativa{'s' if remaining != 1 else ''}."
                
    except Exception as e:
        logger.error(f"Erro ao verificar código: {e}")
        return False, "Erro ao verificar código"


async def send_verification_email(email: str, code: str) -> bool:
    """
    Envia email com o código de verificação usando Resend.
    
    Args:
        email: Endereço de email do destinatário
        code: Código de verificação de 2 dígitos
        
    Returns:
        True se enviado com sucesso
    """
    logger.info(f"📧 Tentando enviar email para: {email[:3]}***@{email.split('@')[1]}")
    logger.info(f"📧 RESEND_API_KEY configurada: {'Sim' if settings.RESEND_API_KEY else 'Não'}")
    
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY não configurada")
        return False
    
    html_content = get_email_template(code)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": "Eye Web <onboarding@resend.dev>",  # Email padrão do Resend
                    "to": [email],
                    "subject": f"🔐 Eye Web Verification Code: {code}",
                    "html": html_content
                }
            )
            
            logger.info(f"📧 Resend response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                logger.info(f"✅ Email enviado com sucesso para {email[:3]}***")
                return True
            else:
                logger.error(f"❌ Erro Resend: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"❌ Erro ao enviar email: {e}")
        return False


def get_email_template(code: str) -> str:
    """
    Retorna o template HTML do email com o código.
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code - Eye Web</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 16px; border: 1px solid #222222; overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #222222;">
                                <div style="font-size: 32px; margin-bottom: 8px;">👁️</div>
                                <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #3b82f6;">Eye Web</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 32px;">
                                <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #ffffff; text-align: center;">
                                    Verification Code
                                </h2>
                                
                                <p style="margin: 0 0 24px; font-size: 15px; color: #888888; text-align: center; line-height: 1.5;">
                                    Use the code below to complete your login. This code expires in <strong style="color: #ffffff;">5 minutes</strong>.
                                </p>
                                
                                <!-- Code Box -->
                                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                                    <div style="font-size: 48px; font-weight: 800; color: #ffffff; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                                        {code}
                                    </div>
                                </div>
                                
                                <!-- Security Notice -->
                                <div style="background-color: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                                    <p style="margin: 0; font-size: 13px; color: #888888; text-align: center;">
                                        🔒 If you didn't request this code, please ignore this email.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 24px 32px; background-color: #0a0a0a; border-top: 1px solid #222222;">
                                <p style="margin: 0 0 8px; font-size: 12px; color: #666666; text-align: center;">
                                    EyeWeb: Let's keep an eye on each other.
                                </p>
                                <p style="margin: 0; font-size: 12px; text-align: center;">
                                    <a href="https://eyeweb.vercel.app" style="color: #ff0000; text-decoration: none;">Go to Eye Web</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_welcome_email_template(display_name: str) -> str:
    """
    Template HTML para email de boas-vindas.
    """
    name = display_name or "User"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Eye Web!</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 16px; border: 1px solid #222222; overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #222222;">
                                <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                                <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #3b82f6;">Welcome to Eye Web!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 32px;">
                                <p style="margin: 0 0 20px; font-size: 18px; color: #ffffff;">
                                    Hello <strong>{name}</strong>! 👋
                                </p>
                                
                                <p style="margin: 0 0 20px; font-size: 15px; color: #cccccc; line-height: 1.7;">
                                    Thank you for registering on <strong style="color: #3b82f6;">Eye Web</strong>! 
                                    Your online security is our priority.
                                </p>
                                
                                <div style="background-color: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                                    <h3 style="margin: 0 0 12px; font-size: 16px; color: #3b82f6;">What you can do:</h3>
                                    <ul style="margin: 0; padding: 0 0 0 20px; color: #cccccc; line-height: 1.8;">
                                        <li>🔍 <strong>Check emails</strong> — Find out if your data has been exposed</li>
                                        <li>🔐 <strong>Test passwords</strong> — Check if they are secure</li>
                                        <li>🌐 <strong>Analyze URLs</strong> — Detect malicious websites</li>
                                        <li>📱 <strong>Check phones</strong> — Confirm your number's security</li>
                                    </ul>
                                </div>
                                
                                <p style="margin: 0 0 20px; font-size: 15px; color: #888888; line-height: 1.7;">
                                    All data is verified using <strong style="color: #22c55e;">K-Anonymity</strong> — 
                                    we never send your complete information, only hash prefixes.
                                </p>
                                
                                <div style="text-align: center; margin-top: 24px;">
                                    <a href="https://eyeweb.vercel.app" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                                        Start using Eye Web
                                    </a>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 24px 32px; background-color: #0a0a0a; border-top: 1px solid #222222;">
                                <p style="margin: 0 0 8px; font-size: 13px; color: #666666; text-align: center;">
                                    EyeWeb: Let's keep an eye on each other.
                                </p>
                                <p style="margin: 0; font-size: 12px; text-align: center;">
                                    <a href="https://eyeweb.vercel.app" style="color: #ff0000; text-decoration: none;">Go to Eye Web</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
