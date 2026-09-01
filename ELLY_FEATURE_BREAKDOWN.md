# ELLY BD OS - Feature Breakdown

## 1. Discovery & Lead Generation
Finds new potential clients from the web.

- **Web Search** - Search companies by keyword, location, industry via Tavily/Serper/Directory
- **Multi-Source Discovery** - Searches providers in order, stops when enough results found
- **Auto-Save to CRM** - Discovered orgs automatically saved to Organizations page
- **Auto-Contact Discovery** - Finds decision-makers (CEO, CTO, VP) for each discovered org
- **Contact Enrichment** - Enriches contacts with email, phone, LinkedIn via web search
- **Quality Filter** - Skips contacts with no reachable info (email/phone/LinkedIn)
- **AI Qualification** - Scores each lead (High/Medium/Low) based on fit to your ICP
- **Research Brief** - Scrapes company website, generates business intelligence report
- **Discovery Analytics** - Tracks leads by source, qualification scores, conversion rates

**User flow:** Search > Auto-save to CRM > Auto-find contacts > Enrich with email/phone/LinkedIn

---

## 2. Organizations (CRM)
Manage all companies in your pipeline.

- **Organization Profile** - Name, industry, location, website, size, status, priority
- **Auto-Save from Discovery** - Leads auto-promoted from discovery to CRM
- **Duplicate Detection** - Prevents re-adding existing organizations
- **Pipeline Stages** - Potential > Contacted > Connected > Partner
- **Status Tracking** - Visual badges for connection status
- **Priority Scoring** - High/Medium/Low with color coding
- **Map View** - Geographic visualization of all organizations
- **Timeline** - Chronological history of all interactions
- **Search & Filter** - By keyword, location, industry, status, priority
- **Bulk Import** - Add multiple organizations at once

**User flow:** Search > Auto-saved to CRM > Track through pipeline

---

## 3. Contacts
Manage people at each organization.

- **Contact Profile** - Name, role, department, email, phone, LinkedIn
- **Auto-Discovery** - Contacts found automatically during org discovery
- **Web Enrichment** - Email, phone, LinkedIn searched from public web sources
- **Decision Maker Flag** - Mark C-suite and key stakeholders
- **Primary Contact** - Mark main point of contact
- **Connection Status** - Not Contacted > Contacted > Connected > Engaged
- **Organization Link** - Tied to parent organization
- **Follow-up Tracking** - Next follow-up date, last contacted date

**User flow:** Org discovered > Contacts auto-found > Enriched with email/phone/LinkedIn > Ready for outreach

---

## 4. ELLY Showcase
Portfolio of your projects/products to show prospects.

- **Project Gallery** - Visual cards with project details
- **Project Detail** - Description, tech stack, outcomes, screenshots
- **Presentation Mode** - Full-screen slideshow for meetings
- **Category Filtering** - Filter by industry, technology, use case

**User flow:** Create project > Present during meetings > Impress prospects

---

## 5. Campaigns & Outreach
Multi-step email sequences to prospects.

- **Campaign Creation** - Name, description, target industry
- **Sequence Steps** - 4-step default: Initial > Follow-up > Value > Final
- **AI Email Generation** - Personalized emails per contact using research
- **Contact Enrollment** - Add multiple contacts to a campaign
- **Email Review** - Edit generated emails before sending
- **Send via Gmail** - Real emails sent through connected Gmail account
- **Reply Detection** - Auto-pauses sequence when prospect replies
- **Campaign ROI** - Full funnel: Sent > Opened > Replied > Meeting > Won

**User flow:** Create campaign > Add contacts > Review emails > Send > Track replies

---

## 6. Outreach Workspace
Central hub for all email activity.

- **Gmail Setup** - OAuth connection to your Gmail account
- **Draft Management** - View all pending outreach drafts
- **Inbox Sync** - Poll Gmail for replies
- **Thread Tracking** - Link emails to campaigns and contacts

**User flow:** Connect Gmail > Review drafts > Monitor replies

---

## 7. Meetings
Schedule and prepare for meetings.

- **Meeting Calendar** - View all scheduled meetings
- **Meeting Prep** - Auto-generated dossier: past interactions, opportunities, talking points
- **Meeting Notes** - Record notes during/after meetings
- **Action Items** - Extract tasks from meeting notes
- **Linked Contacts** - Which organization/contact the meeting is with

**User flow:** Schedule meeting > Get prep briefing > Attend > Log notes > Create follow-ups

---

## 8. Follow-ups
Never let a prospect fall through the cracks.

- **Follow-up Creation** - Manual or auto-created from campaigns/meetings
- **Priority Levels** - Urgent > High > Medium > Low
- **Due Date Tracking** - Overdue highlighting
- **Auto-pause** - Campaign sequences pause when reply detected
- **Reminder System** - Daily priorities widget shows what is due

**User flow:** Create follow-up > Get reminded > Complete > Mark done

---

## 9. Opportunities (Deals)
Track revenue-generating deals.

- **Deal Profile** - Name, value, stage, probability, expected close
- **Pipeline Stages** - Qualification > Proposal > Negotiation > Closed Won/Lost
- **Value Tracking** - Deal size in dollars
- **Win Probability** - Percentage likelihood to close
- **Linked Organization** - Which company the deal is with
- **Deal Timeline** - History of all actions on this deal

**User flow:** Create opportunity > Move through stages > Track value > Close

---

## 10. Proposals
Create and send deal documents.

- **Proposal Creation** - Generate proposal from template
- **Content Customization** - Tailor to specific deal
- **Status Tracking** - Draft > Sent > Accepted > Expired
- **Linked Opportunity** - Tied to specific deal

**User flow:** Create proposal > Customize > Send > Track status

---

## 11. Negotiations
Track back-and-forth with prospects.

- **Negotiation Record** - Track terms, counteroffers, objections
- **Status Tracking** - In Progress > Stalled > Won > Lost
- **Linked Opportunity** - Tied to specific deal
- **Notes** - Record key discussion points

**User flow:** Start negotiation > Log offers > Track status > Close

---

## 12. Tasks
To-do list tied to deals and contacts.

- **Task Creation** - Manual or auto-generated
- **Priority Levels** - Urgent > High > Medium > Low
- **Status Tracking** - Pending > In Progress > Completed
- **Linked Records** - Tie to organization, contact, or opportunity
- **Daily View** - See what is due today

**User flow:** Create task > Prioritize > Complete > Track

---

## 13. Connections
Network and referral tracking.

- **Connection Board** - Visual board of network contacts
- **Warm Intros** - Who knows whom
- **Referral Tracking** - Track referral sources
- **Relationship Strength** - Strong > Medium > Weak

**User flow:** Map network > Find warm intro path > Leverage connections

---

## 14. Communications
Log of every touchpoint.

- **Communication Log** - Email, phone, meeting, LinkedIn
- **Direction Tracking** - Inbound vs Outbound
- **Linked Records** - Tie to organization, contact, opportunity
- **Timeline View** - Chronological history

**User flow:** Log communication > Build timeline > See engagement history

---

## 15. Partnerships
Track strategic relationships.

- **Partnership Profile** - Type, status, value, start date
- **Partnership Types** - Technology, Channel, Strategic, Integration
- **Status Tracking** - Prospect > Active > Inactive
- **Revenue Tracking** - Partnership-generated revenue

**User flow:** Create partnership > Track status > Measure revenue

---

## 16. Customers
Won deal management.

- **Customer Profile** - Contract value, start date, renewal date
- **Health Score** - Customer satisfaction tracking
- **Renewal Tracking** - Upcoming renewals dashboard
- **Upsell Opportunities** - Identify expansion potential

**User flow:** Win deal > Onboard > Track health > Renew > Expand

---

## 17. Reports
Business intelligence dashboards.

- **Pipeline Report** - Deals by stage, value, probability
- **Activity Report** - Meetings, calls, emails per period
- **Win/Loss Report** - Conversion rates, reasons
- **Team Performance** - Individual metrics

**User flow:** View reports > Identify trends > Make decisions

---

## 18. Analytics
Visual charts and trends.

- **Pipeline Charts** - Visual pipeline health
- **Conversion Funnels** - Lead to Customer conversion
- **Revenue Forecasts** - Projected closed deals
- **Trend Analysis** - Week-over-week, month-over-month

**User flow:** View charts > Spot patterns > Adjust strategy

---

## 19. Calendar
Schedule management.

- **Monthly View** - Full calendar grid
- **Event Creation** - Schedule meetings directly
- **Today Highlight** - Current day marked
- **Linked Meetings** - Meetings tied to contacts/organizations

**User flow:** View calendar > Schedule meeting > Prepare > Attend

---

## 20. Map View
Geographic visualization.

- **Interactive Map** - Leaflet/OpenStreetMap
- **Organization Pins** - Click to see organization details
- **Priority Filtering** - Filter by High/Medium/Low
- **Search** - Find orgs by location

**User flow:** View map > Click pin > See org details > Plan regional visits

---

## 21. Copilot (AI Assistant)
Natural language interface to all features.

- **Chat Interface** - Ask questions in plain English
- **30 Tools** - Access all features via conversation
- **Auto-CRM Save** - Discovered orgs auto-saved to Organizations page
- **Auto-Contact Discovery** - Finds and enriches contacts with email/phone/LinkedIn
- **Research Engine** - Deep company research on demand (ScrapeGraphAI)
- **Draft Generation** - Write emails, proposals, notes
- **Smart Recommendations** - Next best action suggestions
- **Provider Fallback** - Tavily > Serper > Directory for reliable search
- **Smart Name Cleaning** - Filters out articles, listicles, reports from results
- **Research Resilience** - Handles blocked sites, unwraps malformed responses

**User flow:** Ask ELLY > Auto-save to CRM > Auto-find contacts > Ready for outreach

---

## Complete User Journey

```
Discovery (auto-save + auto-contacts) > Organizations > Contacts (enriched) > Outreach > Meetings > Follow-ups > Opportunities > Proposals > Negotiations > Customers
        |                                      |                    |            |          |            |               |              |              |              |
   Search web                        Auto-saved to CRM    Email/phone/LinkedIn   Send     Schedule    Never miss      Track deals     Create docs    Close deals    Manage
   Find leads                        Auto-find contacts   Ready for outreach     emails   meetings    follow-ups      by stage       for deals      & revenue      accounts
```

---

## Recent Fixes (Aug 2026)

### Discovery → CRM Pipeline
- **Bug:** Discovered orgs showed in chat but not in Organizations page
- **Fix:** `discover_qualified` and `discover_web` now save to `discovered_organizations` table and auto-promote to `organizations` table
- **Result:** Leads immediately visible in Organizations page after search

### Contact Enrichment
- **Bug:** Contacts found without email, phone, or LinkedIn
- **Fix:** Added web search enrichment for each contact — searches Tavily/Serper for "{name} {company} email phone linkedin"
- **Result:** Contacts now have reachable info before saving

### Name Cleaning
- **Bug:** Search results included article titles, listicles, reports (e.g., "Cybersecurity", "23 Companies to Know")
- **Fix:** Expanded SKIP_PATTERNS regex, added parenthetical/trailing phrase removal
- **Result:** Clean company names in search results

### Research Engine
- **Bug:** ScrapeGraphAI returned `{"content": {...}}` wrapper causing parse failure
- **Fix:** Unwrap content wrapper, detect "Access Denied" pages, return "blocked" status
- **Result:** Research no longer crashes on blocked sites

### Provider Timeout
- **Bug:** Serper provider could hang, blocking all search
- **Fix:** Multi-source search stops early when enough results found
- **Result:** Faster, more reliable search
