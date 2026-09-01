import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { partnershipsService } from '../../services/partnerships'
import type { Partnership, PartnershipStats } from '../../types/partnership'
import PartnershipTypeBadge from '../../components/partnerships/PartnershipTypeBadge'
import PartnershipStatusBadge from '../../components/partnerships/PartnershipStatusBadge'
import PriorityBadge from '../../components/organizations/PriorityBadge'
import {
  Handshake,
  Plus,
  Search,
  Filter,
  Building2,
  Users,
  Target,
  Sparkles,
  RotateCw,
  AlertCircle,
  Clock3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileText,
} from 'lucide-react'

export const PartnershipsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [stats, setStats] = useState<PartnershipStats | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Filters
  const [search, setSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [priorityFilter, setPriorityFilter] = useState<string>('All')
  const [quickFilter, setQuickFilter] = useState<'all' | 'ending_soon' | 'needs_attention'>('all')

  const [loading, setLoading] = useState<boolean>(false)

  const fetchStats = async () => {
    try {
      const data = await partnershipsService.getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load partnership stats:', err)
    }
  }

  const fetchPartnerships = useCallback(async () => {
    setLoading(true)
    try {
      const res = await partnershipsService.listPartnerships({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        partnership_type: typeFilter !== 'All' ? typeFilter : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
        ending_soon: quickFilter === 'ending_soon' ? true : undefined,
        needs_attention: quickFilter === 'needs_attention' ? true : undefined,
      })
      setPartnerships(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (err) {
      console.error('Failed to load partnerships:', err)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter, typeFilter, priorityFilter, quickFilter])

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchPartnerships()
  }, [fetchPartnerships])

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Partnership Management
            </h1>
            <p className="text-xs text-slate-400">
              Manage strategic alliances, partner relationships, agreed objectives, and business execution
            </p>
          </div>
        </div>

        <Link
          to="/business-development/partnerships/new"
          className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>New Partnership</span>
        </Link>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ── Top Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setQuickFilter('all')
              setStatusFilter('Active')
              setPage(1)
            }}
            className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-violet-500/40 cursor-pointer transition shadow-xl space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Active Partnerships</span>
              <Handshake className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {stats?.active_partnerships ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">
              Total recorded: {stats?.total_partnerships ?? 0}
            </div>
          </div>

          <div
            onClick={() => {
              setQuickFilter('all')
              setPage(1)
            }}
            className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-violet-500/40 cursor-pointer transition shadow-xl space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">New This Month</span>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {stats?.new_this_month ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">Established in current cycle</div>
          </div>

          <div
            onClick={() => {
              setQuickFilter('ending_soon')
              setPage(1)
            }}
            className={`p-4 rounded-2xl border cursor-pointer transition shadow-xl space-y-2 ${
              quickFilter === 'ending_soon'
                ? 'bg-amber-500/10 border-amber-500/50'
                : 'bg-[#110B2E] border-slate-800 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-amber-300">Ending Soon (30d)</span>
              <Clock3 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">
              {stats?.ending_soon_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">Requires renewal or status update</div>
          </div>

          <div
            onClick={() => {
              setQuickFilter('needs_attention')
              setPage(1)
            }}
            className={`p-4 rounded-2xl border cursor-pointer transition shadow-xl space-y-2 ${
              quickFilter === 'needs_attention'
                ? 'bg-rose-500/10 border-rose-500/50'
                : 'bg-[#110B2E] border-slate-800 hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-rose-300">Needs Attention</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400 font-mono">
              {stats?.needs_attention_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">No scheduled next action</div>
          </div>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search partnerships, orgs, contacts, projects..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Ended">Ended</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="sm:col-span-3">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="All">All Types</option>
                <option value="Technology Partnership">Technology Partnership</option>
                <option value="Business Partnership">Business Partnership</option>
                <option value="Strategic Partnership">Strategic Partnership</option>
                <option value="Integration Partnership">Integration Partnership</option>
                <option value="Service Partnership">Service Partnership</option>
                <option value="Distribution Partnership">Distribution Partnership</option>
                <option value="Referral Partnership">Referral Partnership</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="sm:col-span-2">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Partnerships Listing ── */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading business partnerships...</p>
          </div>
        ) : partnerships.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xl">
            <Handshake className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No active partnerships yet.</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Partnerships created from business opportunities or established with partner organizations will appear here.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <Link
                to="/business-development/opportunities"
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                View Opportunities
              </Link>
              <Link
                to="/business-development/partnerships/new"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition shadow-lg shadow-violet-600/30"
              >
                Create Partnership
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">Partnership / Project</th>
                    <th className="p-3.5 font-semibold">Organization</th>
                    <th className="p-3.5 font-semibold">Contact</th>
                    <th className="p-3.5 font-semibold">Type</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Priority</th>
                    <th className="p-3.5 font-semibold">Owner</th>
                    <th className="p-3.5 font-semibold">Next Action</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {partnerships.map((p) => (
                    <tr key={p.id} className="hover:bg-[#1A1040]/40 transition">
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <Link
                            to={`/business-development/partnerships/${p.id}`}
                            className="font-bold text-white hover:text-violet-300 transition block truncate max-w-xs"
                          >
                            {p.name}
                          </Link>
                          {p.project_name && (
                            <span className="inline-flex items-center space-x-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{p.project_name}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <Link
                          to={`/business-development/organizations/${p.organization_id}`}
                          className="font-medium text-slate-200 hover:text-violet-300 transition"
                        >
                          {p.organization_name || `Org #${p.organization_id}`}
                        </Link>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        {p.primary_contact_name ? (
                          <Link
                            to={`/business-development/contacts/${p.primary_contact_id}`}
                            className="hover:text-violet-300 transition"
                          >
                            {p.primary_contact_name}
                          </Link>
                        ) : (
                          <span className="text-slate-500 italic">General Account</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <PartnershipTypeBadge type={p.partnership_type} size="sm" />
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          <PartnershipStatusBadge status={p.status} size="sm" />
                          {p.is_ending_soon && (
                            <span className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                              Ending Soon
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <PriorityBadge priority={p.priority} size="sm" />
                      </td>

                      <td className="p-3.5 text-slate-300">
                        {p.owner_name || <span className="text-slate-500 italic">Unassigned</span>}
                      </td>

                      <td className="p-3.5 max-w-xs">
                        {p.next_action ? (
                          <div className="space-y-0.5">
                            <span className="text-slate-200 truncate block text-[11px]">
                              {p.next_action}
                            </span>
                            {p.next_action_date && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Due: {new Date(p.next_action_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>Next action required</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <Link
                          to={`/business-development/partnerships/${p.id}`}
                          className="py-1 px-2.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Page {page} of {totalPages} (Total: {total})
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 disabled:opacity-40"
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
export default PartnershipsListPage
