import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { communicationsService } from '../../services/communications'
import type { Communication, CommunicationFilters } from '../../types/communication'
import CommunicationChannelBadge from '../../components/communications/CommunicationChannelBadge'
import CommunicationDirectionBadge from '../../components/communications/CommunicationDirectionBadge'
import {
  MessageSquare,
  Plus,
  Search,
  Building2,
  User,
  Calendar,
  Clock,
  RotateCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
} from 'lucide-react'

const CHANNELS = [
  'All',
  'Email',
  'Phone',
  'LinkedIn',
  'WhatsApp',
  'Meeting',
  'Video Call',
  'In Person',
  'Other',
]

const DIRECTIONS = ['All', 'Outgoing', 'Incoming']
const DATE_RANGES = [
  { label: 'All Time', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
]

export const CommunicationsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [communications, setCommunications] = useState<Communication[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [channelCounts, setChannelCounts] = useState<Record<string, number>>({})

  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1)
  const [search, setSearch] = useState<string>(searchParams.get('search') || '')
  const [channelFilter, setChannelFilter] = useState<string>(
    searchParams.get('channel') || 'All'
  )
  const [directionFilter, setDirectionFilter] = useState<string>(
    searchParams.get('direction') || 'All'
  )
  const [dateRangeFilter, setDateRangeFilter] = useState<string>(
    searchParams.get('date_range') || ''
  )

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCommunications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: CommunicationFilters = {
        page,
        page_size: 20,
        search: search.trim() || undefined,
        channel: channelFilter !== 'All' ? channelFilter : undefined,
        direction: directionFilter !== 'All' ? directionFilter : undefined,
        date_range: (dateRangeFilter as any) || undefined,
        sort_by: 'communication_date',
        sort_order: 'desc',
      }
      const data = await communicationsService.getCommunications(filters)
      setCommunications(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
      setChannelCounts(data.channel_counts || {})
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load communications.')
    } finally {
      setLoading(false)
    }
  }, [page, search, channelFilter, directionFilter, dateRangeFilter])

  useEffect(() => {
    fetchCommunications()
  }, [fetchCommunications])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchCommunications()
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-5 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Communication & Outreach Log
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono border border-violet-500/20">
                {total} Records
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit log of emails, calls, messages, and meetings across prospective organizations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/business-development/communications/new"
            className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Record Communication</span>
          </Link>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Channel Counts Pill Bar */}
        {Object.keys(channelCounts).length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => {
                setChannelFilter('All')
                setPage(1)
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                channelFilter === 'All'
                  ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                  : 'bg-[#1A1040] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              All Channels ({total})
            </button>
            {Object.entries(channelCounts).map(([ch, count]) => (
              <button
                key={ch}
                onClick={() => {
                  setChannelFilter(ch)
                  setPage(1)
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  channelFilter === ch
                    ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                    : 'bg-[#1A1040] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {ch} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, organization, contact, summary, or content..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="w-full md:w-44">
              <select
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch === 'All' ? 'All Channels' : ch}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-40">
              <select
                value={directionFilter}
                onChange={(e) => {
                  setDirectionFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All Directions' : d}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-40">
              <select
                value={dateRangeFilter}
                onChange={(e) => {
                  setDateRangeFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {DATE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* List / Cards */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading communication records...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Loading Communications</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchCommunications}
              className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : communications.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#110B2E] border border-slate-800 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <MessageSquare className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-white">No communications recorded</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Record emails, phone calls, and direct outreach interactions to maintain relationship history.
            </p>
            <Link
              to="/business-development/communications/new"
              className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Record First Communication</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5">
              {communications.map((comm) => (
                <div
                  key={comm.id}
                  className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
                >
                  <div className="space-y-2 flex-1">
                    {/* Top Row: Date, Channel & Direction Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-300">
                        {new Date(comm.communication_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(comm.communication_date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <CommunicationChannelBadge channel={comm.channel} size="sm" />
                      <CommunicationDirectionBadge direction={comm.direction} size="sm" />
                      {comm.status !== 'Completed' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border bg-amber-500/10 text-amber-300 border-amber-500/30">
                          {comm.status}
                        </span>
                      )}
                    </div>

                    {/* Subject */}
                    <Link
                      to={`/business-development/communications/${comm.id}`}
                      className="font-bold text-white text-sm hover:text-violet-300 transition block"
                    >
                      {comm.subject}
                    </Link>

                    {/* Metadata References */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      {comm.organization_name && (
                        <Link
                          to={`/business-development/organizations/${comm.organization_id}`}
                          className="flex items-center space-x-1.5 text-slate-300 hover:text-white transition"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{comm.organization_name}</span>
                        </Link>
                      )}

                      {comm.contact_name && (
                        <Link
                          to={`/business-development/contacts/${comm.contact_id}`}
                          className="flex items-center space-x-1.5 text-slate-300 hover:text-teal-300 transition"
                        >
                          <User className="w-3.5 h-3.5 text-teal-500" />
                          <span>{comm.contact_name}</span>
                        </Link>
                      )}

                      {comm.created_by && (
                        <span className="text-[11px] text-slate-500">
                          Logged by {comm.created_by}
                        </span>
                      )}
                    </div>

                    {comm.summary && (
                      <p className="text-xs text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2">
                        {comm.summary}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    <Link
                      to={`/business-development/communications/${comm.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">
                  Page <span className="font-bold text-white">{page}</span> of {totalPages} ({total}{' '}
                  records)
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
      </main>
    </div>
  )
}
export default CommunicationsListPage
