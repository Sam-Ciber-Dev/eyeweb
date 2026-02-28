# EyeWeb Reborn
## [ PORTUGUÊS - PT ]

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
git clone https://github.com/SEU-REPOSITORIO.git
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


---

## [ ENGLISH - EN ]

Final Project of the 2nd Year CTeSP in Cybersecurity.

EyeWeb is a data breach verification platform developed with a strong focus on security, privacy, and secure architecture best practices.  
The system allows users to check emails, phone numbers, and passwords without ever exposing the user's real data to the server.

The application implements the K-Anonymity model, ensuring that only a SHA-256 hash prefix is sent to the API, maintaining full privacy of sensitive data.

---

## Features

| Feature | Description |
|----------|-------------|
| Email Checker | Verifies whether an email address has been exposed in data breaches |
| Phone Number Checker | Supports approximately 200 countries |
| Password Checker | Evaluates strength and checks exposure in breaches |
| K-Anonymity | The server never receives raw user data |
| Free Infrastructure | Deployed using Vercel, Render, and Hugging Face |

---

## How Privacy Works (K-Anonymity)

Browser (Client)  
└─ SHA-256 (full hash)  
└─ Only prefix sent (5 characters)  
└─ API (Backend)  
└─ Candidate hash list  
└─ Local comparison in the browser  

Result:  
The server never receives the real email, phone number, or password. Only a prefix that corresponds to thousands of possible values.

---

## Technology Stack

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

### DevOps & Infrastructure
- Vercel (Frontend)
- Render (Backend)
- GitHub Actions (CI/CD)
- Dependabot (Dependency vulnerability monitoring)

---

## Project Structure

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

## Local Installation

### Requirements
- Node.js 18+
- Python 3.11+
- Free Hugging Face account

### 1. Clone the repository
git clone https://github.com/YOUR-REPOSITORY.git
cd eyeweb


### 2. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp updater/.env.example updater/.env

Never commit real `.env` files.

### 3. Start Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload


API: http://localhost:8000  
Documentation: http://localhost:8000/docs  

### 4. Start Frontend
cd frontend
npm install
npm run dev


Application: http://localhost:3000  

---

## API Endpoints

### Breaches (Email / Phone)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/breaches/check/{prefix} | Checks hash prefix |
| GET | /api/v1/breaches/stats | Dataset statistics |

### Passwords

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/passwords/check/{prefix} | Checks prefix |
| GET | /api/v1/passwords/stats | Dataset statistics |

---

## Production Deployment

### Backend (Render)
- Root Directory: backend
- Build Command: pip install -r requirements.txt
- Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

### Frontend (Vercel)
- Root Directory: frontend
- Framework: Next.js
- Variable: NEXT_PUBLIC_API_URL

---

## Security

- K-Anonymity implementation
- SHA-256 hashing
- HTTPS
- Rate limiting
- Environment variables for credentials
- Automatic dependency vulnerability monitoring

---

## Limitations

- Dependent on public datasets
- Limited to known breaches
- Not a replacement for professional security audits

---

## Academic Context

Developed as part of the Final Project course of the 2nd Year CTeSP in Cybersecurity.

