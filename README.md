# EyeWeb Reborn

Projeto Final do 2.º Ano de Ctesp em Cibersegurança.

EyeWeb é uma plataforma de verificação de fugas de dados (data breaches) desenvolvida com foco na segurança, privacidade e boas práticas de arquitetura segura.  
O sistema permite verificar e-mails, números de telemóvel e palavras-passe sem nunca expor os dados reais do utilizador ao servidor.

A aplicação implementa o modelo K-Anonymity, garantindo que apenas um prefixo do hash SHA-256 é enviado para a API, mantendo a total privacidade dos dados sensíveis.

---

## Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| Verificador de E-mail | Verifica se um endereço de e-mail foi exposto em fugas de dados |
| Verificador de Número de Telemóvel | Suporte para aproximadamente 200 países |
| Verificador de Palavra-Passe | Avalia a robustez e verifica exposição em breaches |
| K-Anonymity | O servidor nunca recebe os dados reais |
| Infraestrutura Gratuita | Deploy com Vercel, Render e Hugging Face |

---

## Como Funciona a Privacidade (K-Anonymity)

Browser (Cliente)
└─ SHA-256 (hash completo)
└─ Envio apenas do prefixo (5 caracteres)
└─ API (Backend)
└─ Lista de hashes candidatos
└─ Comparação local no browser


Resultado:  
O servidor nunca recebe o e-mail, número de telemóvel ou palavra-passe real. Apenas um prefixo que corresponde a milhares de valores possíveis.

---

## Stack Tecnológica

### Frontend
- Next.js 14 (App Router)
- React
- TypeScript
- react-select
- CSS Variables

### Backend
- FastAPI
- Python 3.11+
- Hugging Face Datasets
- Parquet

### DevOps e Infraestrutura
- Vercel (Frontend)
- Render (Backend)
- GitHub Actions (CI/CD)
- Dependabot (Monitorização de vulnerabilidades)

---

## Estrutura do Projeto

eye-web-monorepo/

├── frontend/

│ ├── src/

│ ├── .env.example

│ └── package.json

│

├── backend/

│ ├── app/

│ ├── .env.example

│ ├── Dockerfile

│ └── requirements.txt

│

├── updater/

│ ├── updater.py

│ ├── password_updater.py

│ ├── .env.example

│ └── requirements.txt

│

├── .github/workflows/

├── .gitignore

└── README.md


---

## Instalação Local

### Pré-requisitos
- Node.js 18+
- Python 3.11+
- Conta gratuita no Hugging Face

### 1. Clonar o repositório
git clone [https://github.com/SEU-REPOSITORIO.git](https://github.com/Sam-Ciber-Dev/eyeweb)
cd eyeweb

### 2. Configurar variáveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp updater/.env.example updater/.env
Nunca fazer commit de ficheiros .env reais.

### 3. Iniciar Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
API: http://localhost:8000
Documentação: http://localhost:8000/docs

### 4. Iniciar Frontend
cd frontend
npm install
npm run dev
Aplicação: http://localhost:3000

---


## API Endpoints

Breaches (E-mail / Telefone)

|Método	|Endpoint	|Descrição|
|-----|---------|-----------|
|GET |	/api/v1/breaches/check/{prefix}	| Verifica prefixo de hash|
|GET	| /api/v1/breaches/stats |	Estatísticas|

Passwords

|Método	|Endpoint	|Descrição|
|-----|---------|-----------|
|GET	 | /api/v1/passwords/check/{prefix}	| Verifica prefixo|
|GET	| /api/v1/passwords/stats |	Estatísticas|

---

## Deploy em Produção

### Backend (Render)
- Root Directory: backend
- Build Command: pip install -r requirements.txt
- Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

### Frontend (Vercel)
- Root Directory: frontend
- Framework: Next.js
- Variável: NEXT_PUBLIC_API_URL

---

## Segurança

- K-Anonymity
- Hashing SHA-256
- HTTPS
- Rate Limiting
- Variáveis de ambiente para credenciais
- Monitorização automática de dependências

---

## Limitações
- Dependente de datasets públicos
- Limitado a fugas conhecidas
- Não substitui auditorias profissionais de segurança

---

## Contexto Académico

Projeto desenvolvido no âmbito da disciplina Projeto Final do 2.º Ano Ctesp em Cibersegurança.
