# ELLY Outreach Automation (WhatsApp + LinkedIn)

One Chrome extension (Manifest V3), pure DOM, no server of its own. Covers
both channels — WhatsApp Web and LinkedIn — from a single install, single
login, single popup. Pulls the leads assigned to the logged-in rep from the
ELLY backend, drives each site's own UI to act, reports outcomes back so the
Lead Tracker stays in sync, paces itself per channel to reduce (not remove)
detection/ban risk.

## Risk — read this before using it

Automating WhatsApp Web is against WhatsApp's Terms of Service; automating
LinkedIn is against LinkedIn's User Agreement. Both can get the account
banned at any time regardless of how carefully this paces itself:

- **WhatsApp**: the number banned is replaceable. Use one you can afford to
  lose.
- **LinkedIn**: the profile banned is a rep's own professional identity and
  network — not replaceable. LinkedIn's automated-behavior detection is
  reported to be stricter than WhatsApp's. Use an account you can afford to
  lose, ideally not a founder's main daily-driver profile.

The caps/delays below reduce the chance of a volume-based trip; they do not
make either channel compliant, and they do nothing against behavior-pattern
detection. Stop immediately on any "reported"/"blocked"/"restricted" warning
or CAPTCHA.

## Why one extension

Same backend, same JWT login, same Lead Tracker checkbox pipeline on the
other end — only the on-page DOM logic differs per site, so it's one
`manifest.json` with two content scripts (`wa-content.js` for
`web.whatsapp.com`, `li-content.js` for `www.linkedin.com`), one shared
`background.js` for all network calls, one popup with a settings section per
channel. Each channel still runs its own panel on its own site, with its own
cap/hours/campaign filter — nothing is shared except login and install.

## Safety mechanisms (built in, not configurable away)

**WhatsApp** (`wa-content.js`):
- Daily send cap (default 15/day), business hours 09:00–20:00
- Randomized delay 90–240s between sends; 15–30s after an invalid number
- Stops after 3 consecutive failures
- "Rehearse" mode: types the message, does not click Send

**LinkedIn** (`li-content.js`), deliberately more conservative:
- Daily action cap (default 8/day), business hours 09:00–18:00
- Randomized delay 3–8 minutes for a real connect/message send; 20–40s for a
  cheap "already pending/unavailable" check where nothing was sent
- Stops after 3 consecutive failures
- "Rehearse" mode: types the connect note / message, does not click Send

Both channels: server-side filtering enforces assigned-to-you, not
`do_not_contact`, and (phone / LinkedIn URL) present — not just a
client-side check.

## Install (unpacked)

1. `chrome://extensions` → enable Developer Mode → "Load unpacked" → select
   this `elly-outreach-extension/` folder.
2. Click the extension icon. Enter the backend URL (default
   `http://127.0.0.1:8001`), your ELLY email + password, click **Log in**.
   Chrome prompts once to allow the extension to reach that URL — allow it.
3. Set each channel's cap/hours/campaign filter in its own section, save.
4. For WhatsApp: open `web.whatsapp.com`, logged in normally (QR scan). For
   LinkedIn: open any `linkedin.com` tab, logged in normally. Each shows its
   own panel bottom-right.
5. Click **Rehearse** on each channel first to confirm it opens
   chats/profiles and types correctly without sending. Then **Start** for
   real.

## How it works

- Each content script pulls up to 20 queued leads from its own backend
  endpoint (`.../whatsapp-automation/queue` or `.../linkedin-automation/queue`)
  — only the logged-in rep's own assigned leads.
- WhatsApp: opens `web.whatsapp.com/send?phone=...&text=...`, clicks Send,
  confirms via message count, reports `sent`/`invalid`/`failed`.
- LinkedIn: opens the lead's profile, reads the primary action button
  (Connect / Pending / Message / Follow-only) to decide what to do, acts,
  confirms via DOM, reports which milestone checkbox(es) to flip.
- Both report through `POST .../queue/{id}/report`, which flips the relevant
  Lead Tracker checkbox and logs a timeline event — same as any manual
  milestone update.
- Pacing state (`waRunState`/`liRunState`, `waSentLog`/`liDoneLog`, etc.)
  lives in `chrome.storage.local` on this machine only, with `wa`/`li`
  prefixes since both channels share the one extension's storage namespace.

## Per-campaign templates

- WhatsApp: `PATCH /api/business-development/whatsapp-automation/settings/{campaign_id}`
  with `{"template": "Hi {{first_name}}, ..."}`.
- LinkedIn: `PATCH /api/business-development/linkedin-automation/settings/{campaign_id}`
  with `{"connection_note": "...", "first_message": "..."}` (connection note
  is optional — omit to send bare connection requests).

Merge fields on both: `{{first_name}}`, `{{last_name}}`, `{{company}}`,
`{{sender_name}}`. Falls back to a generic template if a campaign has none
set.

## Known limitations

- LinkedIn sometimes hides Connect behind a "More" dropdown on profiles with
  many mutual connections; this extension doesn't open that menu — it
  reports `linkedin_unavailable` instead of guessing.
- Both sites' DOM is unstable across redesigns. Selectors match visible
  button text/labels, not CSS classes, but still need occasional updating in
  `wa-content.js` / `li-content.js` if either site changes its UI copy.
- The old single-channel `whatsapp-extension/` and `linkedin-extension/`
  folders are superseded by this one — use this one going forward.
