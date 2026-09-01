import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { meetingsService } from '../../services/meetings'
import type { Meeting, MeetingFilters } from '../../types/meeting'
import MeetingStatusBadge from '../../components/meetings/MeetingStatusBadge'
import CompleteMeetingModal from '../../components/meetings/CompleteMeetingModal'
import CalendarView from '../../components/calendar/CalendarView'
import Navbar from '../../components/layout/Navbar'
import {
  Calendar,
  CalendarPlus,
  Search,
  Filter,
  Building2,
  User,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  AlertCircle,
  Sparkles,
  ExternalLink,
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

export const MeetingsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1)
  const [search, setSearch] = useState<string>(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'All')
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('meeting_type') || 'All')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Complete Modal State
  const [completeModalMeeting, setCompleteModalMeeting] = useState<Meeting | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: MeetingFilters = {
        page,
        page_size: 15,
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

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchMeetings()
  }

  const handleCompleteSuccess = () => {
    setCompleteModalMeeting(null)
    fetchMeetings()
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />
      {/* ── Top Header ── */}
      <header className="px-6 py-5 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">Business Meetings</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono border border-violet-500/20">
                {total} Scheduled / Logged
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Schedule presentations, record executive discussions, and log next steps
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/business-development"
            className="text-xs text-slate-400 hover:text-white transition hidden sm:inline"
          >
            ← Dashboard
          </Link>
          <Link
            to="/business-development/meetings/new"
            className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </Link>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-xs font-medium transition ${
                viewMode === 'list'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
              Upcoming
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-md text-xs font-medium transition ${
                viewMode === 'calendar'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
              Calendar
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 text-[10px]">
                Google
              </span>
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <CalendarView
            onEventClick={(e) => {
              window.location.href = `/business-development/meetings/${e.id}`
            }}
            height="calc(100vh - 300px)"
          />
        ) : (
          <>
            {/* Search & Filters Bar */}
            <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search meeting subject, organization, contact..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            {/* Type Filter */}
            <div className="w-full md:w-52">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'All' ? 'All Meeting Types' : t}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-44">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                {MEETING_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st === 'All' ? 'All Statuses' : st}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* Meeting List Table / Cards */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading business meetings...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Loading Meetings</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchMeetings}
              className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#110B2E] border border-slate-800 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Calendar className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-white">No meetings scheduled</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Schedule your first partner presentation, project briefing, or introduction meeting.
            </p>
            <Link
              to="/business-development/meetings/new"
              className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Schedule First Meeting</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {meetings.map((m) => {
                const meetingDate = new Date(m.scheduled_at)
                return (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
                  >
                    {/* Left: Meeting Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          to={`/business-development/meetings/${m.id}`}
                          className="font-bold text-white text-sm sm:text-base hover:text-violet-300 transition"
                        >
                          {m.title}
                        </Link>
                        <MeetingStatusBadge status={m.status} size="sm" />
                        <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 text-[11px] font-mono border border-violet-500/20">
                          {m.meeting_type}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        {m.organization_name && (
                          <Link
                            to={`/business-development/organizations/${m.organization_id}`}
                            className="flex items-center space-x-1.5 text-slate-300 hover:text-white transition"
                          >
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{m.organization_name}</span>
                          </Link>
                        )}

                        {m.primary_contact_name && (
                          <Link
                            to={`/business-development/contacts/${m.primary_contact_id}`}
                            className="flex items-center space-x-1.5 text-slate-300 hover:text-teal-300 transition"
                          >
                            <User className="w-3.5 h-3.5 text-teal-500" />
                            <span>{m.primary_contact_name}</span>
                          </Link>
                        )}

                        <div className="flex items-center space-x-1.5 text-slate-300 font-mono">
                          <Clock className="w-3.5 h-3.5 text-violet-400" />
                          <span>
                            {meetingDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            at{' '}
                            {meetingDate.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            ({m.duration_minutes}m)
                          </span>
                        </div>

                        {m.location && (
                          <div className="flex items-center space-x-1 text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>{m.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                      {m.meeting_url && (
                        <a
                          href={m.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
                          title="Open Video Call"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {m.status === 'Scheduled' && (
                        <button
                          onClick={() => setCompleteModalMeeting(m)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      )}

                      <Link
                        to={`/business-development/meetings/${m.id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">
                  Page <span className="font-bold text-white">{page}</span> of {totalPages} ({total}{' '}
                  total meetings)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}
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
