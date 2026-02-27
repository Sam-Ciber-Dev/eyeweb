"""
===========================================
Eye Web Backend — URL Checker Router
===========================================

Endpoints para verificação de segurança de URLs.

Endpoints:
    POST /api/v1/urls/check     → Verifica um URL
    GET  /api/v1/urls/status    → Estado de um URL (por hash)
    GET  /api/v1/urls/health    → Health check do serviço
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field, HttpUrl

from ..services.url_service import (
    check_url,
    get_cached_result,
    hash_url,
    normalize_url,
    URLStatus
)
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ===========================================
# ROUTER SETUP
# ===========================================

router = APIRouter(
    prefix="/urls",
    tags=["URL Checker"],
    responses={
        500: {"description": "Internal Server Error"}
    }
)


# ===========================================
# REQUEST/RESPONSE MODELS
# ===========================================

class URLCheckRequest(BaseModel):
    """Request para verificar um URL."""
    url: str = Field(
        ...,
        description="URL a verificar (ex: https://example.com)",
        min_length=5,
        max_length=2048,
        examples=["https://google.com", "https://suspicious-site.xyz"]
    )
    force_recheck: bool = Field(
        default=False,
        description="Forçar nova verificação ignorando cache"
    )
    lang: str = Field(
        default="pt",
        description="Idioma da resposta da IA: pt ou en"
    )


class URLCheckResponse(BaseModel):
    """Resposta da verificação de URL."""
    url: str = Field(..., description="URL verificado (normalizado)")
    url_hash: str = Field(..., description="Hash SHA-256 do URL")
    status: str = Field(..., description="Status de segurança: safe, suspicious, malicious, unknown, analyzing")
    ai_opinion: Optional[str] = Field(None, description="Opinião da IA sobre o URL")
    threat_details: Optional[dict] = Field(default_factory=dict, description="Detalhes das ameaças encontradas")
    last_check: str = Field(..., description="Data/hora da última verificação (ISO 8601)")
    from_cache: bool = Field(..., description="Se o resultado veio do cache")
    cache_age_seconds: Optional[int] = Field(None, description="Idade do cache em segundos")
    recheck_triggered: Optional[bool] = Field(None, description="Se foi agendada re-verificação em background")


class URLStatusResponse(BaseModel):
    """Resposta simplificada do status de um URL."""
    url_hash: str
    status: str
    last_check: Optional[str] = None
    exists: bool = Field(..., description="Se o URL existe no cache")


class URLHealthResponse(BaseModel):
    """Resposta do health check."""
    service: str = "url-checker"
    status: str = "healthy"
    supabase_connected: bool
    google_api_configured: bool
    urlscan_api_configured: bool
    groq_api_configured: bool


# ===========================================
# ENDPOINTS
# ===========================================

@router.post(
    "/check",
    response_model=URLCheckResponse,
    summary="Verificar URL",
    description="""
Verifica a segurança de um URL utilizando múltiplas fontes:
- **Google Safe Browsing**: Detecta malware, phishing, etc.
- **URLScan.io**: Scan detalhado do website
- **Groq AI (Llama 3)**: Análise inteligente e opinião

### Arquitetura Stale-While-Revalidate
1. Se o URL está em cache e é **recente** (< 1h) → retorna imediatamente
2. Se está em cache mas é **antigo** (1h-24h) → retorna + re-verifica em background
3. Se **não existe** no cache → verifica e guarda

### Exemplo de Uso
```bash
curl -X POST "http://localhost:8000/api/v1/urls/check" \\
     -H "Content-Type: application/json" \\
     -d '{"url": "https://google.com"}'
```
""",
    responses={
        200: {"description": "URL verificado com sucesso"},
        400: {"description": "URL inválido"},
        500: {"description": "Erro interno do servidor"}
    }
)
async def check_url_endpoint(request: URLCheckRequest):
    """
    Verifica a segurança de um URL.
    """
    try:
        # Validar URL basico
        url = request.url.strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL nao pode estar vazio")
        
        if len(url) > 2048:
            raise HTTPException(status_code=400, detail="URL demasiado longo (maximo 2048 caracteres)")
        
        # Sanitizar — normalize_url faz validacao completa e levanta ValueError se invalido
        try:
            url = normalize_url(url)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        
        logger.info(f"URL check request: {url[:50]}...")
        
        # Executar verificação
        result = await check_url(url, force_recheck=request.force_recheck, lang=request.lang)
        
        return URLCheckResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error checking URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao verificar URL: {str(e)}")


@router.get(
    "/status",
    response_model=URLStatusResponse,
    summary="Obter status de URL",
    description="""
Obtém o status de um URL pelo seu hash SHA-256.
Útil para verificar se um URL já foi analisado sem trigger nova verificação.

### Parâmetros
- `url`: URL original (será calculado o hash)
- `hash`: Hash SHA-256 do URL (alternativa ao url)

Deve fornecer `url` OU `hash`, não ambos.
"""
)
async def get_url_status(
    url: Optional[str] = Query(None, description="URL original"),
    hash: Optional[str] = Query(None, description="Hash SHA-256 do URL", alias="hash")
):
    """
    Obtém o status de um URL do cache.
    """
    if not url and not hash:
        raise HTTPException(status_code=400, detail="Deve fornecer 'url' ou 'hash'")
    
    if url and hash:
        raise HTTPException(status_code=400, detail="Forneça apenas 'url' ou 'hash', não ambos")
    
    # Calcular hash se fornecido URL
    if url:
        url = normalize_url(url)
        url_hash = hash_url(url)
    else:
        url_hash = hash
    
    # Buscar no cache
    cached = await get_cached_result(url_hash)
    
    if cached:
        return URLStatusResponse(
            url_hash=url_hash,
            status=cached["status"],
            last_check=cached.get("last_check"),
            exists=True
        )
    
    return URLStatusResponse(
        url_hash=url_hash,
        status=URLStatus.UNKNOWN.value,
        exists=False
    )


@router.get(
    "/health",
    response_model=URLHealthResponse,
    summary="Health Check",
    description="Verifica o estado do serviço URL Checker e suas dependências."
)
async def url_checker_health():
    """
    Health check do serviço URL Checker.
    """
    return URLHealthResponse(
        supabase_connected=bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY),
        google_api_configured=bool(settings.GOOGLE_SAFE_BROWSING_KEY),
        urlscan_api_configured=bool(settings.URLSCAN_API_KEY),
        groq_api_configured=bool(settings.GROQ_API_KEY)
    )
