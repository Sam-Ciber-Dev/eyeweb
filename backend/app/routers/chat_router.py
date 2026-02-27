"""
===========================================
Eye Web Backend — Admin Chat Router
===========================================
Endpoints para o chat entre administradores com IA integrada.
Usa Groq (Llama 3.3) para respostas de IA.
Mensagens guardadas no Supabase (admin_chat_messages).
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import time
import json
import httpx
from pathlib import Path

from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

from ..config import get_settings

router = APIRouter(prefix="/admin/chat", tags=["admin-chat"])
settings = get_settings()


# ===========================================
# SUPABASE CLIENT
# ===========================================

def get_supabase_client():
    """Retorna cliente Supabase configurado."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase nao configurado."
        )
    return create_client(url, key)


# ===========================================
# MODELOS
# ===========================================

class ChatMessage(BaseModel):
    id: Optional[str] = None
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    message: str
    message_type: str = "text"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    created_at: Optional[str] = None


class AIRequest(BaseModel):
    message: str
    sender_name: str
    context: Optional[List[Dict[str, Any]]] = None
    image_urls: Optional[List[str]] = None
    file_contents: Optional[List[Dict[str, str]]] = None  # [{"name": "file.txt", "content": "..."}]
    intentional_services: Optional[List[str]] = None  # Servicos marcados como propositadamente offline


class AIResponse(BaseModel):
    response: str
    model: str


class EditMessageRequest(BaseModel):
    message: str


class ChatHistoryResponse(BaseModel):
    messages: List[Dict[str, Any]]
    total: int


# ===========================================
# CONFIGURACAO IA
# ===========================================

def build_system_prompt(sender_name: str, health_summary: str = "", has_images: bool = False, has_files: bool = False, traffic_summary: str = "") -> str:
    """Construir prompt de sistema dinamico com contexto do sender e estado dos servicos."""
    
    health_section = ""
    if health_summary:
        health_section = f"""\n\n=== ESTADO ATUAL DOS SERVICOS ===\n{health_summary}\n=== FIM DO ESTADO ===\n\nQuando te perguntarem sobre o estado dos servicos, usa esta informacao para dar uma resposta precisa e detalhada.\nSe um servico estiver marcado como PROPOSITADO, significa que o admin decidiu que e normal estar offline/degradado — nao alertes nem sugiras correcao para esses.\nSe algum servico estiver offline ou degradado e NAO estiver marcado como propositado, alerta o admin e sugere que verifiquem.\n"""
    
    traffic_section = ""
    if traffic_summary:
        traffic_section = f"""\n\n=== MONITOR DE TRAFEGO ===\n{traffic_summary}\n=== FIM DO TRAFEGO ===\n\nQuando te perguntarem sobre trafego, IPs, ataques ou atividade suspeita, usa esta informacao.\nSe houver IPs suspeitos ou bloqueados, informa o admin com detalhes.\n"""
    
    # Capacidades de visao e ficheiros
    vision_section = ""
    if has_images:
        vision_section = """\n\nIMPORTANTE - CAPACIDADE DE VISAO:
Tu TENS capacidade de ver e analisar imagens. Consegues ver as imagens que os admins te enviam.
Quando receberes uma imagem, descreve o que ves com detalhe.
NUNCA digas que nao consegues ver imagens - tu CONSEGUES.
Analisa a imagem e responde com base no que observas nela.\n"""
    
    files_section = ""
    if has_files:
        files_section = """\n\nIMPORTANTE - LEITURA DE FICHEIROS:
O conteudo dos ficheiros enviados esta incluido na mensagem do utilizador entre marcadores === Conteudo do ficheiro ===.
Tu CONSEGUES ler e analisar o conteudo desses ficheiros.
Quando te pedirem para mostrar o codigo ou conteudo, mostra-o diretamente na tua resposta.
NUNCA digas que nao consegues aceder a ficheiros - o conteudo JA esta na mensagem.\n"""
    
    return f"""Tu es a Eye, a assistente de IA do Eye Web, uma plataforma de ciberseguranca.
Falas portugues de Portugal (nao brasileiro).
Es inteligente, profissional mas com personalidade amigavel.
Estas a falar com: {sender_name}

Ajudas os administradores do Eye Web com:
- Informacoes sobre o estado do site e servicos
- Recomendacoes de seguranca
- Analise de ameacas e vulnerabilidades
- Sugestoes de melhorias para o projeto
- Duvidas tecnicas sobre ciberseguranca, programacao, redes
- Analise de imagens e ficheiros enviados pelos admins
- Qualquer outra questao que os admins tenham

Regras:
- Responde sempre em portugues de Portugal
- Se nao sabes algo, diz honestamente
- Usa formatacao simples (sem markdown excessivo)
- Trata os admins pelo nome quando possivel (estas a falar com {sender_name})
- Os admins da equipa sao: Samuka, Okscuna, e Vanina Kollen
- Es parte da equipa Eye Web
- Quando te perguntarem sobre o estado dos servicos, se tiveres dados abaixo, usa-os para responder com precisao
- Se te perguntarem sobre trafego, IPs, ataques ou atividade suspeita, se tiveres dados de trafego abaixo, usa-os para responder com precisao
- Se receberes imagens, analisa-as e descreve o que ves
- Se receberes conteudo de ficheiros na mensagem, analisa-o e responde sobre ele
- NUNCA digas que nao consegues ver imagens ou ler ficheiros quando os recebes
{vision_section}{files_section}{health_section}{traffic_section}"""


async def fetch_health_summary(intentional_services: Optional[List[str]] = None) -> str:
    """Obter resumo do estado dos servicos para contexto da IA."""
    intentional_set = set(intentional_services) if intentional_services else set()
    try:
        from .admin_router import health_check
        result = await health_check()
        
        lines = [f"Estado geral: {result.overall_status}"]
        lines.append(f"Timestamp: {result.timestamp}")
        lines.append(f"Resumo: online={result.summary.get('online', 0)}, offline={result.summary.get('offline', 0)}, degradado={result.summary.get('degraded', 0)}")
        lines.append("")
        
        for service in result.services:
            status_label = {
                "online": "OK",
                "offline": "OFFLINE",
                "degraded": "DEGRADADO",
                "unknown": "DESCONHECIDO"
            }.get(service.status, service.status)
            
            line = f"- {service.name}: {status_label}"
            if service.response_time_ms is not None:
                line += f" ({service.response_time_ms}ms)"
            if service.message:
                line += f" - {service.message}"
            if service.name in intentional_set and service.status in ("offline", "degraded"):
                line += " [PROPOSITADO pelo admin]"
            lines.append(line)
        
        return "\n".join(lines)
    except Exception as e:
        return f"Nao foi possivel obter o estado dos servicos: {str(e)}"


async def fetch_traffic_summary() -> str:
    """Obter resumo do trafego para contexto da IA."""
    try:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            return "Supabase nao configurado para trafego."
        
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        count_headers = {**headers, "Prefer": "count=exact", "Range": "0-0"}
        
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        from ..services.traffic_service import TrafficService
        ts = TrafficService.get()
        
        lines = []
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Stats
            r1 = await client.get(
                f"{url}/rest/v1/traffic_logs?select=id&created_at=gte.{today_start}&ip=not.in.(127.0.0.1,::1,localhost)",
                headers=count_headers,
            )
            requests_today = 0
            if r1.status_code == 200:
                cr = r1.headers.get("content-range", "*/0")
                total = cr.split("/")[-1]
                requests_today = int(total) if total not in ("*", "") else 0
            
            online_count = ts.online_count()
            
            lines.append(f"Requests hoje: {requests_today}")
            lines.append(f"Dispositivos online agora: {online_count}")
            
            # Blocked
            r_blocked_ips = await client.get(
                f"{url}/rest/v1/traffic_blocked_ips?select=id",
                headers=count_headers,
            )
            r_blocked_devs = await client.get(
                f"{url}/rest/v1/traffic_blocked_devices?select=id",
                headers=count_headers,
            )
            blocked_ips = 0
            blocked_devs = 0
            if r_blocked_ips.status_code == 200:
                cr = r_blocked_ips.headers.get("content-range", "*/0")
                blocked_ips = int(cr.split("/")[-1]) if cr.split("/")[-1] not in ("*", "") else 0
            if r_blocked_devs.status_code == 200:
                cr = r_blocked_devs.headers.get("content-range", "*/0")
                blocked_devs = int(cr.split("/")[-1]) if cr.split("/")[-1] not in ("*", "") else 0
            lines.append(f"Total bloqueados: {blocked_ips} IPs + {blocked_devs} dispositivos")
            
            # Recent suspicious events (last 10)
            r_sus = await client.get(
                f"{url}/rest/v1/traffic_suspicious?select=ip,event,severity,path,country,city,created_at&order=created_at.desc&limit=10&created_at=gte.{today_start}",
                headers=headers,
            )
            if r_sus.status_code == 200:
                events = r_sus.json()
                if events:
                    lines.append(f"\nEventos suspeitos hoje: {len(events)} (ultimos)")
                    for ev in events:
                        ts_str = ev.get("created_at", "")[:19].replace("T", " ")
                        lines.append(f"  - [{ev.get('severity','?')}] {ev.get('event','')} | IP: {ev.get('ip','')} | {ev.get('country','')}/{ev.get('city','')} | {ts_str}")
                        if ev.get("path"):
                            lines.append(f"    Path: {ev['path']}")
                else:
                    lines.append("Eventos suspeitos hoje: 0")
            
            # Recent blocked IPs (last 5)
            r_blocked_list = await client.get(
                f"{url}/rest/v1/traffic_blocked_ips?select=ip,reason,blocked_at&order=blocked_at.desc&limit=5",
                headers=headers,
            )
            if r_blocked_list.status_code == 200:
                blocked_list = r_blocked_list.json()
                if blocked_list:
                    lines.append(f"\nUltimos IPs bloqueados:")
                    for b in blocked_list:
                        lines.append(f"  - {b.get('ip','')} | Motivo: {b.get('reason','')} | {b.get('blocked_at','')[:19]}")
        
        return "\n".join(lines)
    except Exception as e:
        return f"Nao foi possivel obter dados de trafego: {str(e)}"


# ===========================================
# ENDPOINTS
# ===========================================

@router.get("/members")
async def get_chat_members():
    """
    Obter lista de membros admin do chat.
    Usa SERVICE_KEY para ultrapassar RLS e retornar todos os admins.
    """
    try:
        sb = get_supabase_client()
        result = sb.table("profiles") \
            .select("id, display_name, avatar_url, email, role") \
            .eq("role", "admin") \
            .execute()
        
        members = []
        for p in (result.data or []):
            members.append({
                "id": p.get("id", ""),
                "name": p.get("display_name") or p.get("email", "Admin").split("@")[0],
                "avatar_url": p.get("avatar_url"),
                "email": p.get("email", ""),
            })
        
        return {"members": members}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter membros: {str(e)}"
        )


@router.get("/messages", response_model=ChatHistoryResponse)
async def get_chat_messages(limit: int = 50, offset: int = 0):
    """
    Obter historico de mensagens do chat admin.
    Retorna as mensagens mais recentes primeiro.
    """
    try:
        sb = get_supabase_client()
        
        # Contar total
        count_result = sb.table("admin_chat_messages").select("id", count="exact").execute()
        total = count_result.count or 0
        
        # Obter mensagens (mais recentes primeiro, depois inverter para mostrar cronologicamente)
        result = sb.table("admin_chat_messages") \
            .select("*") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()
        
        # Inverter para ordem cronologica
        messages = list(reversed(result.data)) if result.data else []
        
        return ChatHistoryResponse(
            messages=messages,
            total=total
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter mensagens: {str(e)}"
        )


@router.post("/messages", response_model=Dict[str, Any])
async def send_message(msg: ChatMessage):
    """
    Enviar uma mensagem no chat admin.
    A mensagem e guardada no Supabase.
    """
    try:
        sb = get_supabase_client()
        
        data = {
            "sender_id": msg.sender_id,
            "sender_name": msg.sender_name,
            "sender_avatar": msg.sender_avatar,
            "message": msg.message,
            "message_type": msg.message_type,
            "file_url": msg.file_url,
            "file_name": msg.file_name,
            "file_size": msg.file_size,
        }
        
        result = sb.table("admin_chat_messages").insert(data).execute()
        
        if result.data:
            return result.data[0]
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao guardar mensagem"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao enviar mensagem: {str(e)}"
        )


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    """Apagar uma mensagem do chat."""
    try:
        sb = get_supabase_client()
        sb.table("admin_chat_messages").delete().eq("id", message_id).execute()
        return {"success": True, "message": "Mensagem apagada"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao apagar mensagem: {str(e)}"
        )


@router.delete("/messages")
async def clear_all_messages():
    """Apagar todas as mensagens do chat."""
    try:
        sb = get_supabase_client()
        # Apagar todas as mensagens (gt created_at 2000 = todas)
        sb.table("admin_chat_messages").delete().gt("created_at", "2000-01-01").execute()
        return {"success": True, "message": "Chat limpo com sucesso"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao limpar chat: {str(e)}"
        )


@router.patch("/messages/{message_id}")
async def edit_message(message_id: str, req: EditMessageRequest):
    """Editar o texto de uma mensagem do chat."""
    try:
        sb = get_supabase_client()
        from datetime import datetime, timezone
        result = sb.table("admin_chat_messages").update({
            "message": req.message,
            "edited_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", message_id).execute()
        
        if result.data:
            return result.data[0]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensagem nao encontrada"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao editar mensagem: {str(e)}"
        )


@router.post("/ai", response_model=AIResponse)
async def chat_with_ai(req: AIRequest):
    """
    Enviar mensagem para a IA (Groq/Llama 3.3).
    Retorna resposta da IA.
    """
    groq_key = os.getenv("GROQ_CHAT_API_KEY", "")
    groq_model = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
    groq_vision_model = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    
    # Detetar se ha imagens para usar modelo de visao
    has_images = bool(req.image_urls and len(req.image_urls) > 0)
    active_model = groq_vision_model if has_images else groq_model
    
    print(f"[AI] Modelo: {active_model} | Imagens: {len(req.image_urls) if req.image_urls else 0} | Ficheiros: {len(req.file_contents) if req.file_contents else 0}")
    
    if not groq_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_CHAT_API_KEY nao configurada"
        )
    
    # Obter estado dos servicos para contexto da IA
    health_summary = await fetch_health_summary(req.intentional_services)
    
    # Obter resumo de trafego para contexto da IA
    traffic_summary = await fetch_traffic_summary()
    
    # Detetar se ha ficheiros
    has_files = bool(req.file_contents and len(req.file_contents) > 0)
    
    # Construir prompt dinamico com contexto do sender, saude, trafego e capacidades
    system_prompt = build_system_prompt(req.sender_name, health_summary, has_images=has_images, has_files=has_files, traffic_summary=traffic_summary)
    
    # Construir historico de contexto (ultimas mensagens)
    messages = [{"role": "system", "content": system_prompt}]
    
    if req.context:
        for ctx_msg in req.context[-10:]:  # Ultimas 10 mensagens para contexto
            role = "assistant" if ctx_msg.get("message_type") == "ai_response" else "user"
            name = ctx_msg.get("sender_name", "Admin")
            content = ctx_msg.get("message", "")
            
            if role == "user":
                messages.append({"role": "user", "content": f"[{name}]: {content}"})
            else:
                messages.append({"role": "assistant", "content": content})
    
    # Mensagem atual - construir conteudo multimodal se necessario
    user_text = f"[{req.sender_name}]: {req.message}"
    
    # Adicionar conteudo de ficheiros ao texto
    if req.file_contents:
        for fc in req.file_contents:
            fname = fc.get("name", "ficheiro")
            fcontent = fc.get("content", "")
            if fcontent:
                user_text += f"\n\n=== Conteudo do ficheiro: {fname} ===\n{fcontent[:8000]}\n=== Fim do ficheiro ==="
    
    if has_images:
        # Formato multimodal para modelo de visao
        content_parts: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]
        for img_url in req.image_urls[:4]:  # Max 4 imagens
            url_type = "base64" if img_url.startswith("data:") else "url"
            print(f"[AI] Imagem tipo: {url_type} | Tamanho: {len(img_url)} chars")
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": img_url}
            })
        messages.append({"role": "user", "content": content_parts})
    else:
        messages.append({"role": "user", "content": user_text})
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": active_model,
                    "messages": messages,
                    "temperature": 0.7,
                    **({
                        "max_completion_tokens": 2048,
                    } if has_images else {
                        "max_tokens": 2048,
                    }),
                    "top_p": 0.9,
                },
            )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"[AI] ERRO Groq ({response.status_code}): {error_text[:500]}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro da API Groq ({response.status_code}): {error_text[:300]}"
                )
            
            data = response.json()
            ai_message = data["choices"][0]["message"]["content"]
            model_used = data.get("model", groq_model)
            print(f"[AI] Resposta OK | Modelo: {model_used} | Tokens: {data.get('usage', {})}")
            
            return AIResponse(
                response=ai_message,
                model=model_used
            )
            
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout ao contactar a IA. Tenta novamente."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao contactar IA: {str(e)}"
        )


@router.get("/ai/status")
async def ai_status():
    """Verificar se a IA esta disponivel."""
    groq_key = os.getenv("GROQ_CHAT_API_KEY", "")
    
    if not groq_key:
        return {"available": False, "reason": "API key nao configurada"}
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {groq_key}"},
            )
            
            if response.status_code == 200:
                return {"available": True, "model": os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")}
            else:
                return {"available": False, "reason": f"Erro {response.status_code}"}
    except Exception as e:
        return {"available": False, "reason": str(e)}
