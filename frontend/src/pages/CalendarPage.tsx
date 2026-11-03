import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../context/AuthContext'
import { taskService } from '../services/tasks'
import { meetingsService } from '../services/meetings'
import { adminService } from '../services/admin'
import type { BDTask } from '../types/task'
import type { Meeting } from '../types/meeting'
import TimeGrid from '../components/calendar/TimeGrid'
import MonthGrid from '../components/calendar/MonthGrid'
import MiniMonth from '../components/calendar/MiniMonth'
import ItemEditor, { type EditorTarget, type Member } from '../components/calendar/ItemEditor'
import {
  MEETING_TYPE_COLORS,
  TASK_PRIORITY_COLORS,
  avatarColor,
  dayKey,
  fromDayKey,
  initials,
  rangeLabel,
  shift,
  startOfDay,
  timezoneLabel,
  toMeeting,
  toTask,
  visibleRange,
  type CalItem,
  type CalMeeting,
  type CalView,
} from '../components/calendar/calendarModel'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, PanelLeftClose, PanelLeftOpen, Plus, Star, X } from 'lucide-react'

const FAV_KEY = 'elly.calendar.favorites'
const PANEL_KEY = 'elly.calendar.panelOpen'
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* per-viewer convenience only */
  }
}

type Notice = { kind: 'success' | 'error'; text: string } | null

const Section: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode; right?: React.ReactNode }> = ({ title, open, onToggle, children, right }) => (
  <section className="bg-[#1D1927] rounded-3xl p-4">
    <div className="flex items-center justify-between">
      <button onClick={onToggle} aria-expanded={open} className="flex-1 flex items-center justify-between text-[15px] font-semibold text-[#EAE7EF] text-left">
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-[#ABA3B7]" /> : <ChevronDown className="w-4 h-4 text-[#ABA3B7]" />}
      </button>
      {right}
    </div>
    {open && <div className="mt-3">{children}</div>}
  </section>
)

const Check: React.FC<{ checked: boolean; onChange: () => void; label: string; dot?: string }> = ({ checked, onChange, label, dot }) => (
  <label className="flex items-center gap-2.5 text-[13px] text-[#ABA3B7] cursor-pointer py-0.5">
    <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 accent-[#8B6BB1]" />
    {dot && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />}
    {label}
  </label>
)

/** Calendar: the main place for meetings, task due dates and who they're assigned to. */
export default function CalendarPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<CalView>('week')
  const [anchor, setAnchor] = useState(() => {
    const d = searchParams.get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? fromDayKey(d) : startOfDay(new Date())
  })
  const [tasks, setTasks] = useState<BDTask[]>([])
  const [tasksTruncated, setTasksTruncated] = useState(false)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [team, setTeam] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [editor, setEditor] = useState<{ target: EditorTarget; anchor: DOMRect | null } | null>(null)

  // Filters
  const [showMeetings, setShowMeetings] = useState(true)
  const [showTasks, setShowTasks] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [meetingScope, setMeetingScope] = useState<'mine' | 'all'>('mine')
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [hiddenPriorities, setHiddenPriorities] = useState<Set<string>>(new Set())
  const [member, setMember] = useState<number | null>(null)
  const [favorites, setFavorites] = useState<number[]>(() => readJson(FAV_KEY, []))
  const [panelOpen, setPanelOpen] = useState<boolean>(() => readJson(PANEL_KEY, window.innerWidth >= 1600))
  const [sections, setSections] = useState({ calendars: true, favorites: false, categories: true, unscheduled: true })

  useEffect(() => writeJson(FAV_KEY, favorites), [favorites])
  useEffect(() => writeJson(PANEL_KEY, panelOpen), [panelOpen])

  const range = useMemo(() => visibleRange(view, anchor), [view, anchor])
  const tz = useMemo(timezoneLabel, [])

  const loadTasks = useCallback(async () => {
    // The tasks API returns up to 100 tasks (newest first) with no paging.
    const list = await taskService.list({ limit: 100 })
    setTasks(list)
    setTasksTruncated(list.length >= 100)
  }, [])

  const loadMeetings = useCallback(async () => {
    const all: Meeting[] = []
    let page = 1
    let pages = 1
    do {
      const res = await meetingsService.getMeetings({
        date_from: new Date(range.start.getTime() - 864e5).toISOString(),
        date_to: new Date(range.end.getTime() + 864e5).toISOString(),
        page,
        page_size: 100,
        sort_by: 'scheduled_at',
        sort_order: 'asc',
        // owner_scope is accepted by the API; 'mine' unless the user widens it
        ...({ owner_scope: meetingScope } as object),
      })
      all.push(...res.items)
      pages = res.total_pages
      page += 1
    } while (page <= pages && page <= 5)
    setMeetings(all)
  }, [range.start, range.end, meetingScope])

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    Promise.all([loadTasks(), loadMeetings()])
      .catch((err) => setLoadError(err?.detail || err?.message || 'The calendar could not be loaded.'))
      .finally(() => setLoading(false))
  }, [loadTasks, loadMeetings])

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      adminService
        .getTeam()
        .then((r) => setTeam(r.items.filter((m) => m.is_active).map((m) => ({ id: m.id, name: m.name }))))
        .catch(() => setTeam([]))
    }
  }, [user?.role])

  // Team members come only from records this user can already see (task owners), plus admins' team list.
  const members = useMemo<Member[]>(() => {
    const m = new Map<number, string>()
    if (user) m.set(user.id, user.name)
    team.forEach((x) => m.set(x.id, x.name))
    tasks.forEach((t) => t.owner_id && m.set(t.owner_id, t.owner_name || m.get(t.owner_id) || `User ${t.owner_id}`))
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : a.name.localeCompare(b.name)))
  }, [tasks, team, user])

  // Deep link: /calendar?task=ID opens that task.
  useEffect(() => {
    const id = Number(searchParams.get('task'))
    if (!id || loading) return
    const t = tasks.find((x) => x.id === id)
    searchParams.delete('task')
    setSearchParams(searchParams, { replace: true })
    if (!t) {
      setNotice({ kind: 'error', text: 'That task wasn’t found. It may have been deleted.' })
      return
    }
    if (t.due_date) setAnchor(fromDayKey(String(t.due_date).slice(0, 10)))
    setEditor({ target: { mode: 'task', task: t }, anchor: null })
  }, [searchParams, setSearchParams, tasks, loading])

  useEffect(() => {
    if (!notice) return
    const h = setTimeout(() => setNotice(null), notice.kind === 'success' ? 3500 : 8000)
    return () => clearTimeout(h)
  }, [notice])

  // Visible items after filters
  const memberMeetingsUnknown = member !== null && !(member === user?.id && meetingScope === 'mine')
  const calMeetings = useMemo<CalMeeting[]>(
    () =>
      showMeetings && !memberMeetingsUnknown
        ? meetings
            .filter((m) => (showCancelled || m.status !== 'Cancelled') && !hiddenTypes.has(m.meeting_type || 'Other'))
            .map(toMeeting)
            .filter((m) => m.end > range.start && m.start < range.end)
        : [],
    [meetings, showMeetings, showCancelled, hiddenTypes, range, memberMeetingsUnknown],
  )
  const taskFilter = useCallback(
    (t: BDTask) =>
      showTasks &&
      (showCompleted || (t.status !== 'Completed' && t.status !== 'Cancelled')) &&
      !hiddenPriorities.has(t.priority) &&
      (member === null || t.owner_id === member),
    [showTasks, showCompleted, hiddenPriorities, member],
  )
  const calTasks = useMemo(() => tasks.filter((t) => t.due_date && taskFilter(t)).map(toTask), [tasks, taskFilter])
  const unscheduled = useMemo(() => tasks.filter((t) => !t.due_date && taskFilter(t)), [tasks, taskFilter])
  const marked = useMemo(() => {
    const s = new Set<string>()
    calTasks.forEach((t) => s.add(t.day))
    meetings.forEach((m) => s.add(dayKey(toMeeting(m).start)))
    return s
  }, [calTasks, meetings])
  const meetingTypes = useMemo(() => [...new Set([...Object.keys(MEETING_TYPE_COLORS)])], [])

  const selectedKey = editor ? (editor.target.mode === 'task' ? `task-${editor.target.task.id}` : editor.target.mode === 'meeting' ? `meeting-${editor.target.meeting.id}` : null) : null

  // ── Mutations (optimistic where it helps; the previous state comes back if saving fails) ──
  const replaceTask = (saved: BDTask) => setTasks((prev) => (prev.some((t) => t.id === saved.id) ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]))
  const replaceMeeting = (saved: Meeting) => setMeetings((prev) => (prev.some((m) => m.id === saved.id) ? prev.map((m) => (m.id === saved.id ? { ...m, ...saved } : m)) : [...prev, saved]))

  const moveTask = async (id: number, day: string) => {
    const before = tasks.find((t) => t.id === id)
    if (!before || String(before.due_date || '').slice(0, 10) === day) return
    replaceTask({ ...before, due_date: day })
    try {
      replaceTask(await taskService.update(id, { due_date: day }))
      setNotice({ kind: 'success', text: `“${before.title}” is now due ${fromDayKey(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}.` })
    } catch (err: any) {
      replaceTask(before)
      setNotice({ kind: 'error', text: `Couldn’t move the task: ${err?.detail || err?.message || 'save failed'}. It’s back where it was.` })
    }
  }

  const moveMeeting = async (cm: CalMeeting, start: Date, durationMin: number) => {
    const before = meetings.find((m) => m.id === cm.id)
    if (!before) return
    const iso = start.toISOString()
    replaceMeeting({ ...before, scheduled_at: iso, duration_minutes: durationMin })
    try {
      replaceMeeting(await meetingsService.rescheduleMeeting(cm.id, { scheduled_at: iso, duration_minutes: durationMin }))
      setNotice({ kind: 'success', text: `“${before.title}” moved to ${start.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} (${durationMin} min).` })
    } catch (err: any) {
      replaceMeeting(before)
      setNotice({ kind: 'error', text: `Couldn’t reschedule the meeting: ${err?.detail || err?.message || 'save failed'}. It’s back where it was.` })
    }
  }

  const moveMeetingDay = (cm: CalMeeting, day: Date) => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), cm.start.getHours(), cm.start.getMinutes())
    if (start.getTime() !== cm.start.getTime()) moveMeeting(cm, start, Math.round((cm.end.getTime() - cm.start.getTime()) / 60000))
  }

  const openItem = (item: CalItem, rect: DOMRect | null) =>
    setEditor({ target: item.kind === 'task' ? { mode: 'task', task: item.task } : { mode: 'meeting', meeting: item.meeting }, anchor: rect })
  const openCreate = (day: Date, minutes: number | null, rect: DOMRect | null, kind: 'task' | 'meeting' = minutes === null ? 'task' : 'meeting') =>
    setEditor({ target: { mode: 'create', day: dayKey(day), minutes, kind }, anchor: rect })

  const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const memberName = (id: number | null) => members.find((m) => m.id === id)?.name
  const favMembers = members.filter((m) => favorites.includes(m.id))
  const railMembers = [...favMembers, ...members.filter((m) => !favorites.includes(m.id))]

  const bubble = (m: Member, size = 'w-11 h-11 text-sm') => (
    <span className={`${size} rounded-full flex items-center justify-center font-semibold text-[#0E0D12] shrink-0`} style={{ backgroundColor: avatarColor(m.id) }} aria-hidden>
      {initials(m.name)}
    </span>
  )

  return (
    <div className="h-screen bg-[#0E0D12] text-[#F0ECFF] md:pl-64 flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 flex gap-3 p-3">
        {/* Team rail */}
        <aside aria-label="Team" className="w-[72px] shrink-0 bg-[#15131C] border border-[#302938] rounded-3xl flex flex-col items-center gap-3 py-3 overflow-y-auto">
          <button
            onClick={() => openCreate(view === 'month' ? anchor : new Date(), view === 'month' ? null : 9 * 60, null)}
            className="w-12 h-12 rounded-2xl bg-[#7A5C9E] text-white flex items-center justify-center hover:brightness-105"
            aria-label="Add a task or meeting"
            title="Add a task or meeting"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="w-12 h-12 rounded-2xl bg-[#1D1927] text-white flex items-center justify-center hover:bg-[#262033]"
            aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
            aria-expanded={panelOpen}
          >
            {panelOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </button>
          <div className="w-8 border-t border-[#302938] my-1" />
          <button
            onClick={() => setMember(null)}
            aria-pressed={member === null}
            title="Everyone I can see"
            className={`w-11 h-11 rounded-full text-[11px] font-semibold ${member === null ? 'bg-[#443253] text-[#EAE7EF] ring-1 ring-[#8B6BB1]' : 'bg-[#1D1927] text-[#ABA3B7] hover:bg-[#262033]'}`}
          >
            All
          </button>
          {railMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => setMember(member === m.id ? null : m.id)}
              aria-pressed={member === m.id}
              aria-label={`Show items assigned to ${m.name}`}
              title={`${m.name}${m.id === user?.id ? ' (you)' : ''}`}
              className={`relative rounded-full p-0.5 ${member === m.id ? 'ring-2 ring-[#8B6BB1]' : ''}`}
            >
              {bubble(m)}
              {favorites.includes(m.id) && <Star className="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 text-[#8B6BB1] fill-[#8B6BB1]" />}
            </button>
          ))}
        </aside>

        {/* Secondary panel */}
        {panelOpen && (
          <aside aria-label="Calendar options" className="w-[264px] shrink-0 space-y-3 overflow-y-auto pr-1">
            <section className="bg-[#1D1927] rounded-3xl p-4">
              <MiniMonth
                selected={anchor}
                marked={marked}
                onPick={(d) => {
                  setAnchor(d)
                  if (view === 'month') setView('day')
                }}
              />
            </section>

            <Section title="My Calendars" open={sections.calendars} onToggle={() => setSections((s) => ({ ...s, calendars: !s.calendars }))}>
              <Check checked={showMeetings} onChange={() => setShowMeetings((v) => !v)} label="Meetings & events" />
              <Check checked={showTasks} onChange={() => setShowTasks((v) => !v)} label="Tasks (due dates)" />
              <Check checked={showCompleted} onChange={() => setShowCompleted((v) => !v)} label="Completed & cancelled tasks" />
              <Check checked={showCancelled} onChange={() => setShowCancelled((v) => !v)} label="Cancelled meetings" />
              <label className="block text-[11px] text-[#8F879C] mt-2">
                Meetings shown
                <select
                  value={meetingScope}
                  onChange={(e) => setMeetingScope(e.target.value as 'mine' | 'all')}
                  className="mt-1 w-full bg-[#262033] border border-[#302938] rounded-lg px-2 py-1 text-xs text-[#EAE7EF]"
                >
                  <option value="mine">My meetings</option>
                  <option value="all">All meetings I can access</option>
                </select>
              </label>
            </Section>

            <Section
              title="Favorites"
              open={sections.favorites}
              onToggle={() => setSections((s) => ({ ...s, favorites: !s.favorites }))}
            >
              <p className="text-[11px] text-[#8F879C] mb-2">Starred teammates appear first in the rail. Saved in this browser only.</p>
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-[13px] text-[#ABA3B7]">
                    {bubble(m, 'w-6 h-6 text-[10px]')}
                    <button onClick={() => setMember(member === m.id ? null : m.id)} className="flex-1 text-left truncate hover:text-[#EAE7EF]">
                      {m.name}
                      {m.id === user?.id ? ' (you)' : ''}
                    </button>
                    <button
                      onClick={() => setFavorites((f) => (f.includes(m.id) ? f.filter((x) => x !== m.id) : [...f, m.id]))}
                      aria-pressed={favorites.includes(m.id)}
                      aria-label={favorites.includes(m.id) ? `Unstar ${m.name}` : `Star ${m.name}`}
                      className="p-1"
                    >
                      <Star className={`w-3.5 h-3.5 ${favorites.includes(m.id) ? 'text-[#8B6BB1] fill-[#8B6BB1]' : 'text-[#8F879C]'}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Categories" open={sections.categories} onToggle={() => setSections((s) => ({ ...s, categories: !s.categories }))}>
              <div className="text-[11px] text-[#8F879C] mb-1">Meeting type</div>
              {meetingTypes.map((type) => (
                <Check key={type} checked={!hiddenTypes.has(type)} onChange={() => toggleSet(hiddenTypes, type, setHiddenTypes)} label={type} dot={MEETING_TYPE_COLORS[type].dot} />
              ))}
              <div className="text-[11px] text-[#8F879C] mt-2 mb-1">Task priority</div>
              {Object.entries(TASK_PRIORITY_COLORS).map(([p, c]) => (
                <Check key={p} checked={!hiddenPriorities.has(p)} onChange={() => toggleSet(hiddenPriorities, p, setHiddenPriorities)} label={p} dot={c.dot} />
              ))}
            </Section>

            <Section
              title={`Unscheduled tasks${unscheduled.length ? ` (${unscheduled.length})` : ''}`}
              open={sections.unscheduled}
              onToggle={() => setSections((s) => ({ ...s, unscheduled: !s.unscheduled }))}
            >
              {unscheduled.length === 0 ? (
                <p className="text-[12px] text-[#8F879C]">Every task has a due date.</p>
              ) : (
                <>
                  <p className="text-[11px] text-[#8F879C] mb-2">Drag one onto a day, or open it to set a date.</p>
                  <ul className="space-y-1">
                    {unscheduled.map((t) => (
                      <li key={t.id}>
                        <button
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/elly-task', String(t.id))}
                          onClick={(e) => setEditor({ target: { mode: 'task', task: t }, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                          className="w-full text-left text-[12px] px-2 py-1.5 rounded-lg bg-[#262033] text-[#EAE7EF] hover:bg-[#302938] truncate"
                        >
                          <span className="text-[10px] text-[#8F879C] mr-1">Task</span>
                          {t.title}
                          {t.owner_name && <span className="block text-[10px] text-[#8F879C]">{t.owner_name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          </aside>
        )}

        {/* Calendar surface */}
        <main
          className="flex-1 min-w-0 rounded-3xl flex flex-col overflow-hidden relative"
          style={{ background: '#15131C' }}
        >
          <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
            <h1 className="text-2xl font-bold text-[#EAE7EF] mr-1">{rangeLabel(view, anchor)}</h1>
            <button onClick={() => setAnchor(startOfDay(new Date()))} className="px-3.5 py-1 rounded-full bg-[#7A5C9E] hover:bg-[#6B4F8C] text-white text-xs font-semibold">
              Today
            </button>
            <button onClick={() => setAnchor(shift(view, anchor, -1))} aria-label={`Previous ${view}`} className="p-1.5 rounded-full text-[#ABA3B7] hover:bg-white/10">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setAnchor(shift(view, anchor, 1))} aria-label={`Next ${view}`} className="p-1.5 rounded-full text-[#ABA3B7] hover:bg-white/10">
              <ChevronRight className="w-5 h-5" />
            </button>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-[#ABA3B7]" aria-label="Loading" />}
            <span className="text-[11px] text-[#ABA3B7]" title="All times are shown in this browser’s time zone">
              {tz.long} ({tz.short})
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div role="tablist" aria-label="Calendar view" className="flex bg-[#0E0D12] rounded-full p-1">
                {(['month', 'week', 'day'] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`px-4 py-1 rounded-full text-sm ${view === v ? 'bg-[#443253] text-[#EAE7EF] font-semibold' : 'text-[#ABA3B7] hover:text-[#EAE7EF]'}`}
                  >
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => openCreate(view === 'month' ? anchor : anchor, view === 'month' ? null : 9 * 60, null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#7A5C9E] hover:bg-[#6B4F8C] text-white text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {(member !== null || loadError || tasksTruncated) && (
            <div className="mx-5 mb-2 flex flex-wrap items-center gap-2 text-[12px]">
              {member !== null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#262033] text-[#EAE7EF]">
                  Assigned to {memberName(member)}
                  <button onClick={() => setMember(null)} aria-label="Clear team member filter">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {memberMeetingsUnknown && showMeetings && (
                <span className="text-[#ABA3B7]">Meetings are hidden: the meetings API doesn’t say who organises each meeting.</span>
              )}
              {tasksTruncated && <span className="text-amber-300">Showing the 100 most recent tasks (the tasks API limit).</span>}
              {loadError && (
                <span className="text-rose-300">
                  {loadError}{' '}
                  <button onClick={() => Promise.all([loadTasks(), loadMeetings()]).then(() => setLoadError(null)).catch(() => {})} className="underline">
                    Retry
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0">
            {view === 'month' ? (
              <MonthGrid
                days={range.days}
                month={anchor.getMonth()}
                meetings={calMeetings}
                tasks={calTasks}
                selectedKey={selectedKey}
                onSelect={openItem}
                onCreateAt={(d, min, rect) => openCreate(d, min, rect)}
                onOpenDay={(d) => {
                  setAnchor(d)
                  setView('day')
                }}
                onMoveTask={moveTask}
                onMoveMeetingDay={moveMeetingDay}
              />
            ) : (
              <TimeGrid
                days={range.days}
                meetings={calMeetings}
                tasks={calTasks}
                tzShort={tz.short}
                selectedKey={selectedKey}
                onSelect={openItem}
                onCreateAt={(d, min, rect) => openCreate(d, min, rect)}
                onMoveMeeting={moveMeeting}
                onMoveTask={moveTask}
              />
            )}
          </div>

          {notice && (
            <div
              role={notice.kind === 'success' ? 'status' : 'alert'}
              className={`absolute left-1/2 -translate-x-1/2 bottom-5 z-30 px-4 py-2 rounded-full text-sm shadow-lg ${notice.kind === 'success' ? 'bg-[#1D1927] text-[#EAE7EF] border border-[#302938]' : 'bg-rose-600 text-white'}`}
            >
              {notice.text}
            </div>
          )}
        </main>
      </div>

      {editor && (
        <ItemEditor
          key={JSON.stringify(editor.target.mode === 'create' ? editor.target : editor.target.mode === 'task' ? editor.target.task.id : editor.target.meeting.id)}
          target={editor.target}
          anchor={editor.anchor}
          members={members}
          currentUserId={user?.id}
          onClose={() => setEditor(null)}
          onTaskSaved={(t, message) => {
            replaceTask(t)
            setNotice({ kind: 'success', text: message })
            setEditor((e) => (e && e.target.mode === 'task' ? { ...e, target: { mode: 'task', task: t } } : null))
          }}
          onTaskDeleted={(id) => {
            setTasks((prev) => prev.filter((t) => t.id !== id))
            setEditor(null)
            setNotice({ kind: 'success', text: 'Task deleted.' })
          }}
          onMeetingSaved={(m, message) => {
            replaceMeeting(m)
            setEditor(null)
            setNotice({ kind: 'success', text: message })
          }}
          onMeetingDeleted={(id) => {
            setMeetings((prev) => prev.filter((m) => m.id !== id))
            setEditor(null)
            setNotice({ kind: 'success', text: 'Meeting deleted.' })
          }}
        />
      )}
    </div>
  )
}
