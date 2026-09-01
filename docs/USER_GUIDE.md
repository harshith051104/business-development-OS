# ELLY Business Development Portal — User Guide

> Internal portal for healthcare BD teams. Manages the full lifecycle: find organizations → build relationships → close partnerships.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Finding Organizations (Discovery)](#3-finding-organizations-discovery)
4. [Connections Pipeline](#4-connections-pipeline)
5. [Organizations](#5-organizations)
6. [Contacts](#6-contacts)
7. [Meetings](#7-meetings)
8. [Follow-ups](#8-follow-ups)
9. [Opportunities](#9-opportunities)
10. [Communications](#10-communications)
11. [Outreach & Email](#11-outreach--email)
12. [Calls](#12-calls)
13. [Showcase (Project Presentations)](#13-showcase-project-presentations)
14. [Demos](#14-demos)
15. [Proposals](#15-proposals)
16. [Negotiations](#16-negotiations)
17. [Tasks](#17-tasks)
18. [Partnerships](#18-partnerships)
19. [Customers](#19-customers)
20. [Reports & Analytics](#20-reports--analytics)
21. [ELLY Copilot (AI Assistant)](#21-elly-copilot-ai-assistant)
22. [Admin Console](#22-admin-console)
23. [CSV Import / Export](#23-csv-import--export)
24. [FAQ](#24-faq)

---

## 1. Getting Started

### Logging In

1. Open the portal URL in your browser
2. Enter your **email** and **password**
3. Click **Sign In**

You'll be redirected to the **Dashboard** — your home screen.

### Understanding Your Role

| Role | Access |
|------|--------|
| **Admin** | Everything + user management, audit logs, settings |
| **BD Leader** | Full BD access — all modules, analytics, reports |
| **BD Executive** | Core BD — organizations, contacts, meetings, tasks |

### Sidebar Navigation

The left sidebar has 4 sections:

- **Target Discovery & CRM** — Dashboard, Find Organizations, Organizations, Contacts, Opportunities
- **Outreach & Presentations** — Showcase, Emails, Calls, Meetings, Demos
- **Commercial Deals & Accounts** — Proposals, Negotiations, Follow-ups, Tasks, Partnerships, Customers, Reports
- **Governance** (Admin only) — Admin Console

---

## 2. Dashboard

**Route:** `/business-development`

Your daily command center. Shows everything at a glance.

### What You See

| Section | What It Shows |
|---------|---------------|
| **Daily Priorities** | AI-ranked list of what to do today — overdue follow-ups, stale deals, upcoming meetings. Each card shows the problem and recommended action. |
| **Summary Cards** | 7 numbers: Organizations, Contacts, Connections, Interested, Meetings, Active Discussions, Partnerships |
| **Connection Pipeline** | Horizontal bar showing how many orgs are at each stage (Potential → Partnership) |
| **Today's Activities** | Calls, meetings, and tasks scheduled for today with status (Completed/Pending) |
| **Upcoming Meetings** | Next meetings with date, time, org, and contact |
| **Follow-ups** | Three columns — Overdue (red), Today (amber), Upcoming (violet) |
| **Recent Communications** | Last 5 emails/calls/LinkedIn messages with channel and direction |
| **Activity Feed** | Timeline of recent actions across the system |
| **Quick Actions** | Shortcuts to common tasks — Add Org, Add Contact, Record Communication |

### Refreshing Data

Click the **Refresh Dashboard** button (top right) to pull latest data.

---

## 3. Finding Organizations (Discovery)

**Route:** `/business-development/discover`

AI-powered lead discovery. Searches the internet for healthcare organizations that match your criteria.

### How Discovery Works

**Step 1: Set Your Search Criteria**

The form has 3 tiers:

| Field | What to Enter | Example |
|-------|---------------|---------|
| **Product Description** | What your company offers | "AI-powered healthcare platform for digital workflows" |
| **Target ICP** | Who you're looking for | "Large hospitals and hospital groups interested in digital transformation" |
| **Discovery Objective** | Why you're reaching out | "Technology partnership" or "Product showcase" |

**Step 2: Set Filters**

| Filter | Options |
|--------|---------|
| **Keyword / Name** | Search by org name (e.g., "Apollo", "Mayo") |
| **Location / City** | Country or city (e.g., "USA", "Hyderabad", "London") |
| **Organization Type** | Hospital, Hospital Group, Clinic, Diagnostic Center, Healthcare Technology Company, Pharmaceutical Company, etc. |
| **Data Source** | Multi-Source Discovery (Recommended), Tavily Web Search, Serper Google Search, Curated Healthcare Directory |

**Step 3: Click "Start Discovery"**

### Understanding Results

Each result card shows:

| Field | Meaning |
|-------|---------|
| **Org Name** | Organization name extracted from web |
| **Type** | Hospital, Health Tech, Pharma, etc. |
| **Location** | Country and city |
| **Fit Level** | High / Medium / Low — AI-scored match to your ICP |
| **Fit Score** | 0-100 percentage |
| **Qualification Reason** | Why the AI scored it this way |
| **Source** | Where the data came from (Tavily, Serper, Directory) |

### What You Can Do With Results

| Action | What Happens |
|--------|--------------|
| **Save** | Bookmarks the lead for later review |
| **Skip** | Dismisses the lead from view |
| **View** | Opens detailed profile with contact discovery |
| **Add to ELLY** | Creates an Organization + Contacts in the CRM |

### Adding to CRM

When you click **Add to ELLY**:

1. **Duplicate Check** — system warns if an org with the same name/website already exists
2. **Set Priority** — High / Medium / Low
3. **Add Notes** — Internal sourcing notes (e.g., "Found via Tavily, warm intro available")
4. **Confirm** — Creates the Organization record and imports selected contacts

### Data Sources Explained

| Source | How It Works |
|--------|-------------|
| **Multi-Source Discovery** | Tries Directory first (fast), then Tavily, then Serper if no results |
| **Tavily Web Search** | Real-time web search via Tavily API — finds orgs globally |
| **Serper Google Search** | Google search results via Serper API — broadest coverage |
| **Curated Healthcare Directory** | Pre-loaded Indian healthcare orgs — instant, no API calls |

**Caching:** Same search within 1 hour returns cached results instantly — no API waste.

### Saved Bookmarks Tab

View all organizations you bookmarked. Click to open the detail page and add to CRM.

### Search History Tab

View all past searches — keyword, location, type, objective, results count, date.

---

## 4. Connections Pipeline

**Route:** `/business-development/connections`

Visual Kanban board showing all organizations across 7 stages.

### The 7 Stages

| Stage | Color | Meaning |
|-------|-------|---------|
| **Potential** | Blue | Identified but not yet contacted |
| **Contacted** | Cyan | Outreach initiated |
| **Connected** | Teal | Engaged in conversation |
| **Interested** | Amber | Active interest shown |
| **Meeting** | Purple | Presentation/demo scheduled |
| **Discussion** | Indigo | Partnership terms under discussion |
| **Partnership** | Violet | Deal closed, partnership active |

### Moving Organizations Between Stages

**Drag and Drop:**
1. Grab the card by the drag handle (⋮⋮ icon)
2. Drag to the target stage column
3. Drop — a confirmation modal appears
4. Add an optional note (e.g., "Had great call with CTO")
5. Click **Confirm Move**

**Dropdown (Accessibility):**
Click the stage selector on any card and pick the target stage.

### Filtering

- **Search** — type an org name to find it quickly
- **Priority** — filter by High / Medium / Low

---

## 5. Organizations

**Route:** `/business-development/organizations`

Your CRM database of all healthcare organizations.

### Viewing Organizations

**Table View** — spreadsheet-style rows with columns: Name, Type, Location, Priority, Status, Updated

**Card View** — 3-column grid with org cards

Toggle between views with the Table/Cards button.

### Filtering & Sorting

| Filter | Options |
|--------|---------|
| **Search** | Name, city, state, type, industry |
| **Organization Type** | 14 types (Hospital, Clinic, Pharma, etc.) |
| **Connection Status** | Any of the 7 pipeline stages |
| **Priority** | High / Medium / Low |
| **Sort** | Newest, Oldest, Name A-Z, Name Z-A, Priority, Recently Updated |

### Organization Detail Page

Click any org to see its full profile:

**Header:** Name, type, priority, status, location, created date

**Action Buttons:**
- **Start Outreach** — opens the outreach composer
- **Schedule Meeting** — opens meeting form
- **Add Follow-up** — creates a follow-up task
- **Showcase** — view/share project presentations
- **Change Status** — move to different pipeline stage
- **Edit** — modify org details

**Detail Sections:**
- **Associated Contacts** — all contacts at this org
- **Meetings** — scheduled and past meetings
- **Follow-ups** — pending and completed follow-ups
- **Active Opportunities** — deals in progress
- **Partnerships** — established partnerships
- **Notes** — internal notes
- **Relationship Timeline** — chronological history of all interactions

### Adding a New Organization

Click **+ Add Organization** and fill:
- Name, Type, Website, Email, Phone
- Address, City, State, Country
- Priority, Notes

---

## 6. Contacts

**Route:** `/business-development/contacts`

Individual people — directors, partners, decision-makers.

### Viewing Contacts

**Table View** — Name, Email, Organization, Title, Decision Maker, Status, Priority

**Card View** — Contact info cards

### Filtering

| Filter | Options |
|--------|---------|
| **Search** | Name, email, organization |
| **Organization** | Filter by specific org |
| **Decision Maker** | Yes / No |
| **Status** | Not Contacted, Contacted, Connected, Interested, Inactive |
| **Department** | Filter by department |

### Contact Detail Page

Full profile: name, title, email, phone, LinkedIn, organization, department, notes, status.

**Actions:** Change status, Edit, Delete

---

## 7. Meetings

**Route:** `/business-development/meetings`

Schedule and track all meetings with organizations.

### Meeting Types

| Type | Use For |
|------|---------|
| **Introduction** | First contact meeting |
| **Project Showcase** | Demo your solutions |
| **Business Discussion** | Terms, pricing, scope |
| **Partnership Discussion** | Strategic alignment |
| **Technical Discussion** | Deep-dive with technical teams |
| **Follow-up** | Catch-up after previous meeting |

### Logging a Meeting

Click **Schedule Meeting** and fill:
- Title, Type, Organization, Contact
- Date & Time, Duration
- Location / Video link
- Notes, Expected Outcome

### Completing a Meeting

Click **Complete** on any scheduled meeting:
- Add outcome notes
- Set next steps
- Auto-create follow-up if needed

---

## 8. Follow-ups

**Route:** `/business-development/followups`

Never let a lead go cold. Tracks all follow-up tasks.

### Tabs

| Tab | Shows |
|-----|-------|
| **All** | Everything |
| **Overdue** | Past due — needs immediate attention (red) |
| **Today** | Due today (amber) |
| **Upcoming** | Due in the future (violet) |
| **Completed** | Finished follow-ups |

### Adding a Follow-up

Click **Add Follow-up** and fill:
- Organization, Contact
- Reason (e.g., "Send proposal", "Check decision timeline")
- Due Date, Priority (High/Medium/Low)

### Completing a Follow-up

Click **Complete** — marks as done and logs the activity.

---

## 9. Opportunities

**Route:** `/business-development/opportunities`

Track potential deals and their progression.

### Opportunity Fields

| Field | Description |
|-------|-------------|
| **Title** | Deal name |
| **Organization** | Target org |
| **Contact** | Primary contact |
| **Stage** | Current pipeline stage |
| **Priority** | High / Medium / Low |
| **Estimated Value** | Deal value in currency |
| **Expected Close Date** | When you expect to close |
| **Next Action** | What needs to happen next |

### Filtering

- Search by title or organization
- Filter by stage, priority
- Toggle "No Next Action" to find stalled deals

### Stage Changes

Click **Change Stage** to move an opportunity through the pipeline. Add a note explaining the reason.

---

## 10. Communications

**Route:** `/business-development/communications`

Log every email, call, LinkedIn message, WhatsApp conversation.

### Communication Channels

Email, Phone, LinkedIn, WhatsApp, Meeting, Video Call, In Person, Other

### Logging a Communication

Click **Record Communication** and fill:
- Organization, Contact
- Channel (Email/Phone/LinkedIn/etc.)
- Direction (Outgoing/Incoming)
- Subject, Content/Notes
- Date
- Link to related Opportunity (optional)

### Filtering

- Search by subject, org, or contact
- Filter by channel, direction, date range
- Channel counts shown as badges

---

## 11. Outreach & Email

**Route:** `/business-development/outreach`

Multi-step outreach composer for sending emails and messages.

### How It Works

**Step 1:** Select Organization
**Step 2:** Select Contact
**Step 3:** Choose Channel — Email, Phone, LinkedIn, WhatsApp
**Step 4:** Compose Message
- Pick from pre-built templates
- AI generates message suggestions
- Add subject line and body
**Step 5:** Preview & Send
- Review the message
- **Save as Draft** or **Mark as Sent**

### Outreach Drafts

View all drafts at `/business-development/outreach/drafts`. Edit, send, or delete.

---

## 12. Calls

**Route:** `/business-development/calls`

Log phone calls with outcomes.

### Call Outcomes

| Outcome | Meaning |
|---------|---------|
| Interested | Showed interest |
| Meeting Requested | Wants to schedule a meeting |
| Demo Requested | Wants to see a demo |
| Callback | Call back later |
| Connected | Reached but no specific outcome |
| No Answer | Didn't pick up |
| Not Interested | Declined |

### Logging a Call

Click **Log Phone Call** and fill:
- Organization, Contact
- Subject, Outcome
- Duration, Notes
- Next Action
- ☑ **Auto-create follow-up** — automatically creates a follow-up task

---

## 13. Showcase (Project Presentations)

**Route:** `/business-development/showcase`

Your project portfolio for client presentations.

### Viewing Projects

Filter by:
- **Category** — Healthcare, AI, Communication, Automation, Data Science, Business
- **Status** — Active / Archived
- **Tags** — filter by specific tags

### Presenting a Project

1. Open a project
2. Click **Launch Presentation**
3. Full-screen slide-by-slide walkthrough
4. Use for client demos and meetings

---

## 14. Demos

**Route:** `/business-development/demos`

Schedule and track product demonstrations.

### Scheduling a Demo

Click **Schedule Demo** and fill:
- Title, Date/Time
- Participants (internal + external)
- Customer Requirements

### Demo Outcomes

After a demo, mark it as Completed and record the outcome (Interested, Proposal Requested, Follow-up Needed, etc.)

---

## 15. Proposals

**Route:** `/business-development/proposals`

Create and track commercial proposals.

### Proposal Stages

Draft → Sent → Under Discussion → Accepted / Rejected

### Creating a Proposal

Click **Generate Proposal** and fill:
- Title, Organization
- Value (currency), Version
- Scope / Summary
- Commercial Terms

---

## 16. Negotiations

**Route:** `/business-development/negotiations`

Track contract negotiations.

### Negotiation Stages

Active → Terms Proposed → Legal Review → Agreed / Blocked

### Key Fields

- Commercial Value
- Key Contract Terms
- Open Discussion Points (issues to resolve)
- Next Action

---

## 17. Tasks

**Route:** `/business-development/tasks`

BD task management — things that don't fit other modules.

### Task Status

Todo → In Progress → Completed

### Creating a Task

Click **New BD Task** and fill:
- Title, Description
- Priority (High/Medium/Low)
- Due Date

Check the checkbox to mark complete.

---

## 18. Partnerships

**Route:** `/business-development/partnerships`

Track formal partnerships and agreements.

### Partnership Types

Technology, Platform, Strategic, Integration, Channel

### Partnership Status

Active, Pending, Renewal Due, Expired

### Key Fields

- Value, Start/End Dates
- Key Terms, SLA Details
- Notes

---

## 19. Customers

**Route:** `/business-development/customers`

Post-sale customer accounts.

### Account Health

| Status | Meaning |
|--------|---------|
| Excellent | Thriving, expansion opportunity |
| Good | Stable, on track |
| Needs Attention | Risk of churn |
| Critical | Immediate action needed |

### Key Fields

- Contract Value, Currency
- Start Date, Renewal Date
- Account Health, Status (Active, Renewal Pending, At Risk, Churned)

---

## 20. Reports & Analytics

### Analytics Page

**Route:** `/business-development/analytics`

Full analytics dashboard with:

| Section | What It Shows |
|---------|---------------|
| **8 Metric Cards** | Organizations, Contacts, Connections, Interested, Meetings, Discussions, Opportunities, Partnerships |
| **Attention Required** | Action bottlenecks and stale deals |
| **Pipeline Funnel** | Visual funnel chart of 7 stages |
| **Conversion Rates** | Stage-to-stage transition percentages |
| **Meeting Velocity** | Completed/Scheduled/Rescheduled/Cancelled |
| **Follow-up Discipline** | Completed/Pending/Overdue rates |
| **Pipeline Financial Value** | Total estimated deal value |
| **Communication Activity** | Channel-wise breakdown |
| **Top Opportunities** | High-priority active deals table |
| **Team Activity** | Per-user performance metrics |

**Date Range:** This Month, Today, This Week, Last Month, Last 3 Months, This Year, All Time

**Export:** Click **Export CSV** to download analytics data.

### Reports Page

**Route:** `/business-development/reports`

10-stage commercial funnel with:
- Total Pipeline Value
- Stage-by-stage deal counts and values
- Average days in each stage
- Conversion rates
- Lead source distribution
- Team execution metrics

---

## 21. ELLY Copilot (AI Assistant)

The floating **"Ask ELLY"** button (bottom-right) opens the AI copilot.

### What ELLY Can Do

| Ask About | Example |
|-----------|---------|
| **Organization info** | "Tell me about Apollo Hospitals" |
| **Pipeline status** | "Show my high-priority opportunities" |
| **Meeting prep** | "Prepare me for my meeting with Max Healthcare" |
| **Contact lookup** | "Who is the CTO at Fortis?" |
| **Stage movement** | "Move Narayana Health to Interested stage" |
| **Activity logging** | "Log a call with Manipal Hospitals" |
| **Funnel reports** | "Show conversion rates this month" |
| **Dashboard summary** | "What needs my attention today?" |

### Context-Aware

ELLY automatically detects what page you're on:
- On an **Organization page** → ELLY knows which org you're viewing
- On a **Contact page** → ELLY knows which contact
- On an **Opportunity page** → ELLY knows the deal

### Write Actions (Safe)

When ELLY suggests a write action (move stage, log call, etc.):

1. **Review** the proposed change
2. Click **Approve & Execute** to confirm
3. Or **Reject** to cancel

Nothing happens without your approval.

### Chat Features

- **Markdown rendering** — headers, bold, lists, code blocks
- **Pipeline stage badges** — color-coded stage indicators
- **Suggested follow-ups** — clickable pills for quick questions
- **Tool execution display** — see what tools ELLY used
- **Data reference chips** — clickable links to related records

---

## 22. Admin Console

**Route:** `/admin` (Admin role only)

### Admin Dashboard

Stats: Total Users, Active Users, Organizations, Opportunities, Partnerships, Showcase Projects

### User Management

- **Create users:** Name, Email, Password, Role (ADMIN/BD_LEADER/BD_EXECUTIVE)
- **View users:** List with name, email, role, status, last login
- **Edit/Deactivate:** Modify user accounts

### Team Allocation

View team members, their assigned organizations, and performance metrics.

### Audit Logs

Full trail of system actions: timestamp, user, action, entity type, entity ID, details. Filter by user, action type, date range.

### Settings

System configuration: notification settings, default values, integration configs.

---

## 23. CSV Import / Export

### Importing Organizations

1. Go to **Find Organizations**
2. Click **Import CSV**
3. Upload your CSV file with columns: name, organization_type, website, email, phone, city, etc.
4. **Preview** — system validates each row, shows errors, detects duplicates
5. **Execute** — imports valid rows into Discovered Organizations

### Exporting Data

- **Discovery Export:** Go to Find Organizations → **Export CSV** — downloads all discovered leads
- **Analytics Export:** Go to Analytics → **Export CSV** — downloads analytics data
- **Opportunities Export:** Go to Opportunities → export option available

---

## 24. FAQ

### Q: Why are some search results showing empty fields?

Web search (Tavily/Serper) returns articles, not company profiles. The system extracts what it can — name from URL, phone from page content. Some fields may be empty if the website doesn't expose them. Use the **"Add to ELLY"** flow to manually fill missing data.

### Q: How does caching work?

Same search within 1 hour returns cached results instantly. No API calls wasted. Cache resets after 1 hour.

### Q: Can I disable web scraping?

Yes. Set `SCRAPEGRAPH_ENABLED = False` in `backend/.env`. Searches will still work — just without deep page scraping.

### Q: How do I change an organization's pipeline stage?

**Option 1:** Go to the Connections board → drag the card to the new stage
**Option 2:** Open the org detail page → click **Change Status**
**Option 3:** Ask ELLY copilot → "Move [org] to [stage]"

### Q: What's the difference between Discovery and Organizations?

**Discovery** = finding new leads from the internet. **Organizations** = your CRM database. You discover leads first, then add the best ones to your CRM.

### Q: How do I add a contact who's a decision-maker?

Open the org detail page → find the contact → toggle the **Decision Maker** badge. Or create a new contact with the Decision Maker checkbox enabled.

### Q: Can I customize the outreach templates?

Go to **Outreach** → the template selector shows pre-built templates. Select one and edit the content before sending.

### Q: How does the AI copilot decide what to suggest?

ELLY uses your CRM data, current page context, and conversation history. It suggests actions based on pipeline stage, overdue items, and recent activity.

### Q: What currencies are supported?

INR, USD, EUR, GBP, JPY, AUD, CAD, SGD, AED, SAR, ZAR, BRL, MXN, KRW, CNY. Default is USD.

### Q: How do I get help?

Type "help" in the ELLY copilot, or contact your system administrator.
