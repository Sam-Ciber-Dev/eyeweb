"""
===========================================
Eye Web Backend — URL Checker Service
===========================================

Serviço para análise de segurança de URLs.
Integra:
- Supabase (cache de resultados)
- Google Safe Browsing (verificação de ameaças)
- Groq/Llama 3 (análise IA)

Arquitetura: Stale-While-Revalidate
- Retorna cache imediatamente (se existir)
- Re-verifica em background se cache antigo

Capacidade: ~10,000 verificações/dia (limite Google Safe Browsing)
"""

import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

import httpx
from supabase import create_client, Client

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ===========================================
# ENUMS E MODELOS
# ===========================================

class URLStatus(str, Enum):
    """Status de segurança do URL."""
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    MALICIOUS = "malicious"
    UNKNOWN = "unknown"
    ANALYZING = "analyzing"


# ===========================================
# SUPABASE CLIENT
# ===========================================

_supabase_client: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """Retorna cliente Supabase singleton."""
    global _supabase_client
    
    if _supabase_client is None:
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
            try:
                _supabase_client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_KEY
                )
                logger.info("✅ Supabase client initialized")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Supabase: {e}")
                return None
        else:
            logger.warning("⚠️ Supabase credentials not configured")
            return None
    
    return _supabase_client


# ===========================================
# HASH UTILITIES
# ===========================================

def hash_url(url: str) -> str:
    """Gera hash SHA-256 do URL normalizado."""
    normalized = url.lower().strip().rstrip('/')
    return hashlib.sha256(normalized.encode()).hexdigest()


def normalize_url(url: str) -> str:
    """Normaliza URL para consistencia, com validacao e sanitizacao."""
    import re
    from urllib.parse import urlparse, quote, unquote
    
    url = url.strip()
    
    # Bloquear protocolos perigosos
    dangerous = re.compile(r'^(javascript|data|vbscript|file|ftp|blob|about|chrome|moz-extension):', re.I)
    if dangerous.match(url):
        raise ValueError("Protocolo nao permitido")
    
    # Corrigir protocolos malformados (ht+ps, htps, htp, etc.)
    malformed = re.compile(r'^h[t+]+p[s+]*://', re.I)
    if malformed.match(url) and not re.match(r'^https?://', url, re.I):
        url = re.sub(r'^[^/]+//', 'https://', url)
    
    # Rejeitar esquemas desconhecidos
    if '://' in url and not re.match(r'^https?://', url, re.I):
        raise ValueError("Protocolo invalido")
    
    # Adicionar https se nao existir
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Decodificar e re-codificar para normalizar encoding (previne payloads com double-encoding)
    try:
        url = unquote(url)
    except Exception:
        pass
    
    # Validar a estrutura
    parsed = urlparse(url)
    if not parsed.hostname:
        raise ValueError("URL invalido: sem dominio")
    
    # Bloquear IPs privados/localhost
    hostname = parsed.hostname.lower()
    private_ip = re.compile(r'^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|0\.0\.0\.0|localhost|\[::1\]|::1)')
    if private_ip.match(hostname):
        raise ValueError("Enderecos locais/privados nao permitidos")
    
    # Remover fragmentos (nunca enviados ao servidor, podem esconder payloads)
    url = url.split('#')[0]
    
    return url.rstrip('/')


# ===========================================
# CACHE OPERATIONS (SUPABASE)
# ===========================================

async def get_cached_result(url_hash: str) -> Optional[dict]:
    """
    Busca resultado em cache no Supabase.
    
    Returns:
        Dict com resultado ou None se não existir.
    """
    supabase = get_supabase()
    if not supabase:
        return None
    
    try:
        response = supabase.table("url_scans").select("*").eq("url_hash", url_hash).execute()
        
        if response.data and len(response.data) > 0:
            logger.debug(f"✅ Cache hit for {url_hash[:8]}...")
            return response.data[0]
        
        logger.debug(f"❌ Cache miss for {url_hash[:8]}...")
        return None
        
    except Exception as e:
        logger.error(f"❌ Error fetching cache: {e}")
        return None


async def save_to_cache(
    url_hash: str,
    original_url: str,
    status: URLStatus,
    ai_opinion: Optional[str] = None,
    threat_details: Optional[dict] = None
) -> bool:
    """
    Guarda ou atualiza resultado no cache (UPSERT).
    """
    supabase = get_supabase()
    if not supabase:
        return False
    
    try:
        data = {
            "url_hash": url_hash,
            "original_url": original_url,
            "status": status.value,
            "ai_opinion": ai_opinion,
            "threat_details": threat_details or {},
            "last_check": datetime.now(timezone.utc).isoformat(),
        }
        
        # UPSERT: insere ou atualiza se já existir
        response = supabase.table("url_scans").upsert(
            data,
            on_conflict="url_hash"
        ).execute()
        
        logger.info(f"✅ Saved to cache: {url_hash[:8]}... = {status.value}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error saving to cache: {e}")
        return False


# ===========================================
# GOOGLE SAFE BROWSING
# ===========================================

async def check_google_safe_browsing(url: str) -> dict:
    """
    Verifica URL no Google Safe Browsing API.
    
    Returns:
        Dict com resultado da verificação.
    """
    if not settings.GOOGLE_SAFE_BROWSING_KEY:
        logger.warning("⚠️ Google Safe Browsing API key not configured")
        return {"checked": False, "error": "API key not configured"}
    
    api_url = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={settings.GOOGLE_SAFE_BROWSING_KEY}"
    
    payload = {
        "client": {
            "clientId": "eyeweb-url-checker",
            "clientVersion": "1.0.0"
        },
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION"
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(api_url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            if "matches" in data and len(data["matches"]) > 0:
                threats = [match.get("threatType", "UNKNOWN") for match in data["matches"]]
                logger.warning(f"⚠️ Google Safe Browsing found threats: {threats}")
                return {
                    "checked": True,
                    "is_threat": True,
                    "threats": threats,
                    "source": "google_safe_browsing"
                }
            
            logger.debug("✅ Google Safe Browsing: No threats found")
            return {
                "checked": True,
                "is_threat": False,
                "source": "google_safe_browsing"
            }
            
    except httpx.TimeoutException:
        logger.error("❌ Google Safe Browsing timeout")
        return {"checked": False, "error": "timeout"}
    except Exception as e:
        logger.error(f"❌ Google Safe Browsing error: {e}")
        return {"checked": False, "error": str(e)}


# ===========================================
# URLSCAN.IO (DESATIVADO)
# ===========================================
# Removido para aumentar capacidade de 100 → 10,000 verificações/dia
# A API gratuita do URLScan.io tinha limite de apenas 100 scans/dia
# Se precisares no futuro, basta descomentar esta função
#
# async def check_urlscan(url: str) -> dict:
#     """Verifica URL no URLScan.io API (100 scans/dia)."""
#     if not settings.URLSCAN_API_KEY:
#         return {"checked": False, "error": "API key not configured"}
#     
#     api_url = "https://urlscan.io/api/v1/scan/"
#     headers = {"API-Key": settings.URLSCAN_API_KEY, "Content-Type": "application/json"}
#     payload = {"url": url, "visibility": "unlisted"}
#     
#     async with httpx.AsyncClient(timeout=15.0) as client:
#         response = await client.post(api_url, json=payload, headers=headers)
#         if response.status_code == 429:
#             return {"checked": False, "error": "rate_limit"}
#         response.raise_for_status()
#         data = response.json()
#         return {"checked": True, "scan_uuid": data.get("uuid"), "result_url": data.get("result")}


# ===========================================
# SSL/TLS VERIFICATION
# ===========================================

import ssl
import socket
from urllib.parse import urlparse

async def check_ssl(url: str) -> dict:
    """
    Verifica o certificado SSL/TLS do URL.
    
    Verifica:
    - Se usa HTTPS
    - Se certificado é válido
    - Se não está expirado
    - Informações do certificado
    
    Returns:
        Dict com resultado da verificação SSL.
    """
    parsed = urlparse(url)
    hostname = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    
    # Se não é HTTPS, já é suspeito
    if parsed.scheme != 'https':
        logger.warning(f"⚠️ URL não usa HTTPS: {url}")
        return {
            "checked": True,
            "has_ssl": False,
            "status": "suspicious",
            "reason": "Site não usa HTTPS",
            "source": "ssl_checker"
        }
    
    try:
        # Criar contexto SSL
        context = ssl.create_default_context()
        
        # Conectar ao servidor
        loop = asyncio.get_event_loop()
        
        def get_cert():
            with socket.create_connection((hostname, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    return cert
        
        cert = await loop.run_in_executor(None, get_cert)
        
        if not cert:
            return {
                "checked": True,
                "has_ssl": False,
                "status": "suspicious",
                "reason": "Não foi possível obter certificado",
                "source": "ssl_checker"
            }
        
        # Extrair informações do certificado
        issuer = dict(x[0] for x in cert.get('issuer', []))
        subject = dict(x[0] for x in cert.get('subject', []))
        not_after = cert.get('notAfter', '')
        
        # Verificar se expirou
        from datetime import datetime
        try:
            expiry_date = datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z')
            is_expired = expiry_date < datetime.now()
        except:
            is_expired = False
        
        if is_expired:
            logger.warning(f"⚠️ Certificado SSL expirado: {url}")
            return {
                "checked": True,
                "has_ssl": True,
                "status": "suspicious",
                "reason": "Certificado SSL expirado",
                "issuer": issuer.get('organizationName', 'Desconhecido'),
                "expiry": not_after,
                "source": "ssl_checker"
            }
        
        # Certificado válido
        logger.info(f"✅ SSL válido para {hostname}")
        return {
            "checked": True,
            "has_ssl": True,
            "status": "safe",
            "issuer": issuer.get('organizationName', issuer.get('commonName', 'Desconhecido')),
            "subject": subject.get('commonName', hostname),
            "expiry": not_after,
            "source": "ssl_checker"
        }
        
    except ssl.SSLCertVerificationError as e:
        logger.warning(f"⚠️ Certificado SSL inválido: {e}")
        return {
            "checked": True,
            "has_ssl": True,
            "status": "suspicious",
            "reason": "Certificado SSL inválido ou não confiável",
            "error": str(e),
            "source": "ssl_checker"
        }
    except socket.timeout:
        logger.error(f"❌ Timeout ao verificar SSL")
        return {
            "checked": False,
            "status": "unknown",
            "error": "timeout",
            "source": "ssl_checker"
        }
    except Exception as e:
        logger.error(f"❌ Erro ao verificar SSL: {e}")
        return {
            "checked": False,
            "status": "unknown",
            "error": str(e),
            "source": "ssl_checker"
        }


# ===========================================
# GROQ AI ANALYSIS
# ===========================================

async def get_ai_opinion(url: str, scan_results: dict) -> Optional[str]:
    """
    Obtém opinião da IA (Groq/Llama 3) sobre o URL.
    
    Returns:
        String com a opinião da IA ou None se falhar.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("⚠️ Groq API key not configured")
        return None
    
    api_url = "https://api.groq.com/openai/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Construir prompt com contexto dos scans
    google_result = scan_results.get("google_safe_browsing", {})
    ssl_result = scan_results.get("ssl_check", {})
    
    # Construir descrição do SSL
    ssl_desc = "Não verificado"
    if ssl_result.get("checked"):
        if not ssl_result.get("has_ssl"):
            ssl_desc = "⚠️ Site não usa HTTPS"
        elif ssl_result.get("status") == "malicious":
            ssl_desc = "❌ Certificado inválido ou não confiável"
        elif ssl_result.get("status") == "suspicious":
            ssl_desc = f"⚠️ {ssl_result.get('reason', 'Problema com certificado')}"
        else:
            ssl_desc = f"✅ Válido (emitido por {ssl_result.get('issuer', 'desconhecido')})"
    
    prompt = f"""URL: {url}

Resultados:
- Google Safe Browsing: {"AMEAÇA DETECTADA: " + str(google_result.get("threats")) if google_result.get("is_threat") else "OK" if google_result.get("checked") else "Não verificado"}
- SSL: {ssl_desc}

Classificação:
- Google SB detectou ameaça → diz "O URL é PERIGOSO porque..."
- SSL com problemas (mas Google OK) → diz "O URL é SUSPEITO porque..."
- Ambos OK → diz "O URL é SEGURO porque..."

Responde DIRETAMENTE com "O URL é [SEGURO/SUSPEITO/PERIGOSO] porque..." em Português de Portugal (máximo 2 frases)."""

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "És um especialista em cibersegurança. Analisa URLs e dá pareceres concisos sobre a sua segurança. Responde sempre em Português de Portugal."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 200,
        "temperature": 0.3
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            opinion = data["choices"][0]["message"]["content"].strip()
            
            logger.info(f"✅ AI opinion generated for {url[:30]}...")
            return opinion
            
    except httpx.TimeoutException:
        logger.error("❌ Groq API timeout")
        return None
    except Exception as e:
        logger.error(f"❌ Groq API error: {e}")
        return None


# ===========================================
# MAIN CHECK FUNCTION
# ===========================================

async def check_url(url: str, force_recheck: bool = False) -> dict:
    """
    Verifica segurança de um URL.
    
    Arquitetura Stale-While-Revalidate:
    1. Se existe em cache e é recente → retorna imediatamente
    2. Se existe em cache mas é antigo → retorna e re-verifica em background
    3. Se não existe → verifica e guarda em cache
    
    Args:
        url: URL a verificar
        force_recheck: Forçar nova verificação ignorando cache
    
    Returns:
        Dict com resultado da análise.
    """
    # Normalizar URL
    url = normalize_url(url)
    url_hash = hash_url(url)
    
    logger.info(f"🔍 Checking URL: {url[:50]}... (hash: {url_hash[:8]}...)")
    
    # 1. Verificar cache (se não forçar recheck)
    if not force_recheck:
        cached = await get_cached_result(url_hash)
        
        if cached:
            last_check = datetime.fromisoformat(cached["last_check"].replace("Z", "+00:00"))
            age_seconds = (datetime.now(timezone.utc) - last_check).total_seconds()
            
            # Cache fresco (< 1 hora) → retorna direto
            if age_seconds < settings.URL_CACHE_FRESH_SECONDS:
                logger.info(f"✅ Fresh cache hit ({age_seconds:.0f}s old)")
                return {
                    "url": url,
                    "url_hash": url_hash,
                    "status": cached["status"],
                    "ai_opinion": cached.get("ai_opinion"),
                    "threat_details": cached.get("threat_details", {}),
                    "last_check": cached["last_check"],
                    "from_cache": True,
                    "cache_age_seconds": int(age_seconds)
                }
            
            # Cache antigo (> 1 hora mas < 24 horas) → retorna e agenda recheck
            elif age_seconds < settings.URL_CACHE_TTL_SECONDS:
                logger.info(f"⚡ Stale cache hit ({age_seconds:.0f}s old), triggering background recheck")
                
                # Agendar recheck em background (não bloqueia)
                asyncio.create_task(_background_recheck(url, url_hash))
                
                return {
                    "url": url,
                    "url_hash": url_hash,
                    "status": cached["status"],
                    "ai_opinion": cached.get("ai_opinion"),
                    "threat_details": cached.get("threat_details", {}),
                    "last_check": cached["last_check"],
                    "from_cache": True,
                    "cache_age_seconds": int(age_seconds),
                    "recheck_triggered": True
                }
    
    # 2. Fazer verificação completa
    return await _perform_full_check(url, url_hash)


async def _perform_full_check(url: str, url_hash: str) -> dict:
    """Executa verificação completa do URL."""
    
    logger.info(f"🔄 Performing full check for {url[:50]}...")
    
    # Executar verificações em paralelo
    google_task = check_google_safe_browsing(url)
    ssl_task = check_ssl(url)
    
    google_result, ssl_result = await asyncio.gather(
        google_task,
        ssl_task,
        return_exceptions=True
    )
    
    # Tratar exceções
    if isinstance(google_result, Exception):
        logger.error(f"Google Safe Browsing exception: {google_result}")
        google_result = {"checked": False, "error": str(google_result)}
    
    if isinstance(ssl_result, Exception):
        logger.error(f"SSL check exception: {ssl_result}")
        ssl_result = {"checked": False, "status": "unknown", "error": str(ssl_result)}
    
    scan_results = {
        "google_safe_browsing": google_result,
        "ssl_check": ssl_result
    }
    
    # Determinar status baseado nos checkers:
    # - 1 diz Perigoso → Perigoso
    # - 1 diz Suspeito → Suspeito
    # - AMBOS Seguros → Seguro
    status = _determine_status(google_result, ssl_result)
    
    # Obter opinião da IA (apenas explica o que os checkers dizem)
    ai_opinion = await get_ai_opinion(url, scan_results)
    
    # Guardar em cache
    await save_to_cache(
        url_hash=url_hash,
        original_url=url,
        status=status,
        ai_opinion=ai_opinion,
        threat_details=scan_results
    )
    
    return {
        "url": url,
        "url_hash": url_hash,
        "status": status.value,
        "ai_opinion": ai_opinion,
        "threat_details": scan_results,
        "last_check": datetime.now(timezone.utc).isoformat(),
        "from_cache": False
    }


async def _background_recheck(url: str, url_hash: str):
    """Re-verifica URL em background (não bloqueia resposta)."""
    try:
        logger.info(f"🔄 Background recheck started for {url[:30]}...")
        await _perform_full_check(url, url_hash)
        logger.info(f"✅ Background recheck completed for {url[:30]}...")
    except Exception as e:
        logger.error(f"❌ Background recheck failed: {e}")


def _extract_ai_verdict(ai_opinion: str) -> URLStatus:
    """
    Extrai o veredito da IA a partir da sua opinião.
    A IA responde com SEGURO, SUSPEITO ou PERIGOSO no texto.
    """
    ai_lower = ai_opinion.lower()
    
    # Verificar palavras de PERIGOSO (prioridade máxima)
    danger_words = ['perigoso', 'malicioso', 'evitar', 'não aceder', 'não acessar', 'fraude confirmada', 'phishing confirmado']
    if any(word in ai_lower for word in danger_words):
        return URLStatus.MALICIOUS
    
    # Verificar palavras de SUSPEITO
    suspect_words = ['suspeito', 'cautela', 'cuidado', 'atenção', 'desconfiar', 'possível phishing', 'possível fraude']
    if any(word in ai_lower for word in suspect_words):
        # Mas verificar se não é negação (ex: "não é suspeito")
        negations = ['não é suspeito', 'não parece suspeito', 'sem sinais de', 'não há indícios', 'não apresenta', 'nenhum sinal']
        if any(neg in ai_lower for neg in negations):
            return URLStatus.SAFE
        return URLStatus.SUSPICIOUS
    
    # Verificar palavras de SEGURO
    safe_words = ['seguro', 'confiável', 'legítimo', 'legítima', 'oficial', 'verificado', 'autêntico']
    if any(word in ai_lower for word in safe_words):
        return URLStatus.SAFE
    
    # Se não conseguiu determinar, assume SAFE (não altera o status)
    return URLStatus.SAFE


def _determine_status(google_result: dict, ssl_result: dict) -> URLStatus:
    """
    Determina status final:
    - Google SB = Perigoso → URL: Perigoso
    - SSL = Suspeito (qualquer problema) → URL: Suspeito
    - Ambos OK → URL: Seguro
    """
    
    # Google SB detectou ameaça → PERIGOSO (sempre)
    if google_result.get("is_threat"):
        return URLStatus.MALICIOUS
    
    # SSL tem qualquer problema → SUSPEITO
    if ssl_result.get("status") == "suspicious":
        return URLStatus.SUSPICIOUS
    
    # Ambos OK → SEGURO
    if google_result.get("checked") and ssl_result.get("status") == "safe":
        return URLStatus.SAFE
    
    # Se apenas Google verificou e está OK → SEGURO
    if google_result.get("checked") and not google_result.get("is_threat"):
        return URLStatus.SAFE
    
    # Nenhum funcionou → UNKNOWN
    return URLStatus.UNKNOWN
