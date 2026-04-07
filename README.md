# EyeWeb: Data Breach Verification Platform

**Live:** [eyeweb.vercel.app](https://eyeweb.vercel.app)

## Overview

**EyeWeb** is a cybersecurity platform that verifies emails, phone numbers, and passwords against known data breaches, and scans URLs for security threats using AI analysis, all without ever exposing the user’s real data to the server. Developed as the final project for the 2nd year CTeSP in Cybersecurity at [ISTEC](https://istec-porto.pt)(Instituto Superior de Tecnologias Avançadas do Porto) academic year 2025/2026. The platform demonstrates practical skills in secure architecture, privacy-preserving data handling, full-stack web development, and AI integration.

## How It Works

### Privacy Model (K-Anonymity)

The platform implements the K-Anonymity model to ensure user data never leaves the browser in raw form. When a user submits an email, phone number, or password, the browser generates a SHA-256 hash locally and sends only the first 5 characters (the prefix) to the API. The backend returns all records matching that prefix, and the final comparison of the full hash happens entirely in the browser. The server never knows which specific record was being checked.

```
Browser (Client)
└─ SHA-256("user@example.com") → e3b0c44...
   └─ Send prefix: "e3b0c"
      └─ API returns all hashes starting with "e3b0c"
         └─ Browser compares full hash locally
```

### Email Checker

The user enters an email address. The browser hashes it with SHA-256 and sends only the 5-character prefix to the backend. The API queries partitioned Parquet files hosted on Hugging Face Datasets, returning all candidate records. The browser compares the full hash locally and displays any matching breaches, including the breach name, date, and types of exposed data (passwords, IPs, usernames, credit cards, browsing history). Personalized security recommendations are generated based on what was exposed.

### Phone Number Checker

Supports approximately 200 countries with a searchable dropdown showing country flags (via `flagcdn.com`) and dialing codes. The phone number is normalized (country code + digits), hashed, and checked using the same K-Anonymity process as the email checker.

### Password Checker

Evaluates password strength in real time using a scoring system (0–10) that checks length, character diversity, and common patterns. When the user clicks "Check", the password hash prefix is sent to a separate Hugging Face Dataset of known compromised passwords. If the password is found in the breach dataset, the strength score is automatically downgraded to "Weak" regardless of complexity.

### URL Security Scanner

The URL checker combines multiple analysis sources into a single verdict:

1. **Google Safe Browsing** — checks the URL against Google’s database of known malicious sites
2. **SSL Certificate Validation** — verifies HTTPS configuration and certificate validity
3. **AI Analysis (Groq LLaMA 3.3 70B)** — generates a natural-language opinion about the URL’s safety, displayed with a typewriter animation

Results are cached in Supabase. Previously scanned URLs return instant results while a background re-verification runs. The scanner includes client-side validation that blocks dangerous protocols, private IPs, and malformed URLs before any request is sent.

### AI Chat Assistant

A floating chat widget allows users to ask cybersecurity questions. Messages are sent to Groq’s LLaMA 3.3 70B model via a dedicated backend endpoint. The conversation persists in session storage and supports live language switching — when the user changes language, bot responses are automatically re-translated. The chat uses a typewriter effect for responses and includes a cooldown between messages to prevent abuse.

### Admin Dashboard

Administrators access a separate dashboard protected by manual login only (Google OAuth is blocked for admin accounts) and a custom MFA system:

- **MFA**: A standalone Python desktop application (`eyeweb_auth.py`) generates TOTP codes using HMAC-SHA256 with 30-second intervals. The MFA code is never transmitted over the web — it exists only on the admin’s local machine. Two failed attempts result in a 72-hour ban by IP and hardware fingerprint.
- **Device Fingerprinting**: Canvas, WebGL, Audio, Screen, CPU, RAM, Timezone, and Platform signals are combined into a weighted score (≥70 points = same device). A separate hardware-only hash detects the same device across different browsers.
- **Traffic Monitor**: Real-time visitor logs with geolocation, VPN detection, device fingerprints, IP/device blocking, and automated monthly/yearly reports.
- **Health Monitor**: Live status checks for all external services (Supabase, Render, Hugging Face, Groq, Google Safe Browsing, URLScan).
- **Email Manager**: Newsletter broadcasting to subscribed users via Brevo SMTP, with subscriber management and ban controls.
- **Admin Chat**: Real-time internal messaging between administrators using Supabase Realtime, with typing indicators, file sharing, and online presence tracking.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | React-based SSR framework |
| **Language** | TypeScript | Type-safe frontend development |
| **Backend** | FastAPI (Python 3.11+) | Async REST API |
| **Database** | Supabase (PostgreSQL) | Auth, Realtime, Storage, Row-Level Security |
| **Breach Data** | Hugging Face Datasets (Parquet) | Partitioned breach records (256 files) |
| **AI** | Groq (LLaMA 3.3 70B) | URL analysis, admin chat, user chat |
| **URL Scanning** | Google Safe Browsing, URLScan.io | Threat detection APIs |
| **Email** | Brevo SMTP | Transactional and newsletter emails |
| **CAPTCHA** | Cloudflare Turnstile | Bot protection on auth forms |
| **Frontend Hosting** | Vercel (CDG1, Paris) | Global CDN with automatic deploys |
| **Backend Hosting** | Render (Frankfurt) | Dockerized API with auto-deploy |
| **CI/CD** | GitHub Actions | Dataset sync, dependency updates |
| **Security Monitoring** | Dependabot | Automatic vulnerability alerts |

## API Endpoints

### Breaches (Email / Phone)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/breaches/check/{prefix}` | Returns candidate hashes matching the prefix |
| GET | `/api/v1/breaches/stats` | Dataset statistics (record count, partitions) |

### Passwords

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/passwords/check/{prefix}` | Returns candidate password hashes |
| GET | `/api/v1/passwords/stats` | Dataset statistics |

### URL Scanner

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/urls/check` | Submit URL for analysis |
| GET | `/api/v1/urls/status?hash={hash}` | Check scan status and result |
| GET | `/api/v1/urls/health` | Scanner service health |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify-mfa` | Validate admin TOTP code |
| POST | `/api/auth/check-ban` | Check IP/device ban status |
| GET | `/api/auth/admin/verify` | Verify admin session token |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/traffic/*` | Traffic logs, reports, blocking |
| POST | `/api/admin/chat/*` | Internal admin chat |
| POST | `/api/admin/emails/*` | Newsletter management |
| GET | `/api/admin/health` | Service health checks |

## Project Structure

```
eye-web-monorepo/
├── frontend/
│   ├── src/
│   │   ├── app/           — Pages (home, login, signup, admin, perfil, about)
│   │   ├── components/    — Reusable UI (Navbar, ChatWidget, UrlChecker, etc.)
│   │   ├── contexts/      — React contexts (Auth, Language, AdminPresence)
│   │   ├── lib/           — API client, fingerprint engine, Supabase client
│   │   └── i18n/          — PT/EN translations (300+ keys)
│   ├── public/
│   ├── package.json
│   └── next.config.js
│
├── backend/
│   ├── app/
│   │   ├── routers/       — breach, password, url, auth, admin, chat, traffic
│   │   ├── services/      — Business logic for each router
│   │   ├── config.py      — Centralized settings (env vars)
│   │   ├── dependencies.py — Admin JWT verification
│   │   ├── models.py      — Pydantic schemas
│   │   └── main.py        — FastAPI app with scheduled tasks
│   ├── Dockerfile
│   ├── render.yaml
│   └── requirements.txt
│
├── updater/
│   ├── updater.py          — Breach dataset generator (SHA-256, Parquet, HF upload)
│   ├── password_updater.py — Password dataset generator
│   └── requirements.txt
│
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── dependabot-auto-merge.yml
│       └── update-dataset.yml
│
├── .gitignore
└── README.md
```

## Security Measures

| Measure | Implementation |
|---------|---------------|
| **K-Anonymity** | Only hash prefixes leave the browser; full comparison is client-side |
| **SHA-256 Hashing** | All sensitive data hashed before any network request |
| **HTTPS** | All communications encrypted in transit |
| **Rate Limiting** | Per-IP request throttling on URL scanner |
| **SSRF Protection** | Private IPs, localhost, and dangerous protocols blocked server-side |
| **CSRF Protection** | Cloudflare Turnstile on auth forms, origin validation |
| **Admin MFA** | Offline TOTP generator — codes never traverse the network |
| **2-Strikes Policy** | 2 failed MFA attempts = 72-hour ban by IP + hardware fingerprint |
| **Device Fingerprinting** | Canvas, WebGL, Audio, Screen hashing for device identification |
| **Input Sanitization** | URL validation, XSS prevention, protocol filtering |
| **Environment Variables** | All secrets via env vars, never committed to source |
| **Dependency Monitoring** | Dependabot alerts with automatic security PRs |
| **Row-Level Security** | Supabase RLS policies on all database tables |
| **Log Rotation** | Automatic cleanup of traffic logs older than 30 days |

## Local Installation

### Prerequisites

- Node.js 18+
- Python 3.11+
- Free accounts: [Supabase](https://supabase.com), [Hugging Face](https://huggingface.co), [Groq](https://console.groq.com)

### 1. Clone the repository

```bash
git clone https://github.com/Sam-Ciber-Dev/eyeweb.git
cd eyeweb
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp updater/.env.example updater/.env
```

Never commit real `.env` files.

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000 — Documentation: http://localhost:8000/docs

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Application: http://localhost:3000

## Production Deployment

### Backend (Render)

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Runtime | Docker |
| Region | Frankfurt (EU) |

### Frontend (Vercel)

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Next.js |
| Environment Variable | `NEXT_PUBLIC_API_URL` |
| Region | CDG1 (Paris) |

## Limitations

- Dependent on public breach datasets, limited to known breaches
- Free-tier backend hosting imposes cold-start latency (~30 seconds after inactivity)
- URL scanner depends on third-party API availability (Google Safe Browsing, URLScan.io)
- Not a replacement for professional security audits

## Contact

- **Email:** sam.oliveira.dev@gmail.com
- **Compose in Gmail:** [Gmail](https://mail.google.com/mail/?view=cm&fs=1&to=sam.oliveira.dev@gmail.com&su=EyeWeb%20inquiry&body=Hi%20Samuel%2C%0A)
- **Compose in Outlook:** [Outlook](https://outlook.live.com/owa/?path=/mail/action/compose&to=sam.oliveira.dev@gmail.com&subject=EyeWeb%20inquiry&body=Hi%20Samuel%2C%0A)
- **LinkedIn:** [linkedin.com/in/jose-samuel-oliveira](https://www.linkedin.com/in/jose-samuel-oliveira)
- **Website:** [sam-ciber-dev.github.io](https://sam-ciber-dev.github.io)

## License

This project is licensed under the [MIT License](LICENSE).

## Social Preview

<img src="frontend/public/social-preview.png" alt="EyeWeb — Data Breach Verification Platform" width="640">

## Badges

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
