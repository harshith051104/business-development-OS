"""
User Manual & Feature Documentation Module for Business Development OS.
Provides structured, comprehensive documentation and verbatim lookup so that
when users ask how to use a feature or what a feature is, Ask ELLY returns
the exact documentation as it is without generating or hallucinating answers.
"""

from typing import Dict, List, Optional, Tuple
import re

USER_MANUAL_SECTIONS: Dict[str, Dict[str, str]] = {
    "system_overview": {
        "title": "System Overview & Architecture",
        "keywords": ["overview", "system", "architecture", "what is elly", "what is this platform", "role", "permissions", "portal"],
        "content": """# System Overview & Architecture

### What is the Business Development OS?
The **Business Development Management OS** is an autonomous commercial execution platform designed to manage lead discovery, multi-touch campaigns, pipeline velocity, meeting scheduling, and deal progression.

### Key Capabilities:
- **Autonomous Outreach & Sequences**: Multi-step personalized cold outreach campaigns across Gmail and LinkedIn.
- **Outreach Progress Tracker (Lead Tracker)**: Real-time spreadsheet grid tracking 13 milestone checklists per prospect with 2-way Google Sheets synchronization.
- **Connection Pipeline Board**: Interactive Kanban board tracking relationship progression with personal ("My Status") and team-wide filtering.
- **Autonomous Reply Classifier Agent**: Email reply monitor that analyzes sentiment and intent to automatically update lead statuses (`Interested`, `Not Interested`, `Out of Office`, `Meeting Booked`).
- **Commercial Funnel & ROI Attribution**: End-to-end tracking from initial enrolled lead to revenue won.
- **Ask ELLY Autonomous Copilot**: Conversational AI powered by Groq, Gemini, and NVIDIA NIM with safe 1-click confirmation gates for write actions.

### User Roles & Access Control:
- **ADMIN**: Complete system access including user management, Google Sheets configuration, Gmail deliverability controls, and audit logs.
- **BUSINESS_DEVELOPMENT (BD User)**: Access to create and manage campaigns, update lead checklists, move pipeline stages, log meetings, and use Ask ELLY.
- **VIEWER**: Read-only visibility into organizations, contacts, and reports."""
    },

    "dashboard": {
        "title": "Executive Dashboard (/business-development)",
        "keywords": ["dashboard", "executive briefing", "overview", "kpis", "pipeline value", "metrics", "buying signals"],
        "content": """# Executive Dashboard (/business-development)

### What is the Executive Dashboard?
The **Executive Dashboard** is the command center for commercial operations. It aggregates critical sales metrics, active buying signals, and high-priority action items.

### Key Metrics Displayed:
1. **Total Pipeline Value**: Real-time monetary value of all active commercial opportunities.
2. **Active Opportunities**: Total open deals currently progressing through the pipeline.
3. **Today's Meetings**: Number of client and partner calls scheduled for today.
4. **Active Partnerships**: Total live strategic partner accounts.

### Dashboard Sections:
- **Real-Time Buying Signals Feed**: Displays high-intent activity detected across web research, email openings, and reply sentiment, tagged with confidence percentages and observation timestamps.
- **Quick Actions Toolbar**: One-click shortcuts to Find Organizations, Add Contact, Create Opportunity, Compose Outreach, or Schedule a Meeting.
- **Full Revenue Funnel**: Visual progression from Lead Discovery -> Cold Outreach -> Warm Inquiries -> Proposals -> Deals Won."""
    },

    "find_organizations": {
        "title": "Find Organizations & Market Discovery (/discover)",
        "keywords": ["find organizations", "discover", "discovery", "market research", "fit score", "qualification", "web search", "serper", "tavily"],
        "content": """# Find Organizations & Market Discovery (/business-development/discover)

### What is Market Discovery?
The **Find Organizations** tool enables automated exploration of external markets to find qualified corporate targets, hospitals, tech enterprises, and partners that are not yet in your CRM.

### How It Works:
1. **Search Query**: Enter target criteria, industry keywords, geography, or focus areas (e.g., "Healthcare providers in Mumbai", "SaaS startups with >100 employees").
2. **Multi-Source Web Crawling**: Uses Serper and Tavily APIs to identify candidate company domains.
3. **Automated Account Qualification (AI Fit Score)**: Evaluates company websites against your target profile and generates an explainable fit score (0–100%) highlighting alignment, business model, and tech stack match.
4. **Decision-Maker Discovery**: Automatically surfaces key executive leadership names, titles, and public email/LinkedIn links (CTO, CIO, Founder, Head of Partnerships).
5. **One-Click Import**: Converts discovered organizations and executive contacts directly into your CRM directory with zero manual data entry."""
    },

    "organizations": {
        "title": "Organizations Directory (/organizations)",
        "keywords": ["organizations", "company", "companies", "account", "dossier", "crm", "organization list"],
        "content": """# Organizations Directory (/business-development/organizations)

### What is the Organizations Directory?
A central database of all target prospects, partner entities, and active customer accounts.

### Features & Filters:
- **Search & Filter**: Search by company name, country, city, priority (`High`, `Medium`, `Low`), industry, or stage status.
- **Owner Assignment**: Assign accounts to specific business development team members.
- **360° Account Dossier**:
  - **Company Overview**: Website, industry, headquarter location, phone, and primary email.
  - **Linked Contacts**: All executive stakeholders associated with this organization.
  - **Open Opportunities**: Commercial deals tied to the organization.
  - **Showcase Matching**: Technology capability decks best suited for this account.
  - **Activity Timeline**: Full chronological audit trail of all emails, calls, notes, and pipeline stage movements."""
    },

    "contacts": {
        "title": "Contacts & Executive Stakeholders (/contacts)",
        "keywords": ["contacts", "contact", "decision maker", "stakeholders", "email", "phone", "linkedin"],
        "content": """# Contacts & Executive Stakeholders (/business-development/contacts)

### What is the Contacts Directory?
The executive rolodex tracking individual decision-makers across all target companies.

### Key Capabilities:
- **Decision-Maker Tagging**: Highlight primary budget holders (`is_decision_maker: True`).
- **Direct Launchers**:
  - **Email**: Click to compose personalized outreach drafts via Gmail.
  - **LinkedIn**: Direct link to open the prospect's LinkedIn profile.
  - **WhatsApp & Phone**: Quick communication triggers for mobile touchpoints.
- **Connection Status**: Track whether the individual is *Not Contacted*, *Connection Sent*, *Connected*, *Replied*, or *Meeting Booked*."""
    },

    "opportunities": {
        "title": "Opportunities & Commercial Pipeline (/opportunities)",
        "keywords": ["opportunities", "opportunity", "deals", "pipeline value", "close date", "stages"],
        "content": """# Opportunities & Commercial Pipeline (/business-development/opportunities)

### What are Opportunities?
Opportunities represent potential commercial contracts, pilots, enterprise licenses, or strategic partnerships with assigned monetary values.

### Deal Stages:
1. **Prospecting / Identified**
2. **Qualification & Discovery**
3. **Needs Analysis**
4. **Value Proposition & Showcase Presentation**
5. **Proposal & Price Quote**
6. **Contract Negotiation**
7. **Closed Won (Revenue Recognized)**
8. **Closed Lost (With Reason Logging)**

### Deal Attribution:
Tracks deal values in INR (₹) or USD ($), target close dates, win probabilities, and assigned account owners."""
    },

    "lead_import": {
        "title": "Import Lead List (/leads/import)",
        "keywords": ["lead import", "import", "csv", "excel", "upload", "deduplication"],
        "content": """# Import Lead List (/business-development/leads/import)

### What is Lead Import?
Allows bulk ingestion of prospect lists from CSV or Excel files directly into your campaign and lead tracker databases.

### Key Capabilities:
- **Automated Column Auto-Mapping**: Matches file headers to standard CRM fields (Full Name, Email, Organization, Designation, LinkedIn URL, Focus Area).
- **Intelligent Deduplication**: Checks incoming records against existing emails and company domains to prevent duplicate outreach.
- **Direct Campaign Enrollment**: Optionally assign imported leads directly into an active cold email campaign upon import."""
    },

    "connection_pipeline": {
        "title": "Connection Pipeline Board (/connections)",
        "keywords": ["connection pipeline", "pipeline board", "kanban", "my status", "team status", "toggle button", "dropdown", "pipeline"],
        "content": """# Connection Pipeline Board (/connections)

### What is the Connection Pipeline Board?
The **Connection Pipeline Board** is a visual Kanban board designed to track prospective client and partner organizations as they advance through commercial relationship stages.

### Pipeline Stages:
1. **New / Discovered**: Prospects identified via discovery or manual import.
2. **Cold Outreach Initiated**: Initial outreach email or LinkedIn touchpoint sent.
3. **Responsive / Warm**: The prospect opened, replied, or engaged with outreach.
4. **Discovery Scheduled**: An introductory call or discovery meeting is confirmed.
5. **Proposal / Pitch**: Commercial proposal or capability showcase presented.
6. **Negotiation**: Reviewing pricing, scope, and partnership contracts.
7. **Closed Won / Strategic Partner**: Partnership finalized and contract signed.

### Top Toggle Button & Team Filter:
Located directly at the top header of the Connection Pipeline board:
- **Left Side ("My Status")**: Filters the Kanban board to display only organizations owned and managed by the currently logged-in user (`owner_id = current_user.id`).
- **Right Side ("Team Status")**: Switches the view to organizations across the entire team.
- **Team Member Dropdown (Beside Toggle)**: When in Team Status mode, allows selecting an individual team member to view their dedicated pipeline, or selecting "All Team Members" for the company-wide view.

### Moving Organizations:
You can drag and drop cards between stages, or open an organization detail page to update the stage directly. All stage changes are recorded in the activity audit trail."""
    },

    "lead_tracker": {
        "title": "Outreach Progress Tracker (Lead Tracker) (/lead-tracker)",
        "keywords": ["lead tracker", "outreach tracker", "progress tracker", "checklists", "milestones", "spreadsheet", "grid", "google sheets", "pull sheets", "push sheets"],
        "content": """# Outreach Progress Tracker (/lead-tracker)

### What is the Lead Tracker?
The **Outreach Progress Tracker** is a spreadsheet-like execution grid designed for high-velocity outreach management. It allows BD reps to track granular outreach milestones for every enrolled prospect and synchronizes with Google Sheets.

### Top Header Bar Controls:
1. **Search Bar**: Real-time filtering across lead name, email, company, and focus areas.
2. **Status Filter Dropdown**: Quickly filter leads by their response status (`All Statuses`, `Interested`, `Not Interested`, `Out of Office`, `Meeting Booked`, `Sent`, `Replied`, `Pending`).
3. **Team Progress Button**: Expands a team-wide summary showing completion rates and closed deals per rep.
4. **Manage Team Button**: (Admins & BD users) Add or configure team member accounts.
5. **Pull Sheets**: Fetches the latest updates made directly in the team's shared Google Sheet and updates the database.
6. **Push Sheets**: Pushes all current lead milestones, statuses, and notes into the configured Google Sheet in a single atomic batch write.
7. **Add Lead**: Opens a modal to manually enroll a new prospect into the tracker.

### The 13 Milestone Checklists:
Each lead row features 13 interactive milestone checkboxes:
1. 👋 **LinkedIn Followed**: Prospect's LinkedIn profile followed.
2. 📤 **Connection Sent**: LinkedIn connection request sent.
3. 🤝 **Connection Accepted**: Prospect accepted connection request.
4. 💬 **First Message Sent**: Direct LinkedIn message sent.
5. 💭 **LinkedIn Reply**: Prospect replied on LinkedIn.
6. 📧 **Email Sent**: Cold outreach email delivered.
7. 👁 **Email Opened**: Prospect opened the email.
8. ↩️ **Email Replied**: Prospect replied via email.
9. 📨 **Follow-up #1**: First follow-up sequence step sent.
10. 📩 **Follow-up #2**: Second follow-up sequence step sent.
11. 📬 **Follow-up #3**: Third follow-up sequence step sent.
12. 📅 **Meeting Scheduled**: Discovery or demo meeting booked on calendar.
13. ✅ **Deal Closed**: Partnership or commercial deal successfully closed."""
    },

    "statuses_and_colors": {
        "title": "Lead & Campaign Statuses and Color Coding",
        "keywords": ["status", "statuses", "interested", "not interested", "out of office", "meeting booked", "color code", "badge"],
        "content": """# Lead & Campaign Statuses and Color Coding

### Status Definitions and Color Codes:
Both the Campaign Detail page and the Outreach Progress Tracker use a unified, color-coded status badge system:

1. 🟢 **Interested** (`Emerald Green`):
   - **Meaning**: The prospect has replied positively, showing clear interest in your offerings, partnership, or scheduling a discussion.
   - **Visual**: Glowing emerald green badge (`bg-emerald-500/20 text-emerald-300 border-emerald-500/40`).
   - **Action**: High priority! Follow up immediately or schedule a discovery meeting.

2. 🔴 **Not Interested** (`Rose Red`):
   - **Meaning**: The prospect explicitly stated they are not interested, asked to be removed, or declined the pitch.
   - **Visual**: Rose red badge (`bg-rose-500/20 text-rose-300 border-rose-500/40`).
   - **Action**: Automated sequences are instantly paused for this contact to ensure compliance and avoid spam complaints.

3. 🟠 **Out of Office** (`Amber Orange`):
   - **Meaning**: An automatic out-of-office / vacation response was received.
   - **Visual**: Amber orange badge (`bg-amber-500/20 text-amber-300 border-amber-500/40`).
   - **Action**: The sequence is paused. The lead is flagged for follow-up upon their indicated return date.

4. 🔵 **Meeting Booked** (`Sky Blue`):
   - **Meaning**: A meeting or calendar invitation has been confirmed with the prospect.
   - **Visual**: Vibrant sky blue badge (`bg-sky-500/20 text-sky-300 border-sky-500/40`).
   - **Action**: The "Meeting Scheduled" checklist milestone is automatically marked as completed, and the prospect enters the active meeting pipeline.

5. **Additional Statuses**:
   - `Sent` (Blue): Sequence email has been sent.
   - `Replied` (Violet): Reply received pending intent analysis.
   - `Ready_For_Review` (Purple): AI-generated outreach draft ready for human approval.
   - `Pending` (Slate): Prospect enrolled but first email has not yet been sent."""
    },

    "reply_monitoring_agent": {
        "title": "Autonomous Email Reply Monitoring Agent",
        "keywords": ["reply monitor", "reply agent", "monitor replies", "sentiment", "intent", "auto status", "automatic reply", "inbound email"],
        "content": """# Autonomous Email Reply Monitoring Agent

### How the Reply Monitor Agent Works:
The **Autonomous Reply Classifier Agent** is an embedded intelligence service that continuously monitors inbound email replies received across your campaigns and outreach mailboxes.

### The Agent Workflow:
1. **Detection**: Whenever a prospect replies to an outreach email, the Gmail integration detects the new incoming message thread via real-time webhooks or sync.
2. **Natural Language Analysis**: The agent reads the subject line, email body snippet, and reply sentiment using NLP intent classification.
3. **Intent Categorization**:
   - **Meeting Booked Intent**: Detects scheduling phrases (e.g., "let's talk Tuesday", "booked a time", "accepted invitation", "here is my calendly").
   - **Interested Intent**: Detects positive engagement (e.g., "send over the pitch deck", "sounds interesting", "would love to learn more", "pricing").
   - **Not Interested Intent**: Detects opt-outs and rejections (e.g., "unsubscribe", "not interested", "remove me", "please take us off your list").
   - **Out of Office Intent**: Detects auto-responders (e.g., "out of office", "on annual leave", "limited access to email", "maternity leave").
4. **Automatic Status & Data Synchronization**:
   - Updates the contact's `status` in the database to `Interested`, `Not Interested`, `Out of Office`, or `Meeting Booked`.
   - If `Meeting Booked`, automatically sets `meeting_scheduled = True`.
   - Pauses future sequence follow-ups if the prospect replied or declined.
   - Logs an activity event to the lead's timeline with details of the reply.
   - Automatically synchronizes the new status with your Google Sheet."""
    },

    "campaigns": {
        "title": "Campaigns & Multichannel Sequences (/campaigns)",
        "keywords": ["campaign", "campaigns", "sequence", "steps", "multichannel", "enroll", "target contacts", "roi", "commercial funnel"],
        "content": """# Campaigns & Multichannel Sequences (/campaigns)

### What are Campaigns?
Campaigns allow business development teams to run structured, personalized, multi-step outreach sequences to targeted lists of organizations and contacts.

### Creating and Running a Campaign:
1. Navigate to `/campaigns` and click **New Campaign**.
2. Set the campaign name, target focus/industry, and description.
3. **Define Sequence Steps**: Add touchpoints with custom delay intervals (e.g., Step 1: Initial Pitch -> Wait 3 days -> Step 2: Showcase Deck Follow-up -> Wait 4 days -> Step 3: Break-up Email).
4. **Enroll Target Contacts**: Select prospects from your CRM or import new contacts.
5. **AI Message Personalization**: The system automatically pulls prospect company details, focus areas, and showcase projects to personalize email templates.

### Full-Funnel ROI Dashboard:
On every Campaign Detail page, the top dashboard tracks the complete commercial funnel:
1. **Leads Enrolled**: Total prospect contacts.
2. **Emails Sent**: Successfully delivered emails via connected Gmail accounts.
3. **Emails Opened**: Open tracking count and open rate %.
4. **Replies Received**: Total responses and reply rate %.
5. **Meetings Scheduled**: Booked discovery calls.
6. **Opportunities Created**: Commercial deals opened.
7. **Proposals Sent**: Active proposals submitted.
8. **Won Deals**: Final closed deals and total revenue won (₹)."""
    },

    "showcase": {
        "title": "ELLY Showcase & Pitch Decks (/showcase)",
        "keywords": ["showcase", "projects", "pitch deck", "presentation", "presentation mode", "capabilities"],
        "content": """# ELLY Showcase & Pitch Decks (/business-development/showcase)

### What is the ELLY Showcase?
A digital portfolio of technology solutions, enterprise capabilities, case studies, and pitch decks used during prospect demonstrations.

### Features:
- **Solution Library**: Categorized by technical domain (AI Copilots, Hospital OS, Cloud Intelligence, Automation).
- **Presentation Mode**: Fullscreen, distraction-free slide deck mode for client meetings with keyboard arrow navigation.
- **AI Recommendation Engine**: Ask ELLY can recommend which showcase deck best fits a prospect based on their industry and technology stack."""
    },

    "outreach_and_tracker": {
        "title": "Outreach Workspace & Outreach Tracker (/outreach)",
        "keywords": ["outreach", "outreach workspace", "drafts", "outreach tracker", "deliverability", "gmail sync"],
        "content": """# Outreach Workspace & Outreach Tracker (/business-development/outreach)

### Outreach Workspace (/outreach):
- **Staged AI Drafts**: Generates hyper-personalized cold outreach emails matching recipient interests.
- **Human Review Gate**: Drafts remain in staging until reviewed and approved by a human rep.
- **1-Click Dispatch**: Sends emails via your authenticated Gmail connection with automatic threading.

### Outreach Tracker (/outreach/tracker):
- Real-time monitor of sent outbound volume, email deliveries, opens, clicks, and reply response rates."""
    },

    "meetings_and_demos": {
        "title": "Meetings & Product Demos (/meetings, /demos)",
        "keywords": ["meetings", "demos", "calendar", "active meeting launcher", "talking points", "notes"],
        "content": """# Meetings & Product Demos (/business-development/meetings, /demos)

### Meetings (/meetings):
- View scheduled, upcoming, and past meetings with client stakeholders.
- Tracks meeting platform (Google Meet, Zoom, In-Person), agenda, and outcome notes.

### Active Meeting Launcher:
- When a meeting begins, click **Launch Meeting** for a floating briefing screen:
  - Participant executive summaries & LinkedIn backgrounds.
  - Recommended talking points & relevant showcase deck links.
  - In-meeting notepad with instant post-call follow-up task generation.

### Demos (/demos):
- Dedicated log for technical product demonstrations, sandbox access links, and stakeholder evaluation feedback."""
    },

    "proposals_and_negotiations": {
        "title": "Proposals & Negotiations (/proposals, /negotiations)",
        "keywords": ["proposals", "negotiations", "contracts", "pricing", "quotes", "redline"],
        "content": """# Proposals & Negotiations (/business-development/proposals, /negotiations)

### Proposals (/proposals):
- Generate commercial proposals with versioning (`v1.0`, `v2.0`).
- Specify scope of work, milestone deliverables, license fees, and payment terms in INR (₹) or USD ($).
- Track approval states: *Draft*, *Sent*, *Under Review*, *Accepted*, *Declined*.

### Negotiations (/negotiations):
- Manage active contract deal negotiations.
- Log legal redline comments, pricing discount requests, custom SLA terms, and executive sign-off status."""
    },

    "tasks": {
        "title": "Tasks (/tasks)",
        "keywords": ["tasks", "todo", "kanban", "reminders", "deadlines", "follow-ups", "followups"],
        "content": """# Tasks (/business-development/tasks)

### Tasks (/tasks):
- Kanban and list task board (`Todo`, `In Progress`, `Completed`, `Cancelled`).
- Automated task creation: Triggered when meetings are booked.
- Team member assignment and task comments thread.

### Follow-ups:
- Logged directly on an Organization, Contact, or Meeting detail page — there is no separate Follow-ups page.
- Create one from the "Add Follow-up" action on those detail pages, or ask Ask ELLY to create one.
- Tracks title, due date, priority, and status (`Pending`, `Completed`, `Cancelled`)."""
    },

    "partnerships_and_customers": {
        "title": "Partnerships & Customer Accounts (/partnerships, /customers)",
        "keywords": ["partnerships", "customers", "strategic partners", "clients", "retention", "renewals"],
        "content": """# Partnerships & Customer Accounts (/partnerships, /customers)

### Partnerships (/partnerships):
- Track strategic alliances, integration partners, reseller agreements, and joint Go-To-Market programs.
- Tracks partner tiers (Gold, Silver, Strategic), joint revenue targets, and shared opportunities.

### Customers (/customers):
- Converted client accounts post-contract closure.
- Tracks contract start/renewal dates, monthly recurring revenue, client health scores, and account manager assignments."""
    },

    "analytics": {
        "title": "Analytics & Visualizations (/analytics)",
        "keywords": ["analytics", "charts", "conversion rates", "roi", "performance"],
        "content": """# Analytics & Visualizations (/analytics)

### Analytics (/analytics):
- Interactive visual charts:
  - Lead conversion velocity by stage.
  - Win/Loss ratio analysis by deal size and industry.
  - Outreach channel efficacy (Email vs LinkedIn vs Phone).
  - Rep performance and activity leaderboards."""
    },

    "calendar_and_map": {
        "title": "Calendar & Interactive Map (/calendar, /map)",
        "keywords": ["calendar", "map", "geocoding", "locations", "schedule", "events"],
        "content": """# Calendar & Interactive Map (/business-development/calendar, /map)

### Calendar View (/calendar):
- Unified monthly/weekly calendar aggregating client meetings, proposal deadlines, follow-up touchpoints, and sequence send dates.

### Map View (/map):
- Geographic distribution map of all target organizations, active clients, and partners plotted by city and country using geocoding."""
    },

    "communications": {
        "title": "Communications Log (/communications)",
        "keywords": ["communications", "messages", "email log", "call log", "whatsapp log", "activity"],
        "content": """# Communications Log (/business-development/communications)

### What is the Communications Log?
A unified chronological feed capturing all omnichannel touchpoints with prospects:
- Outbound & inbound Gmail email threads.
- Phone calls and meeting notes.
- LinkedIn InMail messages and responses.
- WhatsApp business interactions."""
    },

    "admin_console": {
        "title": "Governance & Admin Console (/admin)",
        "keywords": ["admin", "governance", "settings", "audit logs", "users", "knowledge base", "team"],
        "content": """# Governance & Admin Console (/admin)

*Accessible only by users with the `ADMIN` role.*

### Administrative Modules:
1. **Admin Dashboard (/admin)**: System health, active users, storage, and API usage stats.
2. **User Management (/admin/users)**: Create, edit, and deactivate users; assign roles (`ADMIN`, `BUSINESS_DEVELOPMENT`, `VIEWER`).
3. **Team Management (/admin/team)**: Team assignment, quota definitions, and territory assignments.
4. **Knowledge Base (/admin/knowledge-base)**: Upload company playbooks, pricing docs, and compliance manuals to ground Ask ELLY's reasoning.
5. **Audit Logs (/admin/audit-logs)**: Immutable security logs tracking all logins, data exports, stage updates, and administrative changes.
6. **System Settings (/admin/settings)**: Configure API keys (Groq, Gemini, NVIDIA, Serper, Tavily), Gmail OAuth credentials, and Google Sheets IDs."""
    },

    "ask_elly_copilot": {
        "title": "Ask ELLY Autonomous AI Copilot",
        "keywords": ["ask elly", "copilot", "ai", "drawer", "chat", "groq", "gemini", "nim", "confirmation", "user manual button"],
        "content": """# Ask ELLY Autonomous AI Copilot

### What is Ask ELLY?
**ELLY** is an autonomous Business Development AI partner available from the bottom-right corner of any screen. ELLY leverages a multi-model architecture (Groq for ultra-fast reasoning, Google Gemini for deep research, and NVIDIA NIM for synthesis).

### Capabilities:
- **Prospect & Market Research**: Research companies, find decision-makers, and generate 360° account dossiers.
- **Outreach Draft Generation**: Prepare personalized cold outreach emails matching showcase capability decks.
- **Pipeline Intelligence**: Summarize deals in negotiation, overdue tasks, and daily priorities.
- **Deliverability & Signals**: Surface high-intent buying signals and mailbox health warnings.

### Safe 1-Click Confirmation Write-Gates:
To guarantee safety and prevent unintended modifications, ELLY **never directly executes destructive or write actions without your confirmation**. When you ask ELLY to:
- Move an organization's stage
- Schedule or create a meeting
- Create a follow-up task
ELLY presents a formatted **Confirm / Cancel action card**. The action only executes when you click the confirmation button.

### User Manual Button & Verbatim Policy:
- **User Manual Button**: Located at the top header of the Ask ELLY drawer (look for the **User Manual** button with the book icon). Clicking this button opens the complete, searchable documentation at any time.
- **Verbatim Policy**: When you ask ELLY questions like *"how to use [feature]"* or *"what is this feature"*, ELLY does not guess or generate hallucinated answers. Instead, ELLY retrieves the exact, official text from the User Manual and presents it to you as it is."""
    },

    "gmail_and_deliverability": {
        "title": "Gmail Integration & Deliverability Health",
        "keywords": ["gmail", "deliverability", "health score", "bounce rate", "reply rate", "warmup", "mailbox", "oauth"],
        "content": """# Gmail Integration & Deliverability Health (/outreach/gmail)

### Setting Up Gmail:
1. Navigate to `/outreach/gmail` or `/admin/settings`.
2. Connect your Google Workspace or Gmail account via secure OAuth 2.0.
3. Verify sending limits and domain authentication (SPF, DKIM, DMARC).

### Deliverability Health Monitoring:
The platform actively monitors sending reputation for each connected mailbox:
- **Healthy (90-100)**: Bounce rate < 2%, reply rate > 10%. All automated sends operate normally.
- **At Risk (70-89)**: Elevated bounce rates detected. The system throttles daily sending limits automatically.
- **Critical (< 70)**: High bounce rate or spam flag danger. Outbound sending is temporarily paused to protect domain reputation."""
    }
}


def get_full_user_manual() -> str:
    """Returns the entire User Manual formatted in clean Markdown."""
    sections_text = []
    sections_text.append("# Business Development Management OS — Official User Manual\n")
    sections_text.append("> Complete documentation for the Business Development OS, including Pipeline Kanban, Lead Tracker, Campaigns, Email Reply Automation, CRM, Governance, and Ask ELLY Copilot.\n\n---\n")

    for key, data in USER_MANUAL_SECTIONS.items():
        sections_text.append(data["content"].strip())
        sections_text.append("\n\n---\n")

    return "\n".join(sections_text)


def is_user_manual_query(message: str) -> bool:
    """
    Detects if the user's message is asking for documentation, usage instructions,
    or feature explanations where verbatim User Manual content must be provided.
    """
    msg = message.lower().strip()

    patterns = [
        r"\bhow\s+(?:to|do\s+i|can\s+i)\s+(?:use|work|operate|navigate|filter|access|do)\b",
        r"\bwhat\s+is\s+(?:this|the|a)?\s*(?:feature|tab|pipeline|tracker|lead\s+tracker|kanban|campaign|status|elly|manual|color|toggle|dashboard|discover|contact|opportunity|showcase|proposal|negotiation|task|partnership|customer|report|analytic|calendar|map|audit|admin)\b",
        r"\bhow\s+does\s+(?:this|the|it)\s+work\b",
        r"\bhow\s+do\s+we\s+use\b",
        r"\buser\s+manual\b",
        r"\bdocumentation\b",
        r"\bexplain\s+(?:the\s+)?(?:feature|tab|pipeline|lead\s+tracker|campaign|reply\s+monitor|status|color|showcase|proposal)\b",
        r"\bwhat\s+are\s+the\s+(?:features|tabs|statuses|milestones|checkboxes|steps|stages)\b",
        r"\bhow\s+to\s+filter\b",
        r"\bhelp\s+me\s+understand\b",
        r"\btell\s+me\s+about\s+(?:the\s+)?(?:feature|tab|pipeline|lead\s+tracker|campaign|manual|dashboard|crm)\b",
    ]

    for p in patterns:
        if re.search(p, msg):
            return True

    return False


def lookup_user_manual_section(query: str) -> str:
    """
    Finds the most relevant section of the User Manual matching the query,
    and returns the verbatim content from the User Manual without LLM generation.
    """
    q = query.lower()

    best_section = None
    max_score = 0

    for key, data in USER_MANUAL_SECTIONS.items():
        score = 0
        for kw in data["keywords"]:
            if kw in q:
                score += len(kw) * 2

        for word in data["title"].lower().split():
            if len(word) > 3 and word in q:
                score += 3

        if score > max_score:
            max_score = score
            best_section = key

    if best_section and max_score > 0:
        section_data = USER_MANUAL_SECTIONS[best_section]
        verbatim_content = section_data["content"].strip()
        return (
            f"📖 **Official User Manual — {section_data['title']}**\n\n"
            f"{verbatim_content}\n\n"
            f"---\n"
            f"*Tip: You can open the complete User Manual anytime by clicking the **User Manual** button in the header of the Ask ELLY panel.*"
        )

    overview = USER_MANUAL_SECTIONS["system_overview"]["content"].strip()
    return (
        f"📖 **Official User Manual**\n\n"
        f"{overview}\n\n"
        f"### Available User Manual Chapters:\n"
        f"- **1. System Overview & Architecture**\n"
        f"- **2. Executive Dashboard** (`/business-development`)\n"
        f"- **3. Find Organizations & Discovery** (`/discover`)\n"
        f"- **4. Organizations Directory** (`/organizations`)\n"
        f"- **5. Contacts Directory** (`/contacts`)\n"
        f"- **6. Opportunities & Commercial Deals** (`/opportunities`)\n"
        f"- **7. Import Lead List** (`/leads/import`)\n"
        f"- **8. Connection Pipeline Board** (My Status vs Team Status toggle, 7 Kanban stages)\n"
        f"- **9. Outreach Progress Tracker (Lead Tracker)** (13 milestone checklists, Google Sheets sync)\n"
        f"- **10. Lead & Campaign Statuses & Color Codes** (Interested, Not Interested, Out of Office, Meeting Booked)\n"
        f"- **11. Autonomous Email Reply Monitoring Agent** (NLP intent classification)\n"
        f"- **12. Campaigns & Sequences** (Multichannel outreach, full-funnel ROI)\n"
        f"- **13. ELLY Showcase & Pitch Decks** (`/showcase` Presentation Mode)\n"
        f"- **14. Outreach Workspace & Outreach Tracker** (`/outreach`)\n"
        f"- **15. Meetings & Demos** (Active Meeting Launcher)\n"
        f"- **16. Proposals & Contract Negotiations** (`/proposals`, `/negotiations`)\n"
        f"- **17. Tasks** (`/tasks`)\n"
        f"- **18. Partnerships & Customer Accounts** (`/partnerships`, `/customers`)\n"
        f"- **19. Analytics & Visualizations** (`/analytics`)\n"
        f"- **20. Calendar & Interactive Map** (`/calendar`, `/map`)\n"
        f"- **21. Omnichannel Communications Log** (`/communications`)\n"
        f"- **22. Governance & Admin Console** (`/admin`)\n"
        f"- **23. Ask ELLY Autonomous AI Copilot** (Multi-model reasoning, safe confirmation write-gates)\n"
        f"- **24. Gmail Integration & Deliverability Health**\n\n"
        f"---\n"
        f"*Tip: You can click the **User Manual** button at the top of this panel to view the complete guide.*"
    )
