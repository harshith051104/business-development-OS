# ELLY — Universal Business Development Operating System

An enterprise-grade, AI-powered business development management platform for **B2B sales teams** across any industry.

---

## 1. System Purpose & Operational Boundaries

The ELLY BD OS empowers BD teams to:
- **Discover Organizations**: Search the web for companies by keyword, location, industry — auto-saved to CRM
- **Find Decision-Makers**: Auto-discovers CEO, CTO, VP contacts with email, phone, LinkedIn
- **Build Pipeline**: Progress organizations through Potential > Contacted > Connected > Partner
- **Showcase Projects**: Present company solutions through interactive presentation mode
- **Schedule Meetings**: Coordinate demos, strategy sessions, track minutes and decisions
- **Track Follow-Ups**: Never miss a commercial action with overdue tracking and reminders
- **Manage Opportunities**: Steer deals from interest to closed-won
- **Multi-Channel Outreach**: Email, Phone, WhatsApp, LinkedIn — AI-personalized sequences
- **Partnership Alliances**: Track strategic alliances, shared objectives, health
- **Measure Performance**: Real-time conversion velocity, team activity, CSV reports
- **AI Copilot**: Natural language interface — ask ELLY to find leads, draft emails, prep meetings

> [!IMPORTANT]
> **System Boundaries**: This is a **UNIVERSAL B2B Business Development Platform**. Works for any industry — software, cybersecurity, healthcare, fintech, manufacturing, etc. No clinical data, no EHR/FHIR integrations.

---

## 2. Platform Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │               React + Vite UI                │
                               │  • Dark Mode, Glassmorphism, Responsive      │
                               │  • Role-Aware Navigation (BD & Admin)        │
                               │  • Copilot Chat, Map View, Kanban           │
                               └──────────────────────┬───────────────────────┘
                                                      │ JWT Bearer Auth
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           FastAPI Backend Engine             │
                               │  • 30+ API Routers                           │
                               │  • AI Copilot (Groq/NVIDIA/Gemini)          │
                               │  • Web Discovery (Tavily/Serper/Directory)  │
                               │  • Gmail OAuth, Campaign Engine             │
                               │  • Multi-Channel Communication Logger      │
                               └──────────────────────┬───────────────────────┘
                                                      │ SQLAlchemy ORM
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │          SQLite / PostgreSQL DB              │
                               │  • Organizations, Contacts (auto-enriched)  │
                               │  • Campaigns, Emails, Opportunities         │
                               │  • Discovery, Research, Audit Logs          │
                               └──────────────────────────────────────────────┘
```

---

## 3. Core Business Development Lifecycle

```
DISCOVER ORGANIZATIONS (web search → auto-save to CRM)
          ↓
FIND DECISION-MAKERS (auto-discover + enrich email/phone/LinkedIn)
          ↓
BUILD PIPELINE (Potential → Contacted → Connected → Partner)
          ↓
SHOWCASE SOLUTIONS (interactive presentation mode)
          ↓
SCHEDULE & CONDUCT MEETINGS
          ↓
RESOLVE FOLLOW-UPS & TASKS
          ↓
SEND OUTREACH (multi-channel: Email, Phone, WhatsApp, LinkedIn)
          ↓
APPROVE & SEND (Draft → Approved → Sending with audit trail)
          ↓
MANAGE OPPORTUNITIES (Qualification → Proposal → Negotiation → Won)
          ↓
CONVERT TO PARTNERSHIPS
          ↓
ANALYZE PERFORMANCE (real-time dashboards & CSV reports)
```

---

## 4. User Roles & Access Control

| Role | Permissions & Scope |
| :--- | :--- |
| **`BUSINESS_DEVELOPMENT`** | Full BD access: Discovery, Organizations, Contacts, Pipeline, Showcase, Meetings, Follow-ups, Campaigns, Opportunities, Partnerships, Copilot, Analytics. Default: sees own records only. |
| **`ADMIN`** | Complete governance: User management, role assignment, ownership reassignment, showcase publishing, system config, audit logs. Sees all records. |
| **`HEALTHCARE` / `USER`** | Standard roles. Blocked from BD Portal and Admin. |

---

## 5. Technology Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **AI/LLM**: Groq (gpt-oss-120b), NVIDIA (nemotron), Google Gemini (2.5-flash)
- **Search**: Tavily API, Serper API, Curated Directory
- **Scraping**: ScrapeGraphAI (primary) + Stagehand browser fallback (JS-heavy sites)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Email**: Gmail OAuth 2.0
- **Communication**: Email, Phone, WhatsApp, LinkedIn (manual + automated)

---

## 6. Getting Started Locally

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Backend Setup
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

### Default Accounts
- **Admin**: `admin@test.local` / `password123`
- **BD User**: `bd@test.local` / `password123`

### Required API Keys (.env)
```
GROQ_API_KEY=your_groq_key
NVIDIA_NIM_API_KEY=your_nvidia_key
GEMINI_API_KEY=your_gemini_key
TAVILY_API_KEY=your_tavily_key
SERPER_API_KEY=your_serper_key
JWT_SECRET_KEY=your_jwt_secret
TOKEN_ENCRYPTION_KEY=your_fernet_key
```

### Optional Config (.env)
```
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
RESEARCH_DELAY_BETWEEN_REQUESTS=1.5
RESEARCH_TIMEOUT=60
```

---

## 7. Key Features

### AI Copilot
Natural language interface — ask ELLY to:
- "Find cybersecurity companies in the UK"
- "Research CrowdStrike"
- "Draft an email to the CTO of Snowflake"
- "What's in my pipeline today?"

### Auto-Discovery Pipeline
1. Search web (Tavily → Serper → Directory fallback)
2. Auto-save organizations to CRM
3. Auto-find decision-makers (CEO, CTO, VP)
4. Enrich contacts with email, phone, LinkedIn
5. Skip contacts with no reachable info

### Campaign Engine (with Approval Gate)
- Multi-step, multi-channel sequences (Email → Phone → LinkedIn)
- AI-personalized emails per contact
- **Mandatory approval**: Draft → Approved → Sending
- Batch approve/reject queue with audit logging
- Reply detection → auto-pause sequence
- Gmail OAuth sending with per-user accounts

### Multi-Channel Communication
- Quick-log endpoints: Phone, WhatsApp, LinkedIn
- Phone calls: duration, outcome (connected/voicemail/no_answer/busy)
- WhatsApp/LinkedIn: external message ID tracking
- Automatic contact timestamp updates

### AI Follow-Up Suggestions
- `GET /contacts/{id}/suggest-next-action` — analyzes history, recommends next step
- `GET /meetings/{id}/suggest-followups` — post-meeting action recommendations
- Smart channel suggestions based on usage patterns

### Research Engine
- ScrapeGraphAI website scraping with rate control
- **Stagehand browser fallback**: auto-activates for JS-heavy sites or when ScrapeGraphAI fails
- Auto-generates business intelligence briefs
- Technology signals, partnership opportunities
- Handles blocked sites gracefully
- Configurable delays and timeouts

---

## 8. New API Endpoints (Tiers 0-4)

### Campaign Approval Gate
- `POST /api/campaigns/contacts/{id}/approve` — Approve email for sending
- `POST /api/campaigns/contacts/{id}/reject` — Reject with reason
- `POST /api/campaigns/batch-approve` — Batch approve multiple
- `GET /api/campaigns/pending-reviews` — Queue of drafts

### Multi-Channel Quick-Log
- `POST /api/communications/quick-log/phone` — Log phone call
- `POST /api/communications/quick-log/whatsapp` — Log WhatsApp message
- `POST /api/communications/quick-log/linkedin` — Log LinkedIn message

### AI Suggestions
- `GET /api/contacts/{id}/suggest-next-action` — AI follow-up recommendations
- `GET /api/meetings/{id}/suggest-followups` — Post-meeting suggestions

### Core Endpoints
- `GET /health` → Service health check
- `GET /ready` → Readiness probe
- `POST /auth/login` → Get JWT token
- `POST /api/copilot/chat` → AI Copilot
- `GET /api/organizations` → List organizations (owner-scoped)
- `GET /api/contacts` → List contacts (owner-scoped)
- `POST /api/campaigns` → Create campaigns
- `GET /api/analytics/overview` → Dashboard analytics

---

## 9. Production Hardening

### Security
- **Email validation**: Regex on contact creation, auto-lowercase
- **LinkedIn validation**: Must be linkedin.com/in/ or linkedin.com/company/
- **Rate limiting**: 120 req/min per IP (middleware) + Gmail-specific (20/hr)
- **Audit logging**: Gmail disconnect, email approve/reject, all admin ops
- **Config validation**: Warns on missing keys in production mode

### Ownership & Visibility
- `owner_id` on: Organizations, Contacts, Campaigns, Meetings, FollowUps, Communications
- `owner_scope` query param: `mine` (default for BD) / `all` (admin)
- Gmail accounts scoped per-user (no cross-user access)
- Campaign email approval requires explicit user action

### Reliability
- LLM provider fallback: Groq → NVIDIA → Gemini
- Research rate control: configurable delays between requests
- Timeout wrappers: prevents hung ScrapeGraphAI calls
- DB connection pooling: configurable pool size and overflow
- Load test script: simulates 30-40 concurrent users

---

## 10. Recent Updates (Aug 2026)

### Tier 0 — Foundation
- Per-user Gmail OAuth with ownership scoping
- `owner_id` across all BD entities
- Email approval gate: Draft → Approved → Sending
- Postgres config + connection pooling

### Tier 1 — Multi-Channel
- Phone/WhatsApp/LinkedIn quick-log endpoints
- Communication model: source, duration, outcome, external IDs
- Contact channel preferences (preferred_channel, do_not_contact)
- Multi-channel campaign sequences

### Tier 2 — Automation
- AI follow-up suggestions per contact
- Meeting auto-followup recommendations
- Campaign reply → opportunity auto-create

### Tier 3 — Quality
- Email + LinkedIn URL validation
- Rate limit middleware (120 req/min)
- Audit logging on sensitive operations
- Config validation on startup

### Tier 4 — Universal B2B
- Removed all healthcare-specific labels from frontend
- OrganizationType updated: Company, Startup, SaaS, Enterprise, etc.
- Updated UI copy to universal B2B language

### Stagehand Browser Fallback
- Self-hosted Chrome browser via CDP (no Browserbase, no paid proxies)
- Auto-activates when ScrapeGraphAI fails/blocks/times out
- Renders JavaScript-heavy SPAs that httpx can't handle
- Lazy browser lifecycle — launched on first use, reused across requests
- 2s rate-limit between browser requests
- 30s timeout per page load
- LLM analysis of rendered content for structured extraction

---

## 11. License

Internal use only. Not for distribution.
