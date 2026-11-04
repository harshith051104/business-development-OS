import type { BDTask } from '../../types/task'
import type { Meeting } from '../../types/meeting'
import { parseMeetingDate } from '../../utils/date'

export type CalView = 'month' | 'week' | 'day'

/** A meeting placed on the calendar (start/end are local Date objects). */
export interface CalMeeting {
  kind: 'meeting'
  id: number
  title: string
  start: Date
  end: Date
  meeting: Meeting
}

/** A task placed on its due day. Tasks carry a date only — never a duration. */
export interface CalTask {
  kind: 'task'
  id: number
  title: string
  day: string // YYYY-MM-DD, or '' when unscheduled
  task: BDTask
}

export type CalItem = CalMeeting | CalTask

export const HOUR_PX = 56
export const SNAP_MIN = 15

export const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromDayKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
/** Weeks start on Monday, as in the design reference. */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7))
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

/** Task due dates are stored as a date (midnight, no zone); read the calendar day from the text so no zone shift applies. */
export const taskDay = (t: BDTask) => (t.due_date ? String(t.due_date).slice(0, 10) : '')

export function toMeeting(m: Meeting): CalMeeting {
  const start = parseMeetingDate(m.scheduled_at)
  const end = new Date(start.getTime() + (m.duration_minutes || 30) * 60000)
  return { kind: 'meeting', id: m.id, title: m.title, start, end, meeting: m }
}

export const toTask = (t: BDTask): CalTask => ({ kind: 'task', id: t.id, title: t.title, day: taskDay(t), task: t })

export function visibleRange(view: CalView, anchor: Date): { start: Date; end: Date; days: Date[] } {
  if (view === 'day') {
    const s = startOfDay(anchor)
    return { start: s, end: addDays(s, 1), days: [s] }
  }
  if (view === 'week') {
    const s = startOfWeek(anchor)
    return { start: s, end: addDays(s, 7), days: Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
  }
  const s = startOfWeek(startOfMonth(anchor))
  const days = Array.from({ length: 42 }, (_, i) => addDays(s, i))
  return { start: s, end: addDays(s, 42), days }
}

export function shift(view: CalView, anchor: Date, dir: 1 | -1): Date {
  if (view === 'day') return addDays(anchor, dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
}

export function rangeLabel(view: CalView, anchor: Date): string {
  if (view === 'day') return anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (view === 'month') return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const s = startOfWeek(anchor)
  const e = addDays(s, 6)
  return s.getMonth() === e.getMonth()
    ? s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${s.toLocaleDateString(undefined, { month: 'short' })} – ${e.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

/** Side-by-side columns for overlapping meetings within one day. */
export function layoutDay(items: CalMeeting[]): Map<number, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime())
  const out = new Map<number, { col: number; cols: number }>()
  let cluster: CalMeeting[] = []
  let clusterEnd = 0
  const flush = () => {
    const colEnds: number[] = []
    const assigned: [CalMeeting, number][] = []
    cluster.forEach((m) => {
      let col = colEnds.findIndex((end) => end <= m.start.getTime())
      if (col === -1) {
        col = colEnds.length
        colEnds.push(0)
      }
      colEnds[col] = m.end.getTime()
      assigned.push([m, col])
    })
    assigned.forEach(([m, col]) => out.set(m.id, { col, cols: colEnds.length }))
    cluster = []
  }
  sorted.forEach((m) => {
    if (cluster.length && m.start.getTime() >= clusterEnd) flush()
    cluster.push(m)
    clusterEnd = Math.max(clusterEnd, m.end.getTime())
  })
  if (cluster.length) flush()
  return out
}

export const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function timezoneLabel(): { short: string; long: string } {
  const long = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'
  const offset = -new Date().getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const h = Math.floor(Math.abs(offset) / 60)
  const m = Math.abs(offset) % 60
  return { short: `GMT${sign}${h}${m ? `:${pad(m)}` : ''}`, long }
}

/** Card colours by meeting type: muted, dark-tinted fills with soft-white text; the dot is the type's accent (also used as the card's left edge). */
export const MEETING_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Introduction: { bg: '#2a1e4d', text: '#C9C2E3', dot: '#8b7cc7' },
  'Project Showcase': { bg: '#3a3a52', text: '#C9C2E3', dot: '#8b7cc7' },
  'Business Discussion': { bg: '#2a1e4d', text: '#C9C2E3', dot: '#8b7cc7' },
  'Partnership Discussion': { bg: '#3a3a52', text: '#C9C2E3', dot: '#8b7cc7' },
  'Technical Discussion': { bg: '#2a1e4d', text: '#C9C2E3', dot: '#86a3bf' },
  'Follow-up': { bg: '#3a3a52', text: '#C9C2E3', dot: '#c4a585' },
  Other: { bg: '#2a1e4d', text: '#C9C2E3', dot: '#8b7cc7' },
}
export const meetingColor = (type?: string) => MEETING_TYPE_COLORS[type || 'Other'] || MEETING_TYPE_COLORS.Other

export const TASK_PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  High: { bg: '#2a1e4d', text: '#C9C2E3', dot: '#d08aa5' },
  Medium: { bg: '#3a3a52', text: '#C9C2E3', dot: '#c9aa72' },
  Low: { bg: '#2a333b', text: '#C9C2E3', dot: '#86a8bf' },
}
export const taskColor = (t: BDTask) =>
  t.status === 'Completed' || t.status === 'Cancelled' ? { bg: '#0e0b1d', text: '#8B7CC7', dot: '#5A3B8C' } : TASK_PRIORITY_COLORS[t.priority] || TASK_PRIORITY_COLORS.Medium

export const initials = (name?: string | null) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'

const AVATAR_COLORS = ['#8b7cc7', '#8b7cc7', '#8b7cc7', '#8b7cc7', '#86a3bf', '#c4a585', '#8b7cc7', '#8b7cc7']
export const avatarColor = (id: number | string) => AVATAR_COLORS[Math.abs(Number(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0))) % AVATAR_COLORS.length]
