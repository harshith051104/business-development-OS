# Google Sheets Auto-Save Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create new project (e.g., "ELLY BD Portal")
3. Enable **Google Sheets API** and **Google Drive API**:
   - APIs & Services → Library → search "Google Sheets API" → Enable
   - APIs & Services → Library → search "Google Drive API" → Enable

### Step 2: Create Service Account
1. APIs & Services → Credentials → Create Credentials → Service Account
2. Name: `elly-sheets-writer`
3. Role: `Editor` (or `Owner` for full access)
4. Click Done
5. Click the service account → Keys → Add Key → Create New Key → JSON
6. Save the JSON file as `backend/google_credentials.json`

### Step 3: Create Google Spreadsheet
1. Go to https://sheets.google.com → Create new spreadsheet
2. Name it: `ELLY Discovery Leads` (or any name)
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_IS_HERE/edit
   ```

### Step 4: Share Spreadsheet with Service Account
1. Open your spreadsheet → Share
2. Add the service account email (from the JSON file, looks like `elly-sheets-writer@project.iam.gserviceaccount.com`)
3. Give it **Editor** access
4. Click Send

### Step 5: Update .env
```env
GOOGLE_SHEETS_CREDENTIALS_FILE = backend/google_credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID = your_spreadsheet_id_here
```

### Step 6: Restart Backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```

## How It Works

- Every search auto-saves results to your Google Sheet
- Sheet auto-creates "ELLY Discovery Leads" tab with headers if it doesn't exist
- Headers: Search Date, Keyword, Location, Org Type, Fit Level, etc.
- Caching: Same search within 1 hour returns cached results (no API waste)
- Fails silently: If Sheets is misconfigured, searches still work

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Google Sheets auth failed" | Check JSON file path in .env |
| "Spreadsheet not found" | Check spreadsheet ID and sharing permissions |
| "Permission denied" | Share spreadsheet with service account email |
| Results not appearing | Check backend logs for Sheets errors |
