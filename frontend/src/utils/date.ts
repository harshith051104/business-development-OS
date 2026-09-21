/**
 * Utilities for consistent timezone handling of meetings and calendar events.
 * 
 * Meetings are stored in the database in UTC.
 * When retrieved from SQLite/FastAPI, naive datetime strings might lack 'Z'.
 * These helpers guarantee dates are parsed as UTC and formatted to/from the user's local timezone.
 */

/**
 * Safely parses an ISO date string from the API as UTC if no timezone is specified.
 * SQLite/FastAPI often returns timestamps without 'Z' (e.g. "2026-09-12T14:30:00").
 * Without 'Z', JavaScript Date constructor interprets it as local time, causing timezone shifts.
 */
export function parseMeetingDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date()
  const s = String(dateStr).trim()
  if (!s) return new Date()
  // Check if string lacks timezone indicator ('Z', '+HH:MM', or '-HH:MM' at the end)
  if (!s.endsWith('Z') && !s.includes('+') && !/-\d{2}:\d{2}$/.test(s)) {
    return new Date(s + 'Z')
  }
  return new Date(s)
}

/**
 * Converts local date (YYYY-MM-DD) and local time (HH:MM) strings into an ISO UTC string.
 * Uses local year, month, day, hour, minute to construct the exact local moment,
 * then converts to ISO string with UTC timezone for backend storage.
 */
export function formatLocalDateTimeToUtcIso(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, mins] = timeStr.split(':').map(Number)
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(mins)) {
    return ''
  }
  const localDate = new Date(year, month - 1, day, hours, mins, 0)
  return localDate.toISOString()
}

/**
 * Extracts local 'YYYY-MM-DD' and 'HH:mm' strings from a meeting scheduled_at timestamp.
 * Guaranteed to return the exact date and time in the user's local timezone.
 */
export function extractLocalDateAndTime(dateStr: string | null | undefined): { date: string; time: string } {
  if (!dateStr) return { date: '', time: '' }
  const dt = parseMeetingDate(dateStr)
  if (isNaN(dt.getTime())) return { date: '', time: '' }
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  const hours = String(dt.getHours()).padStart(2, '0')
  const mins = String(dt.getMinutes()).padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${mins}`,
  }
}
