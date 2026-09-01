"""Google Calendar API service for meeting sync and scheduling."""
import json
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.core.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_credentials():
    """Load OAuth2 credentials from file."""
    creds_file = settings.GOOGLE_CALENDAR_CREDENTIALS_FILE
    if not creds_file or not os.path.exists(creds_file):
        return None
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    token_file = creds_file.replace("credentials", "token")
    creds = None

    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            from google_auth_oauthlib.flow import InstalledAppFlow
            flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_file, "w") as token:
            token.write(creds.to_json())

    return creds


def _get_service():
    """Get Google Calendar API service."""
    creds = _get_credentials()
    if not creds:
        return None
    from googleapiclient.discovery import build
    return build("calendar", "v3", credentials=creds)


async def list_calendars() -> List[Dict[str, Any]]:
    """List all calendars for the authenticated user."""
    service = _get_service()
    if not service:
        return []
    try:
        result = service.calendarList().list().execute()
        return [
            {
                "id": cal.get("id"),
                "summary": cal.get("summary"),
                "primary": cal.get("primary", False),
                "timeZone": cal.get("timeZone"),
            }
            for cal in result.get("items", [])
        ]
    except Exception:
        return []


async def list_events(
    calendar_id: str = "primary",
    time_min: Optional[str] = None,
    time_max: Optional[str] = None,
    max_results: int = 20,
) -> List[Dict[str, Any]]:
    """List upcoming events from Google Calendar."""
    service = _get_service()
    if not service:
        return []
    try:
        if not time_min:
            time_min = datetime.now(timezone.utc).isoformat()
        result = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
        events = []
        for event in result.get("items", []):
            start = event.get("start", {})
            end = event.get("end", {})
            events.append(
                {
                    "id": event.get("id"),
                    "summary": event.get("summary", "No Title"),
                    "description": event.get("description", ""),
                    "location": event.get("location", ""),
                    "start": start.get("dateTime") or start.get("date"),
                    "end": end.get("dateTime") or end.get("date"),
                    "html_link": event.get("htmlLink"),
                    "status": event.get("status"),
                    "attendees": [
                        {"email": a.get("email"), "name": a.get("displayName"), "status": a.get("responseStatus")}
                        for a in event.get("attendees", [])
                    ],
                }
            )
        return events
    except Exception:
        return []


async def create_event(
    summary: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
    attendees: Optional[List[Dict[str, str]]] = None,
    calendar_id: str = "primary",
) -> Optional[Dict[str, Any]]:
    """Create a new event in Google Calendar."""
    service = _get_service()
    if not service:
        return None
    try:
        event_body = {
            "summary": summary,
            "description": description,
            "location": location,
            "start": {"dateTime": start_time, "timeZone": "UTC"},
            "end": {"dateTime": end_time, "timeZone": "UTC"},
        }
        if attendees:
            event_body["attendees"] = [{"email": a.get("email"), "displayName": a.get("name")} for a in attendees]

        result = service.events().insert(calendarId=calendar_id, body=event_body).execute()
        return {
            "id": result.get("id"),
            "summary": result.get("summary"),
            "html_link": result.get("htmlLink"),
            "start": result.get("start", {}).get("dateTime"),
            "end": result.get("end", {}).get("dateTime"),
        }
    except Exception:
        return None


async def update_event(
    event_id: str,
    summary: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
    calendar_id: str = "primary",
) -> Optional[Dict[str, Any]]:
    """Update an existing event."""
    service = _get_service()
    if not service:
        return None
    try:
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        if summary:
            event["summary"] = summary
        if description is not None:
            event["description"] = description
        if location is not None:
            event["location"] = location
        if start_time:
            event["start"] = {"dateTime": start_time, "timeZone": "UTC"}
        if end_time:
            event["end"] = {"dateTime": end_time, "timeZone": "UTC"}

        result = service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()
        return {
            "id": result.get("id"),
            "summary": result.get("summary"),
            "html_link": result.get("htmlLink"),
        }
    except Exception:
        return None


async def delete_event(event_id: str, calendar_id: str = "primary") -> bool:
    """Delete an event from Google Calendar."""
    service = _get_service()
    if not service:
        return False
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
    except Exception:
        return False


async def sync_meeting_to_calendar(
    meeting_summary: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
    attendee_emails: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """Sync a BD meeting to Google Calendar."""
    attendees = [{"email": e} for e in (attendee_emails or [])]
    return await create_event(
        summary=meeting_summary,
        start_time=start_time,
        end_time=end_time,
        description=description,
        location=location,
        attendees=attendees,
    )
