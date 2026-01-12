# 👁️ Eye Web — Breach Checker

[![Security](https://img.shields.io/badge/Security-Dependabot%20Enabled-green?logo=github)](https://github.com/Sam-Ciber-Dev/eyeweb/security)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Hugging Face](https://img.shields.io/badge/Data-Hugging%20Face-yellow?logo=huggingface)](https://huggingface.co/datasets/Samezinho/eye-web-breaches)

**Verificador de Fugas de Dados com Privacidade Total**

> 🎓 **Projeto PAP** — Prova de Aptidão Profissional em Cibersegurança

Sistema profissional de verificação de *data breaches* que protege a privacidade do utilizador através do modelo **K-Anonymity**. Os dados sensíveis **nunca saem do browser** — apenas um prefixo do hash SHA-256 é enviado à API.

---

## 🌟 Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| 📧 **Verificador de Email** | Verifica se o email foi exposto em fugas de dados |
| 📱 **Verificador de Telefone** | Suporta ~200 países com seletor visual de bandeiras |
| 🔐 **Verificador de Password** | Analisa força e verifica exposição em breaches |
| 🛡️ **K-Anonymity** | Privacidade garantida — o servidor nunca conhece os dados reais |
| 🌍 **100% Gratuito** | Sem custos de hosting (Vercel + Render + Hugging Face) |

---

## 🔒 Como Funciona a Privacidade (K-Anonymity)

```
┌─────────────┐     SHA-256      ┌─────────────┐     Prefixo     ┌─────────────┐
│   Browser   │ ───────────────► │    Hash     │ ──────────────► │   API       │
│  (Cliente)  │                  │  Completo   │   (5 chars)     │  (Backend)  │
└─────────────┘                  └─────────────┘                 └─────────────┘
                                                                       │
       ┌───────────────────────────────────────────────────────────────┘
       │  Lista de candidatos (todos os hashes com o mesmo prefixo)
       ▼
┌─────────────┐     Comparação    ┌─────────────┐
│   Browser   │ ◄──────────────── │  Candidatos │
│  (Cliente)  │      Local        │   (JSON)    │
└─────────────┘                   └─────────────┘
```

**Resultado:** O servidor nunca recebe o email/telefone/password real — apenas um prefixo que corresponde a milhares de possíveis valores.

---

## 🛠️ Stack Tecnológica

### Frontend
- **Next.js 14** — React framework com App Router
- **TypeScript** — Tipagem estática
- **react-select** — Seletor de países com pesquisa
- **CSS Variables** — Design system consistente

### Backend
- **FastAPI** — API REST de alta performance
- **Python 3.11+** — Linguagem principal
- **Hugging Face Datasets** — Armazenamento de dados
- **Parquet** — Formato otimizado para queries

### DevOps
- **Vercel** — Hosting do frontend (CDN global)
- **Render** — Hosting do backend (Docker)
- **GitHub Actions** — CI/CD e atualizações automáticas
- **Dependabot** — Monitorização de vulnerabilidades

---

## 📁 Estrutura do Projeto

```
eye-web-monorepo/
│
├── frontend/                    # 🖥️ Next.js (Vercel)
│   ├── src/
│   │   ├── app/                 # App Router + páginas
│   │   ├── components/          # Componentes React
│   │   │   ├── DataChecker.tsx      # Tabs Email/Telefone
│   │   │   ├── EmailChecker.tsx     # Verificador de email
│   │   │   ├── PhoneChecker.tsx     # Verificador de telefone (~200 países)
│   │   │   ├── PasswordChecker.tsx  # Verificador de password
│   │   │   └── BreachResults.tsx    # Resultados reutilizável
│   │   └── lib/
│   │       └── api.ts           # Serviço de API + K-Anonymity
│   ├── .env.example             # ⚠️ Template de configuração
│   └── package.json
│
├── backend/                     # ⚙️ FastAPI (Render)
│   ├── app/
│   │   ├── main.py              # Ponto de entrada
│   │   ├── routers/
│   │   │   ├── breach_router.py     # /api/v1/breaches/*
│   │   │   └── password_router.py   # /api/v1/passwords/*
│   │   └── services/
│   │       ├── breach_service.py    # Lógica de breaches
│   │       └── password_service.py  # Lógica de passwords
│   ├── .env.example             # ⚠️ Template de configuração
│   ├── Dockerfile
│   └── requirements.txt
│
├── updater/                     # 🔄 Scripts de atualização
│   ├── updater.py               # Atualiza dataset de breaches
│   ├── password_updater.py      # Atualiza dataset de passwords
│   ├── .env.example             # ⚠️ Template de configuração
│   └── requirements.txt
│
├── .github/
│   └── workflows/
│       └── update-dataset.yml   # Cron job semanal
│
├── .gitignore                   # Ficheiros ignorados
└── README.md                    # Esta documentação
```

---

## 🚀 Instalação Local

### Pré-requisitos
- Node.js 18+
- Python 3.11+
- Conta no Hugging Face (gratuita)

### 1. Clonar o repositório
```bash
git clone https://github.com/Sam-Ciber-Dev/eyeweb.git
cd eyeweb
```

### 2. Configurar variáveis de ambiente

Copia os ficheiros `.env.example` para `.env` em cada pasta:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local

# Updater (se necessário)
cp updater/.env.example updater/.env
```

### 3. Iniciar o Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# API disponível em http://localhost:8000
# Documentação em http://localhost:8000/docs
```

### 4. Iniciar o Frontend
```bash
cd frontend
npm install
npm run dev
# Site disponível em http://localhost:3000
```

---

## ⚙️ Configuração das Variáveis de Ambiente

### Backend (`backend/.env`)
```env
ENVIRONMENT=development
DEBUG=true
HF_DATASET_REPO=Samezinho/eye-web-breaches
HF_TOKEN=                    # Opcional para repos públicos
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Updater (`updater/.env`)
```env
HF_TOKEN=hf_xxxxxxxxxx       # Token com permissão WRITE
HF_DATASET_REPO=Samezinho/eye-web-breaches
```

> ⚠️ **NUNCA** faças commit de ficheiros `.env` reais! Usa os ficheiros `.example` como referência.

---

## 📊 Datasets no Hugging Face

| Dataset | Descrição | Registos |
|---------|-----------|----------|
| [eye-web-breaches](https://huggingface.co/datasets/Samezinho/eye-web-breaches) | Emails e telefones comprometidos | ~10,000 |
| [eye-web-passwords](https://huggingface.co/datasets/Samezinho/eye-web-passwords) | Passwords comuns/comprometidas | ~4,000 |

---

## 🌐 API Endpoints

### Breaches (Email/Telefone)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/breaches/check/{prefix}` | Verifica prefixo de hash |
| GET | `/api/v1/breaches/stats` | Estatísticas do dataset |

### Passwords
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/passwords/check/{prefix}` | Verifica prefixo de password |
| GET | `/api/v1/passwords/stats` | Estatísticas do dataset |

### Documentação Interativa
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 🚀 Deploy em Produção

### 1. Render (Backend)
1. Criar novo **Web Service** no [Render](https://render.com)
2. Conectar repositório GitHub
3. Configurar:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Adicionar variáveis de ambiente

### 2. Vercel (Frontend)
1. Importar projeto no [Vercel](https://vercel.com)
2. Configurar:
   - **Root Directory:** `frontend`
   - **Framework:** `Next.js`
3. Adicionar `NEXT_PUBLIC_API_URL` com o URL do Render

---

## 💰 Custos de Operação

| Serviço | Plano | Custo Mensal |
|---------|-------|--------------|
| Vercel | Hobby | **€0** |
| Render | Free | **€0** |
| Hugging Face | Free | **€0** |
| GitHub | Free | **€0** |
| **Total** | | **€0** |

---

## 🔐 Segurança

- ✅ **K-Anonymity** — Dados sensíveis nunca saem do cliente
- ✅ **Dependabot** — Monitorização automática de vulnerabilidades
- ✅ **HTTPS** — Comunicação encriptada em produção
- ✅ **Rate Limiting** — Proteção contra abuso da API
- ✅ **Variáveis de Ambiente** — Tokens nunca no código

---

## 🧪 Dados de Teste

Para testar a aplicação, usa estes dados que estão no dataset:

### Emails
- `leaked@test.com`
- `hacked@example.com`
- `pwned@eyeweb.test`

### Telefones (só dígitos, sem código do país)
- Portugal: `912345678`
- Espanha: `612345678`
- Reino Unido: `712345678`

### Passwords
- `password`
- `123456`
- `admin`

---

## 📄 Licença

Projeto académico desenvolvido para a **Prova de Aptidão Profissional (PAP)**.

**Autor:** Samuel  
**Curso:** CyberSecurity  
**Ano:** 2025/2026

---

<div align="center">

**⭐ Se este projeto te foi útil, deixa uma estrela no GitHub!**

</div>

