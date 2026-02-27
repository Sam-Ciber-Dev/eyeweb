"""
===========================================
Eye Web Backend — Main Application
===========================================

API FastAPI para verificação de fugas de dados (breaches).

Execução local:
    uvicorn app.main:app --reload

Documentação:
    - Swagger UI: http://localhost:8000/docs
    - ReDoc: http://localhost:8000/redoc
"""

import logging
import time
import asyncio
import os
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import HealthResponse, ErrorResponse
from .routers import breach_router
from .routers.password_router import router as password_router
from .routers.url_router import router as url_router
from .routers.auth_router import router as auth_router
from .routers.admin_router import router as admin_router
from .routers.chat_router import router as chat_router
from .routers.user_chat_router import router as user_chat_router
from .routers.traffic_router import router as traffic_router, visit_router
from .services.breach_service import get_breach_service
from .services.traffic_service import TrafficService

# ===========================================
# CONFIGURAÇÃO
# ===========================================

settings = get_settings()

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


# ===========================================
# LIMPEZA DIARIA DE LOGS (meia-noite UTC)
# ===========================================

async def _daily_logs_cleanup():
    """
    Tarefa em background que:
    1. A cada meia-noite UTC apaga traffic_logs e traffic_suspicious do dia anterior
    2. No 1º dia do mês gera o relatório final do mês anterior
    3. No 1º dia de Janeiro gera o relatório anual do ano anterior
    """
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Calcular proxima meia-noite UTC
            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            wait_seconds = (tomorrow - now).total_seconds()
            logger.info(f"Limpeza de logs agendada para daqui a {wait_seconds:.0f}s (meia-noite UTC)")
            await asyncio.sleep(wait_seconds)
            
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            
            sb_url = os.getenv("SUPABASE_URL", "")
            sb_key = os.getenv("SUPABASE_SERVICE_KEY", "")
            if not sb_url or not sb_key:
                logger.warning("Supabase nao configurado, limpeza de logs ignorada")
                continue
            
            headers = {
                "apikey": sb_key,
                "Authorization": f"Bearer {sb_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            }
            upsert_headers = {
                "apikey": sb_key,
                "Authorization": f"Bearer {sb_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            }

            # ─── Gerar relatório mensal (no 1º dia do mês) ───
            if now.day == 1:
                try:
                    from .routers.traffic_router import (
                        _aggregate_period, _generate_markdown, MONTH_NAMES_PT,
                    )
                    # Mês anterior
                    first_of_this = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    last_month_end = first_of_this.strftime('%Y-%m-%dT%H:%M:%SZ')
                    if now.month == 1:
                        last_month_start_dt = first_of_this.replace(year=now.year - 1, month=12)
                    else:
                        last_month_start_dt = first_of_this.replace(month=now.month - 1)
                    last_month_start = last_month_start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
                    period = last_month_start_dt.strftime('%Y-%m')
                    month_name = MONTH_NAMES_PT[last_month_start_dt.month]
                    title = f"Relatório {month_name} {last_month_start_dt.year}"

                    data = await _aggregate_period(last_month_start, last_month_end)
                    if data:
                        md = _generate_markdown(title, period, data)
                        async with httpx.AsyncClient(timeout=15.0) as client:
                            await client.post(
                                f"{sb_url}/rest/v1/traffic_reports",
                                headers=upsert_headers,
                                json={"type": "monthly", "period": period, "title": title, "markdown": md, "data": data},
                            )
                        logger.info(f"Relatório mensal gerado: {period}")
                except Exception as e:
                    logger.error(f"Erro ao gerar relatório mensal: {e}")

            # ─── Gerar relatório anual (1 Janeiro) ───
            if now.month == 1 and now.day == 1:
                try:
                    from .routers.traffic_router import (
                        _aggregate_period, _generate_markdown,
                    )
                    last_year = now.year - 1
                    year_start = f"{last_year}-01-01T00:00:00Z"
                    year_end = f"{now.year}-01-01T00:00:00Z"
                    period_y = str(last_year)
                    title_y = f"Relatório Anual {last_year}"

                    data_y = await _aggregate_period(year_start, year_end)
                    if data_y:
                        md_y = _generate_markdown(title_y, period_y, data_y)
                        async with httpx.AsyncClient(timeout=15.0) as client:
                            await client.post(
                                f"{sb_url}/rest/v1/traffic_reports",
                                headers=upsert_headers,
                                json={"type": "yearly", "period": period_y, "title": title_y, "markdown": md_y, "data": data_y},
                            )
                        logger.info(f"Relatório anual gerado: {period_y}")

                    # Limpar relatórios mensais do ano passado (agora estão no anual)
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        await client.delete(
                            f"{sb_url}/rest/v1/traffic_reports?type=eq.monthly&period=like.{last_year}-*",
                            headers=headers,
                        )
                    logger.info(f"Relatórios mensais de {last_year} limpos")
                except Exception as e:
                    logger.error(f"Erro ao gerar relatório anual: {e}")

            # ─── Apagar logs do dia anterior ───
            async with httpx.AsyncClient(timeout=30.0) as client:
                r1 = await client.delete(
                    f"{sb_url}/rest/v1/traffic_logs?created_at=lt.{today_start}",
                    headers=headers,
                )
                r2 = await client.delete(
                    f"{sb_url}/rest/v1/traffic_suspicious?created_at=lt.{today_start}",
                    headers=headers,
                )
            
            logger.info(f"Limpeza de logs concluida: traffic_logs={r1.status_code}, traffic_suspicious={r2.status_code}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Erro na limpeza de logs: {e}")
            await asyncio.sleep(60)  # Retry em 1 min se falhar


# ===========================================
# LIFECYCLE (STARTUP/SHUTDOWN)
# ===========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação.
    
    - Startup: inicializa recursos
    - Shutdown: limpa recursos
    """
    # === STARTUP ===
    logger.info("="*50)
    logger.info("👁️  Eye Web API a iniciar...")
    logger.info("="*50)
    logger.info(f"Ambiente: {settings.ENVIRONMENT}")
    logger.info(f"Dataset: {settings.HF_DATASET_REPO}")
    logger.info(f"Cache: {settings.CACHE_MAX_SIZE} partições")
    
    # Pré-aquecer serviço (opcional)
    service = get_breach_service()
    
    # Inicializar monitor de tráfego
    ts = TrafficService.get()
    await ts.init()
    
    # Iniciar tarefa de limpeza diária
    cleanup_task = asyncio.create_task(_daily_logs_cleanup())
    
    logger.info("API pronta!")
    logger.info("="*50)
    
    yield  # Aplicação a correr
    
    # === SHUTDOWN ===
    logger.info("Eye Web API a encerrar...")
    
    # Cancelar tarefa de limpeza
    cleanup_task.cancel()
    
    # Fechar cliente HTTP do serviço
    await service.close()
    
    logger.info("✅ Recursos libertados. Até à próxima!")


# ===========================================
# CRIAÇÃO DA APLICAÇÃO
# ===========================================

app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)


# ===========================================
# MIDDLEWARES
# ===========================================

# CORS - permite requests do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware de tráfego (logging + defesa automática)
@app.middleware("http")
async def traffic_middleware(request: Request, call_next):
    """Intercepta requests para logging, deteção de ameaças e bloqueio de IPs."""
    # Obter IP real (Render/Vercel adicionam X-Forwarded-For)
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if not ip:
        ip = request.client.host if request.client else "unknown"

    path = request.url.path
    logger.info(f"📥 {request.method} {path} [{ip}]")

    # Verificar se IP está bloqueado
    ts = TrafficService.get()
    if ts.is_blocked(ip):
        logger.warning(f"🚫 IP bloqueado rejeitado: {ip}")
        return JSONResponse(
            status_code=403,
            content={"error": "Acesso bloqueado", "detail": "O teu IP foi bloqueado pelo sistema de defesa."}
        )

    start = time.time()
    response = await call_next(request)
    elapsed_ms = int((time.time() - start) * 1000)

    logger.info(f"📤 {request.method} {path} → {response.status_code} ({elapsed_ms}ms)")

    # Log de tráfego (fire-and-forget — não atrasa a resposta)
    if ts.should_log(path):
        asyncio.create_task(ts.safe_log_request(
            ip=ip, method=request.method, path=path,
            status_code=response.status_code,
            user_agent=request.headers.get("user-agent", ""),
            response_time_ms=elapsed_ms,
        ))

    return response


# ===========================================
# EXCEPTION HANDLERS
# ===========================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handler global para exceções não tratadas."""
    logger.error(f"Erro não tratado: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Erro interno do servidor",
            "detail": str(exc) if settings.DEBUG else None
        }
    )


# ===========================================
# ROUTERS
# ===========================================

# Incluir routers com prefixo da API
app.include_router(
    breach_router,
    prefix=settings.API_PREFIX
)

# Router de passwords (dataset separado)
app.include_router(
    password_router
)

# Router de URL Checker (novo!)
app.include_router(
    url_router,
    prefix=settings.API_PREFIX
)

# Router de Autenticação (verificação com código)
app.include_router(
    auth_router,
    prefix=settings.API_PREFIX
)

# Router de Admin (MFA TOTP)
app.include_router(
    admin_router,
    prefix="/api"
)

# Router de Chat Admin (mensagens + IA)
app.include_router(
    chat_router,
    prefix="/api"
)

# Router de Chat Público (EyeWeb Agent widget)
app.include_router(
    user_chat_router,
    prefix="/api"
)

# Router de Tráfego (Monitor de defesa)
app.include_router(
    traffic_router,
    prefix="/api"
)

# Router de Visitas (beacon do frontend para registar page views)
app.include_router(
    visit_router,
    prefix="/api"
)


# ===========================================
# ENDPOINTS RAIZ
# ===========================================

@app.get(
    "/",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health Check",
    description="Verifica se a API está a funcionar."
)
async def root() -> HealthResponse:
    """
    Endpoint raiz / health check.
    
    Retorna informações básicas sobre a API.
    """
    return HealthResponse(
        status="healthy",
        version=settings.API_VERSION,
        dataset_repo=settings.HF_DATASET_REPO
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health Check (alternativo)"
)
async def health() -> HealthResponse:
    """Alias para o endpoint raiz."""
    return await root()


# ===========================================
# ENDPOINT DE DEBUG (apenas desenvolvimento)
# ===========================================

if settings.DEBUG:
    @app.get("/debug/config", tags=["Debug"])
    async def debug_config():
        """
        Retorna configuração atual (apenas em modo debug).
        NUNCA expor em produção!
        """
        return {
            "environment": settings.ENVIRONMENT,
            "debug": settings.DEBUG,
            "hf_dataset_repo": settings.HF_DATASET_REPO,
            "cache_max_size": settings.CACHE_MAX_SIZE,
            "cache_ttl": settings.CACHE_TTL_SECONDS,
            "cors_origins": settings.CORS_ORIGINS
        }
