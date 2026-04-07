"""
===========================================
Eye Web Backend — Configurações
===========================================
Centraliza todas as configurações da API.
Valores sensíveis vêm de variáveis de ambiente.
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Configurações da aplicação.
    Carregadas automaticamente de variáveis de ambiente.
    """
    
    # ===========================================
    # AMBIENTE
    # ===========================================
    
    # Ambiente de execução: development, staging, production
    ENVIRONMENT: str = "development"
    
    # Debug mode (ativa logs detalhados)
    DEBUG: bool = False
    
    # ===========================================
    # HUGGING FACE
    # ===========================================
    
    # Repositório do dataset no Hugging Face
    # Formato: "username/repo-name"
    HF_DATASET_REPO: str = "Samezinho/eye-web-breaches"
    
    # Token de leitura do Hugging Face (opcional para repos públicos)
    HF_TOKEN: str = ""
    
    # URL base para acesso aos ficheiros do dataset
    @property
    def HF_DATASET_URL(self) -> str:
        """URL base para acesso direto aos ficheiros Parquet."""
        return f"https://huggingface.co/datasets/{self.HF_DATASET_REPO}/resolve/main/data"
    
    # ===========================================
    # CACHE
    # ===========================================
    
    # Tamanho máximo do cache LRU (número de partições em memória)
    # Cada partição tem ~6KB, então 100 partições = ~600KB
    CACHE_MAX_SIZE: int = 100
    
    # Tempo de vida do cache em segundos (1 hora)
    CACHE_TTL_SECONDS: int = 3600
    
    # ===========================================
    # API
    # ===========================================
    
    # Título da API (aparece na documentação)
    API_TITLE: str = "Eye Web API"
    
    # Versão da API
    API_VERSION: str = "1.0.0"
    
    # Descrição da API
    API_DESCRIPTION: str = """
    🔐 **Eye Web Breach Checker API**
    
    API para verificação de fugas de dados utilizando o modelo K-Anonymity.
    
    ## Como funciona
    
    1. O cliente gera o hash SHA-256 do email localmente
    2. Envia apenas o prefixo do hash (5-6 caracteres) para esta API
    3. A API retorna todos os hashes candidatos que começam com esse prefixo
    4. O cliente compara localmente se o hash completo está na lista
    
    ## Privacidade
    
    - O email **nunca** é enviado para o servidor
    - O servidor **nunca** conhece o hash completo
    - Modelo K-Anonymity garante anonimato total
    """
    
    # Prefixo das rotas da API
    API_PREFIX: str = "/api/v1"
    
    # ===========================================
    # CORS (Cross-Origin Resource Sharing)
    # ===========================================
    
    # Origens permitidas (frontend)
    # Em produção, especificar apenas os domínios do frontend
    CORS_ORIGINS: list = [
        "https://eyeweb.vercel.app",  # Produção Vercel
    ]
    
    # Origens adicionais para desenvolvimento local
    CORS_ORIGINS_DEV: list = [
        "http://localhost:3000",      # Next.js dev
        "http://127.0.0.1:3000",
    ]
    
    @property
    def allowed_origins(self) -> list:
        if self.ENVIRONMENT == "production":
            return self.CORS_ORIGINS
        return self.CORS_ORIGINS + self.CORS_ORIGINS_DEV
    
    # ===========================================
    # RATE LIMITING
    # ===========================================
    
    # Número máximo de requests por minuto por IP
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # ===========================================
    # SUPABASE (URL Checker Cache)
    # ===========================================
    
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    
    # ===========================================
    # GROQ (AI Analysis - URL Checker)
    # ===========================================
    
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    
    # ===========================================
    # GROQ (AI Chat Admin)
    # ===========================================
    
    GROQ_CHAT_API_KEY: str = ""
    GROQ_CHAT_MODEL: str = "llama-3.3-70b-versatile"
    
    # ===========================================
    # GROQ (AI User Chat - Public Widget)
    # ===========================================
    
    GROQ_USER_CHAT_API_KEY: str = ""
    GROQ_USER_CHAT_MODEL: str = "llama-3.3-70b-versatile"
    
    # ===========================================
    # URL SCANNING SERVICES
    # ===========================================
    
    GOOGLE_SAFE_BROWSING_KEY: str = ""
    GOOGLE_SAFE_BROWSING_API_KEY: str = ""  # Alias para health check
    URLSCAN_API_KEY: str = ""
    
    # ===========================================
    # URL CHECKER SETTINGS
    # ===========================================
    
    # Tempo de cache em segundos (30 dias)
    URL_CACHE_TTL_SECONDS: int = 2592000
    
    # Tempo máximo para considerar cache "fresco" (30 dias = 1 mês)
    URL_CACHE_FRESH_SECONDS: int = 2592000
    
    # ===========================================
    # ADMIN MFA
    # ===========================================
    
    # Hash SHA-256 do email admin (para não expor email no código)
    # Suporta múltiplos admins separados por vírgula
    ADMIN_EMAIL_HASH: str = ""  # Deprecated - usar ADMIN_EMAIL_HASHES
    ADMIN_EMAIL_HASHES: str = ""  # Múltiplos hashes separados por vírgula
    
    # Secret TOTP para MFA (gerado com pyotp.random_base32())
    MFA_SECRET: str = ""
    ADMIN_MFA_SECRET: str = ""  # Alias para health check
    
    # ===========================================
    # BREVO SMTP
    # ===========================================
    
    BREVO_API_KEY: str = ""
    BREVO_SMTP_SERVER: str = "smtp-relay.brevo.com"
    BREVO_SMTP_PORT: int = 587
    BREVO_SMTP_LOGIN: str = ""
    BREVO_SMTP_KEY: str = ""
    
    # ===========================================
    # URLs DE PRODUÇÃO
    # ===========================================
    
    VERCEL_URL: str = "https://eyeweb.vercel.app"
    RENDER_EXTERNAL_URL: str = ""
    
    # ===========================================
    # RESEND (Email Service)
    # ===========================================
    
    # API Key do Resend para envio de emails
    RESEND_API_KEY: str = ""
    
    # ===========================================
    # CONFIGURAÇÃO DO PYDANTIC
    # ===========================================
    
    class Config:
        # Carregar variáveis de ambiente com prefixo (opcional)
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """
    Retorna instância singleton das configurações.
    Usa cache para evitar reler variáveis de ambiente.
    """
    return Settings()
