### Final Project of the 2nd Year CTeSP in Cybersecurity.

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

