import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { meetingsService } from '../../services/meetings'
import type { Meeting, MeetingFilters } from '../../types/meeting'
import CompleteMeetingModal from '../../components/meetings/CompleteMeetingModal'
import { parseMeetingDate } from '../../utils/date'
import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  CalendarPlus,
  Search,
  Building2,
  User,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  AlertCircle,
  ArrowRight,
  Users,
  MessageSquare,
  Layers,
  Monitor,
  BarChart3,
  Clock3,
} from 'lucide-react'

const MEETING_TYPES = [
  'All',
  'Introduction',
  'Project Showcase',
  'Business Discussion',
  'Partnership Discussion',
  'Technical Discussion',
  'Follow-up',
]

const MEETING_STATUSES = ['All', 'Scheduled', 'Completed', 'Rescheduled', 'Cancelled']

const PAGE_SIZE = 5

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string; icon: LucideIcon }> = {
  Introduction: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-l-amber-400', icon: MessageSquare },
  'Project Showcase': { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-l-violet-400', icon: Video },
  'Partnership Discussion': { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-l-emerald-400', icon: Users },
  'Technical Discussion': { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-l-indigo-400', icon: Layers },
  'Business Discussion': { bg: 'bg-teal-500/10', text: 'text-teal-300', border: 'border-l-teal-400', icon: Monitor },
  'Follow-up': { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-l-slate-400', icon: RotateCw },
  Other: { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-l-slate-400', icon: Calendar },
}

const typeStyle = (type: string) => TYPE_STYLE[type] || TYPE_STYLE.Other

const STATUS_STYLE: Record<string, string> = {
  Scheduled: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  Completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  Rescheduled: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  Cancelled: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
}

// 12-point-style sparkline for the Meeting Overview stat tile: de-emphasis
// line for history, accent dot + segment for the current (last) period.
const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return null
  const width = 120
  const height = 32
  const pad = 3
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const points = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (width - pad * 2),
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const lastSegment = points.slice(-2)
  const lastPath =
    lastSegment.length === 2 ? `M${lastSegment[0].x.toFixed(1)},${lastSegment[0].y.toFixed(1)} L${lastSegment[1].x.toFixed(1)},${lastSegment[1].y.toFixed(1)}` : ''
  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke="#3a3a52" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {lastPath && <path d={lastPath} fill="none" stroke="#34D399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={last.x} cy={last.y} r={2.5} fill="#34D399" />
    </svg>
  )
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Starting now'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  if (days >= 1) {
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    return `${days}d ${hours}h`
  }
  const hours = Math.floor(totalSeconds / 3600)
  if (hours >= 1) {
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

interface StatusCounts {
  Scheduled: number
  Completed: number
  Rescheduled: number
  Cancelled: number
}

export const MeetingsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1)
  const [search, setSearch] = useState<string>(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'All')
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('meeting_type') || 'All')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    Scheduled: 0,
    Completed: 0,
    Rescheduled: 0,
    Cancelled: 0,
  })
  const [thisWeekCount, setThisWeekCount] = useState<number>(0)
  const [weeklyTrend, setWeeklyTrend] = useState<number[]>([])
  const [trendPercent, setTrendPercent] = useState<number | null>(null)
  const [upNext, setUpNext] = useState<Meeting[]>([])
  const [sidePanelLoading, setSidePanelLoading] = useState(true)
  const [autoEnter, setAutoEnter] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const launchedMeetingIdRef = useRef<number | null>(null)

  // Complete Modal State
  const [completeModalMeeting, setCompleteModalMeeting] = useState<Meeting | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: MeetingFilters = {
        page,
        page_size: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        meeting_type: typeFilter !== 'All' ? typeFilter : undefined,
        sort_by: 'scheduled_at',
        sort_order: 'desc',
      }
      const data = await meetingsService.getMeetings(filters)
      setMeetings(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load business meetings.')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, typeFilter])

  const fetchSidePanelData = useCallback(async () => {
    setSidePanelLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const startOfWeek = new Date()
      startOfWeek.setHours(0, 0, 0, 0)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 7)

      // Trailing 8 calendar weeks (oldest -> newest, this week last), for the
      // Meeting Overview sparkline + week-over-week trend %.
      const WEEK_COUNT = 8
      const weekRanges = Array.from({ length: WEEK_COUNT }, (_, i) => {
        const from = new Date(startOfWeek)
        from.setDate(from.getDate() - (WEEK_COUNT - 1 - i) * 7)
        const to = new Date(from)
        to.setDate(to.getDate() + 7)
        return { date_from: from.toISOString(), date_to: to.toISOString() }
      })

      const [scheduled, completed, rescheduled, cancelled, week, next, ...weeks] = await Promise.all([
        meetingsService.getMeetings({ status: 'Scheduled', page: 1, page_size: 1 }),
        meetingsService.getMeetings({ status: 'Completed', page: 1, page_size: 1 }),
        meetingsService.getMeetings({ status: 'Rescheduled', page: 1, page_size: 1 }),
        meetingsService.getMeetings({ status: 'Cancelled', page: 1, page_size: 1 }),
        meetingsService.getMeetings({
          date_from: startOfWeek.toISOString(),
          date_to: endOfWeek.toISOString(),
          page: 1,
          page_size: 1,
        }),
        meetingsService.getMeetings({
          status: 'Scheduled',
          date_from: nowIso,
          sort_by: 'scheduled_at',
          sort_order: 'asc',
          page: 1,
          page_size: 3,
        }),
        ...weekRanges.map((r) => meetingsService.getMeetings({ ...r, page: 1, page_size: 1 })),
      ])

      setStatusCounts({
        Scheduled: scheduled.total,
        Completed: completed.total,
        Rescheduled: rescheduled.total,
        Cancelled: cancelled.total,
      })
      setThisWeekCount(week.total)
      setUpNext(next.items)

      const counts = weeks.map((w) => w.total)
      setWeeklyTrend(counts)
      const priorWeek = counts[counts.length - 2]
      const currentWeek = counts[counts.length - 1]
      setTrendPercent(priorWeek > 0 ? Math.round(((currentWeek - priorWeek) / priorWeek) * 100) : null)
    } catch {
      // Side panel is supplementary; a failure here shouldn't block the main list.
    } finally {
      setSidePanelLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  useEffect(() => {
    fetchSidePanelData()
  }, [fetchSidePanelData])

  useEffect(() => {
    if (upNext.length === 0) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [upNext.length])

  const liveMeeting = upNext[0]
  const liveMeetingDate = liveMeeting ? parseMeetingDate(liveMeeting.scheduled_at) : null
  const liveMeetingDiffMs = liveMeetingDate ? liveMeetingDate.getTime() - now : 0

  useEffect(() => {
    if (!autoEnter || !liveMeeting?.meeting_url) return
    if (liveMeetingDiffMs <= 0 && launchedMeetingIdRef.current !== liveMeeting.id) {
      launchedMeetingIdRef.current = liveMeeting.id
      const meetingUrl = liveMeeting.meeting_url
      // Best-effort: works only if the user already granted popup permission
      // for this site, since this runs off a timer tick, not a click.
      window.open(meetingUrl, '_blank', 'noopener,noreferrer')
      // A click on a system notification IS a trusted user gesture, so
      // window.open() from its onclick is not blocked - the reliable path.
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(`Launching Meeting: ${liveMeeting.title}`, {
          body: `Entering meeting with ${liveMeeting.organization_name || 'Prospect'} - click to join`,
          requireInteraction: true,
        })
        notification.onclick = () => {
          window.open(meetingUrl, '_blank', 'noopener,noreferrer')
          window.focus()
          notification.close()
        }
      }
    }
  }, [autoEnter, liveMeeting, liveMeetingDiffMs])

  const totalMeetingsAll = useMemo(
    () => statusCounts.Scheduled + statusCounts.Completed + statusCounts.Rescheduled + statusCounts.Cancelled,
    [statusCounts]
  )

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const handleCompleteSuccess = () => {
    setCompleteModalMeeting(null)
    fetchMeetings()
    fetchSidePanelData()
  }

  return (
    <div className="relative min-h-screen bg-[#0E0B1D] text-[#C9C2E3] pb-8 md:pl-64 overflow-hidden">
      {/* Decorative background shapes - purely visual, no interaction */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-24 w-[32rem] h-[32rem] rounded-full bg-violet-600/10 blur-[100px]" />
        <div className="absolute top-1/3 -left-40 w-[28rem] h-[28rem] rounded-full bg-indigo-600/10 blur-[110px]" />
        <div className="absolute bottom-0 right-1/4 w-[24rem] h-[24rem] rounded-full bg-fuchsia-600/[0.06] blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Meetings</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono font-semibold border border-violet-500/20">
                {total} total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Plan, conduct, and track meetings with prospects and partners.
            </p>
          </div>

          <Link
            to="/business-development/meetings/new"
            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition shrink-0 w-fit"
          >
            <CalendarPlus className="w-4 h-4" />
            Schedule Meeting
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left: stats + search + list */}
          <div className="flex-1 w-full min-w-0 space-y-3">
            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Scheduled', value: statusCounts.Scheduled, icon: Calendar, text: 'text-blue-300' },
                { label: 'Completed', value: statusCounts.Completed, icon: CheckCircle2, text: 'text-emerald-300' },
                { label: 'Rescheduled', value: statusCounts.Rescheduled, icon: RotateCw, text: 'text-amber-300' },
                { label: 'Cancelled', value: statusCounts.Cancelled, icon: XCircle, text: 'text-rose-300' },
              ].map((tile) => (
                <div key={tile.label} className="p-2.5 rounded-xl bg-[#0E0B1D] border border-slate-800/90 flex items-center gap-2.5">
                  <tile.icon className={`w-4 h-4 shrink-0 ${tile.text}`} />
                  <div>
                    <div className="text-base font-extrabold text-white leading-none">
                      {sidePanelLoading ? '–' : tile.value}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{tile.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Search & Filters Bar */}
            <div className="bg-[#0E0B1D] border border-slate-800/90 rounded-xl p-3">
              <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by title, organization, or contact..."
                    className="w-full bg-[#2A1E4D] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full md:w-52 bg-[#2A1E4D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition"
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === 'All' ? 'All Types' : t}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full md:w-44 bg-[#2A1E4D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition"
                >
                  {MEETING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st === 'All' ? 'All Status' : st}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </form>
            </div>

            {/* Meeting List */}
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <RotateCw className="w-7 h-7 animate-spin text-violet-400 mx-auto" />
                <p className="text-sm text-slate-400">Loading meetings...</p>
              </div>
            ) : error ? (
              <div className="p-8 rounded-xl bg-[#0E0B1D] border border-rose-500/30 text-center space-y-3">
                <AlertCircle className="w-7 h-7 text-rose-400 mx-auto" />
                <h3 className="text-sm font-bold text-white">Error loading meetings</h3>
                <p className="text-xs text-slate-400">{error}</p>
                <button
                  onClick={fetchMeetings}
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
                >
                  Retry
                </button>
              </div>
            ) : meetings.length === 0 ? (
              <div className="p-16 rounded-xl bg-[#0E0B1D] border border-slate-800/90 text-center space-y-4">
                <Calendar className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
                <h3 className="text-base font-bold text-white">No meetings scheduled</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Schedule your first partner presentation, project briefing, or introduction meeting.
                </p>
                <Link
                  to="/business-development/meetings/new"
                  className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Schedule First Meeting</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {meetings.map((m) => {
                    const meetingDate = parseMeetingDate(m.scheduled_at)
                    const style = typeStyle(m.meeting_type)
                    const TypeIcon = style.icon
                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-xl bg-[#0E0B1D] border border-slate-800/90 border-l-4 ${style.border} hover:border-slate-700 transition flex flex-col md:flex-row md:items-center gap-4`}
                      >
                        <div className={`w-10 h-10 rounded-lg ${style.bg} ${style.text} flex items-center justify-center shrink-0`}>
                          <TypeIcon className="w-4.5 h-4.5" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Link
                            to={`/business-development/meetings/${m.id}`}
                            className="font-bold text-white text-sm hover:text-violet-300 transition block"
                          >
                            {m.title}
                          </Link>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${style.bg} ${style.text}`}>
                            {m.meeting_type}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-slate-400 min-w-0 md:w-48">
                          {m.organization_name && (
                            <Link
                              to={`/business-development/organizations/${m.organization_id}`}
                              className="flex items-center gap-1.5 hover:text-violet-300 transition truncate"
                            >
                              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{m.organization_name}</span>
                            </Link>
                          )}
                          {m.primary_contact_name && (
                            <Link
                              to={`/business-development/contacts/${m.primary_contact_id}`}
                              className="flex items-center gap-1.5 hover:text-violet-300 transition truncate"
                            >
                              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{m.primary_contact_name}</span>
                            </Link>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-slate-400 md:w-44 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              {meetingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })},{' '}
                              {meetingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{m.duration_minutes} min</span>
                          </div>
                          {m.location && (
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{m.location}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLE[m.status] || 'bg-slate-500/10 text-slate-300 border border-slate-500/20'}`}>
                            {m.status}
                          </span>
                          {m.meeting_url && (
                            <a
                              href={m.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-[#2A1E4D] hover:bg-indigo-500/20 text-indigo-300 transition"
                              title="Open Video Call"
                            >
                              <Video className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {m.status === 'Scheduled' && (
                            <button
                              onClick={() => setCompleteModalMeeting(m)}
                              className="p-2 rounded-lg bg-[#2A1E4D] hover:bg-emerald-500/20 text-emerald-300 transition"
                              title="Mark Complete"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link
                            to={`/business-development/meetings/${m.id}`}
                            className="p-2 rounded-lg bg-[#2A1E4D] hover:bg-violet-500/20 text-violet-300 transition"
                            title="View details"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} meetings
                      · Page{' '}
                      <span className="font-bold text-slate-300">{page}</span> of {totalPages}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        className="p-2 rounded-xl bg-[#0E0B1D] border border-slate-800/90 text-slate-400 disabled:opacity-40 hover:bg-[#2A1E4D] transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        disabled={page === totalPages}
                        className="p-2 rounded-xl bg-[#0E0B1D] border border-slate-800/90 text-slate-400 disabled:opacity-40 hover:bg-[#2A1E4D] transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: side panels */}
          <div className="w-full lg:w-80 shrink-0 space-y-3">
            {/* Meeting Overview */}
            <div className="p-4 rounded-xl bg-[#0E0B1D] border border-slate-800/90">
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <BarChart3 className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Meeting Overview</h3>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-3xl font-extrabold text-white">
                    {sidePanelLoading ? '–' : totalMeetingsAll}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Total meetings on record</div>
                </div>
                {!sidePanelLoading && weeklyTrend.length >= 2 && (
                  <div className="flex flex-col items-end gap-1">
                    <Sparkline values={weeklyTrend} />
                    {trendPercent !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                          trendPercent >= 0
                            ? 'text-emerald-300 bg-emerald-500/10'
                            : 'text-rose-300 bg-rose-500/10'
                        }`}
                      >
                        {trendPercent >= 0 ? '↑' : '↓'}
                        {trendPercent >= 0 ? '+' : ''}
                        {trendPercent}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                <span className="font-bold text-slate-200">{sidePanelLoading ? '–' : thisWeekCount}</span> scheduled this
                week
                {trendPercent !== null && <span className="text-slate-600"> · vs prior week</span>}
              </div>
            </div>

            {/* Up Next */}
            <div className="p-4 rounded-xl bg-[#0E0B1D] border border-slate-800/90">
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <Clock className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Up Next</h3>
              </div>
              {sidePanelLoading ? (
                <p className="text-xs text-slate-500">Loading…</p>
              ) : upNext.length === 0 ? (
                <p className="text-xs text-slate-500">No upcoming meetings scheduled.</p>
              ) : (
                <ul className="space-y-3">
                  {upNext.map((m) => {
                    const d = parseMeetingDate(m.scheduled_at)
                    const style = typeStyle(m.meeting_type)
                    return (
                      <li key={m.id} className="flex items-start gap-2.5">
                        <span className={`mt-1 w-2 h-2 rounded-full ${style.text.replace('text-', 'bg-')} shrink-0`} />
                        <Link to={`/business-development/meetings/${m.id}`} className="min-w-0 group">
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-violet-300 transition truncate">
                            {m.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                            {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {m.duration_minutes}{' '}
                            min
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Live Meeting */}
            {liveMeeting && liveMeetingDate && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-700 to-indigo-800 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                    <span className="text-xs font-semibold text-violet-100">
                      {liveMeetingDiffMs <= 0 ? 'Live now' : 'Next meeting'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-white/10 rounded-full px-2.5 py-1">
                    {liveMeetingDiffMs <= 0 ? 'Live' : `Starts in ${formatCountdown(liveMeetingDiffMs)}`}
                  </span>
                </div>
                <div>
                  <div className="font-bold text-sm">{liveMeeting.title}</div>
                  <div className="text-xs text-violet-200 mt-0.5">
                    {liveMeeting.organization_name}
                    {liveMeeting.primary_contact_name ? ` · ${liveMeeting.primary_contact_name}` : ''}
                  </div>
                </div>
                <label className="flex items-center justify-between text-xs text-violet-100 cursor-pointer">
                  <span>Auto-enter on time</span>
                  <input
                    type="checkbox"
                    checked={autoEnter}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setAutoEnter(checked)
                      if (checked && 'Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission().catch(() => {})
                      }
                    }}
                    className="w-4 h-4 accent-white"
                  />
                </label>
                <a
                  href={liveMeeting.meeting_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!liveMeeting.meeting_url}
                  onClick={(e) => {
                    if (!liveMeeting.meeting_url) e.preventDefault()
                  }}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition ${
                    liveMeeting.meeting_url
                      ? 'bg-white text-violet-700 hover:bg-violet-50'
                      : 'bg-white/20 text-white/60 cursor-not-allowed'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  {liveMeeting.meeting_url ? 'Enter Meeting Now' : 'No video link set'}
                </a>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Complete Meeting Modal */}
      {completeModalMeeting && (
        <CompleteMeetingModal
          isOpen={!!completeModalMeeting}
          meetingTitle={completeModalMeeting.title}
          organizationName={completeModalMeeting.organization_name}
          onClose={() => setCompleteModalMeeting(null)}
          onConfirm={async (data) => {
            await meetingsService.completeMeeting(completeModalMeeting.id, data)
            handleCompleteSuccess()
          }}
        />
      )}
    </div>
  )
}
export default MeetingsListPage
