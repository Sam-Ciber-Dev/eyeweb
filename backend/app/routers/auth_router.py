"""
===========================================
Eye Web Backend — Auth Router
===========================================
Endpoints para verificação de login com código
e cleanup de utilizadores Google incompletos.
"""

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from ..services.auth_service import (
    generate_verification_codes,
    generate_session_id,
    store_verification_code,
    verify_code,
    send_verification_email,
    send_welcome_email,
)
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


# ===========================================
# MODELOS
# ===========================================

class SendCodeRequest(BaseModel):
    email: EmailStr


class SendCodeResponse(BaseModel):
    success: bool
    codes: List[str]
    session_id: str
    expires_in: int  # segundos
    message: str
    dev_hint: Optional[str] = None  # Apenas para dev quando email não é enviado


class VerifyCodeRequest(BaseModel):
    session_id: str
    code: str
    email: EmailStr


class VerifyCodeResponse(BaseModel):
    success: bool
    message: str


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/send-code", response_model=SendCodeResponse)
async def send_verification_code(request: SendCodeRequest):
    """
    Gera e envia código de verificação para o email.
    
    Retorna 3 códigos, sendo 1 o correto (enviado por email).
    O utilizador deve clicar no código correto para completar o login.
    """
    email = request.email.lower().strip()
    
    # Gerar códigos
    codes, correct_code = generate_verification_codes()
    session_id = generate_session_id()
    
    # Armazenar no Supabase
    stored = await store_verification_code(email, session_id, correct_code)
    
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao gerar código de verificação. Tenta novamente."
        )
    
    # Enviar email com Resend
    email_sent = await send_verification_email(email, correct_code)
    
    # Se o email não foi enviado, incluir dica para desenvolvimento
    dev_hint = None
    if not email_sent:
        if settings.DEBUG or settings.ENVIRONMENT == "development":
            dev_hint = f"[DEV] O código correto é: {correct_code}"
        else:
            # Em produção, ainda retornamos os códigos mas avisamos
            dev_hint = "Email não enviado - verifique configuração Resend"
    
    return SendCodeResponse(
        success=True,
        codes=codes,
        session_id=session_id,
        expires_in=300,  # 5 minutos
        message="Código enviado para o teu email!" if email_sent else "Código gerado (email não configurado)",
        dev_hint=dev_hint
    )


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_verification_code(request: VerifyCodeRequest):
    """
    Verifica se o código submetido está correto.
    
    Se correto, o frontend pode prosseguir com o login real no Supabase.
    """
    success, message = await verify_code(request.session_id, request.code)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    return VerifyCodeResponse(
        success=True,
        message=message
    )


# ===========================================
# REGISTO DE UTILIZADOR VIA GOOGLE (email já verificado)
# ===========================================

class RegisterGoogleUserRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class RegisterGoogleUserResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None


@router.post("/register-google-user", response_model=RegisterGoogleUserResponse)
async def register_google_user(request: RegisterGoogleUserRequest):
    """
    Cria um utilizador com email já confirmado (veio do Google OAuth).
    
    Como o Google já verificou o email, não precisamos de enviar
    código de verificação. Usa a Admin API do Supabase com service_role.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured"
        )
    
    # Validações básicas
    if len(request.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password deve ter pelo menos 8 caracteres"
        )
    
    if len(request.display_name.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome deve ter pelo menos 2 caracteres"
        )
    
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Verificar se o email já existe (via profiles ou auth)
        check_resp = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/profiles?email=eq.{request.email}&select=id",
            headers=headers,
        )
        if check_resp.status_code == 200 and check_resp.json():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este email já tem uma conta registada"
            )
        
        # 2. Criar utilizador com email confirmado via Admin API
        create_resp = await client.post(
            f"{settings.SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            json={
                "email": request.email,
                "password": request.password,
                "email_confirm": True,  # Email já verificado pelo Google
                "user_metadata": {
                    "display_name": request.display_name.strip(),
                    "has_password": True,
                },
            },
        )
        
        if create_resp.status_code not in (200, 201):
            error_detail = create_resp.text
            # Se o email já existe no auth.users
            if "already been registered" in error_detail or "already exists" in error_detail:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este email já tem uma conta registada"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao criar utilizador: {error_detail}"
            )
        
        user_data = create_resp.json()
        user_id = user_data.get("id")
        
        # 3. Criar perfil na tabela profiles
        #    Usar UPSERT (on_conflict=id) para evitar erros de duplicação
        #    e Prefer: resolution=merge-duplicates para PostgREST
        profile_resp = await client.post(
            f"{settings.SUPABASE_URL}/rest/v1/profiles",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal,resolution=merge-duplicates",
            },
            json={
                "id": user_id,
                "email": request.email,
                "display_name": request.display_name.strip(),
                "role": "user",
                "is_subscribed": False,
            },
        )
        
        if profile_resp.status_code not in (200, 201, 204):
            error_text = profile_resp.text
            print(f"[register-google-user] Profile creation failed: {profile_resp.status_code} - {error_text}")
            # Cleanup: apagar user se profile falhou
            await client.delete(
                f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=headers,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao criar perfil: {profile_resp.status_code} - {error_text}"
            )
        
        # Enviar email de boas-vindas (não crítico)
        try:
            await send_welcome_email(request.email, request.display_name.strip())
        except Exception as e:
            logger.warning(f"Welcome email falhou (não crítico): {e}")
        
        return RegisterGoogleUserResponse(
            success=True,
            message="Conta criada com sucesso",
            user_id=user_id,
        )


# ===========================================
# CLEANUP DE UTILIZADORES GOOGLE INCOMPLETOS
# ===========================================

class CleanupGoogleUserRequest(BaseModel):
    user_id: str


class CleanupGoogleUserResponse(BaseModel):
    success: bool
    message: str


@router.post("/cleanup-google-user", response_model=CleanupGoogleUserResponse)
async def cleanup_google_user(request: CleanupGoogleUserRequest):
    """
    Apaga um utilizador do Supabase auth.users que foi criado
    automaticamente pelo Google OAuth mas nunca completou o signup.
    
    Só apaga se:
    - O utilizador existe
    - O provider é 'google'
    - NÃO tem has_password nos user_metadata (não completou signup)
    - NÃO tem perfil na tabela profiles
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured"
        )
    
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Buscar o utilizador pelo ID
        user_resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/admin/users/{request.user_id}",
            headers=headers,
        )
        
        if user_resp.status_code != 200:
            return CleanupGoogleUserResponse(
                success=False,
                message="Utilizador não encontrado"
            )
        
        user_data = user_resp.json()
        
        # 2. Verificar se é Google-only e NÃO completou signup
        provider = user_data.get("app_metadata", {}).get("provider", "")
        has_password = user_data.get("user_metadata", {}).get("has_password", False)
        
        if provider != "google":
            return CleanupGoogleUserResponse(
                success=False,
                message="Não é um utilizador Google"
            )
        
        if has_password:
            return CleanupGoogleUserResponse(
                success=False,
                message="Utilizador já completou o signup"
            )
        
        # 3. Verificar se tem perfil (não apagar se já tiver)
        profile_resp = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{request.user_id}&select=id",
            headers={
                **headers,
                "Prefer": "return=representation",
            },
        )
        
        if profile_resp.status_code == 200:
            profiles = profile_resp.json()
            if profiles and len(profiles) > 0:
                # Tem perfil — apagar o perfil também (foi criado por engano)
                await client.delete(
                    f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{request.user_id}",
                    headers=headers,
                )
        
        # 4. Apagar o utilizador do auth.users
        delete_resp = await client.delete(
            f"{settings.SUPABASE_URL}/auth/v1/admin/users/{request.user_id}",
            headers=headers,
        )
        
        if delete_resp.status_code in (200, 204):
            return CleanupGoogleUserResponse(
                success=True,
                message="Utilizador Google incompleto apagado"
            )
        
        return CleanupGoogleUserResponse(
            success=False,
            message=f"Erro ao apagar utilizador: {delete_resp.status_code}"
        )
