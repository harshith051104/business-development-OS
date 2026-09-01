# ELLY BD OS — Deployment Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud project with Gmail API enabled
- At least one LLM API key (Groq, NVIDIA, or Gemini)
- At least one search API key (Tavily or Serper)

## 1. Clone & Install

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

## 2. Environment Configuration

```bash
cd backend
copy .env.example .env
```

Edit `.env` with real values:

| Key | Required | How to get |
|-----|----------|------------|
| `JWT_SECRET_KEY` | Yes | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `TOKEN_ENCRYPTION_KEY` | Yes | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `GROQ_API_KEY` | Yes* | https://console.groq.com |
| `NVIDIA_NIM_API_KEY` | No | https://build.nvidia.com |
| `GEMINI_API_KEY` | No | https://aistudio.google.com/apikey |
| `TAVILY_API_KEY` | Yes* | https://tavily.com |
| `SERPER_API_KEY` | No | https://serper.dev |

*At least one LLM key and one search key required.

## 3. Google Gmail OAuth Setup

1. Go to https://console.cloud.google.com
2. Create project (or select existing)
3. Enable **Gmail API** (APIs & Services → Library → search "Gmail")
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Desktop App**
   - Download JSON → save as `google_gmail_credentials.json` in `backend/`
5. Set `GMAIL_SENDER_EMAIL` in `.env` to your Gmail address
6. First backend start opens browser for OAuth consent → approve → token saved to `token.json`

## 4. Database Setup

```bash
cd backend

# Create tables + admin + BD user
python seed.py
# Enter password when prompted (or set ADMIN_PASSWORD env var)
```

This creates:
- `admin@ellybd.com` — Admin role
- `bd@ellybd.com` — Business Development role

Change emails/passwords via environment variables:
```bash
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=yourpass BD_EMAIL=rep@company.com BD_PASSWORD=repapass python seed.py
```

## 5. Start Backend

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Backend runs at http://localhost:8001

## 6. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at http://localhost:5173

## 7. First Login

1. Open http://localhost:5173
2. Login with admin credentials from Step 4
3. You should see the ELLY Dashboard

## 8. Find Your First Prospects

1. Navigate to **Discovery** (left sidebar)
2. Enter a search: e.g. "SaaS companies in San Francisco"
3. Click **Search** — Tavily/Serper returns real companies
4. Click **Save** on promising results → they become Organization records
5. Add Contacts to each organization

## 9. Connect Gmail

1. Navigate to **Settings** or trigger a campaign
2. Click **Connect Gmail** → browser opens for OAuth consent
3. Approve → ELLY can now send emails on your behalf
4. Rate limit: 20 emails/hour (configurable)

## 10. Production Deployment

For production (not localhost):

1. Set `DEBUG=false` in `.env`
2. Set `CORS_ORIGINS` to your frontend domain
3. Use a reverse proxy (nginx/Caddy) for HTTPS
4. Use PostgreSQL instead of SQLite for concurrent access:
   ```
   DATABASE_URL=postgresql://user:pass@localhost:5432/elly_bd
   ```
5. Set `ELLY_ENV=production` to enforce security checks
6. Run behind a process manager (systemd, Docker, PM2)

## Database Backup

```bash
# SQLite
copy backend\bd_portal.db backup\bd_portal_$(Get-Date -Format yyyyMMdd).db

# PostgreSQL
pg_dump -U elly elly_bd > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `JWT_SECRET_KEY not set` | Set in `.env`, restart backend |
| `Gmail OAuth fails` | Re-download credentials JSON, check redirect URI includes `localhost:8001` |
| `No LLM responses` | Check API key is valid, check quota |
| `Discovery returns empty` | Check Tavily/Serper API key |
| `Frontend can't connect` | Check CORS_ORIGINS includes `http://localhost:5173` |
