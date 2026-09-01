import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { followupsService } from '../../services/followups'
import { organizationsService } from '../../services/organizations'
import type { FollowUp, GroupedFollowUps } from '../../types/followup'
import type { Organization } from '../../types/organization'
import FollowUpPriorityBadge from '../../components/followups/FollowUpPriorityBadge'
import FollowUpStatusBadge from '../../components/followups/FollowUpStatusBadge'
import AddFollowUpModal from '../../components/followups/AddFollowUpModal'
import Navbar from '../../components/layout/Navbar'
import {
  Clock,
  Clock3,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  CalendarPlus,
  Search,
  Building2,
  User,
  RotateCw,
  AlertCircle,
  XCircle,
  Sparkles,
} from 'lucide-react'

type TabType = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed'

export const FollowUpsListPage: React.FC = () => {
  const [grouped, setGrouped] = useState<GroupedFollowUps>({
    overdue: [],
    today: [],
    upcoming: [],
    completed: [],
  })
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add Follow-up modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgIdForModal, setSelectedOrgIdForModal] = useState<number | null>(null)

  const fetchFollowUps = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await followupsService.getGroupedFollowUps()
      setGrouped(data)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load follow-up tasks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFollowUps()
    organizationsService
      .getOrganizations({ page_size: 100 })
      .then((res) => {
        setOrganizations(res.items)
        if (res.items.length > 0) setSelectedOrgIdForModal(res.items[0].id)
      })
      .catch((err) => console.error(err))
  }, [fetchFollowUps])

  const handleComplete = async (id: number) => {
    try {
      await followupsService.completeFollowUp(id)
      fetchFollowUps()
    } catch (err) {
      console.error('Failed to complete follow-up', err)
    }
  }

  const handleCancel = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this follow-up task?')) return
    try {
      await followupsService.cancelFollowUp(id, 'Cancelled by user')
      fetchFollowUps()
    } catch (err) {
      console.error('Failed to cancel follow-up', err)
    }
  }

  const filterList = (list: FollowUp[]) => {
    return list.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.organization_name &&
          item.organization_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.contact_name && item.contact_name.toLowerCase().includes(search.toLowerCase()))

      const matchPriority = priorityFilter === 'All' || item.priority === priorityFilter
      return matchSearch && matchPriority
    })
  }

  const overdueFiltered = filterList(grouped.overdue)
  const todayFiltered = filterList(grouped.today)
  const upcomingFiltered = filterList(grouped.upcoming)
  const completedFiltered = filterList(grouped.completed)

  const totalPending =
    overdueFiltered.length + todayFiltered.length + upcomingFiltered.length

  const renderFollowUpCard = (item: FollowUp) => {
    const isCompleted = item.status === 'Completed'
    return (
      <div
        key={item.id}
        className={`p-4 rounded-2xl border transition shadow-xl space-y-3 ${
          item.is_overdue && item.status === 'Pending'
            ? 'bg-[#150D1D] border-rose-500/30'
            : isCompleted
            ? 'bg-[#0E1520] border-slate-800/80 opacity-80'
            : 'bg-[#110B2E] border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3
              className={`text-xs sm:text-sm font-bold ${
                isCompleted ? 'text-slate-300 line-through' : 'text-white'
              }`}
            >
              {item.title}
            </h3>
            {item.description && (
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          <FollowUpPriorityBadge priority={item.priority} size="sm" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-400">
            {item.organization_name && (
              <Link
                to={`/business-development/organizations/${item.organization_id}`}
                className="flex items-center space-x-1 text-slate-300 hover:text-white transition"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{item.organization_name}</span>
              </Link>
            )}

            {item.contact_name && (
              <Link
                to={`/business-development/contacts/${item.contact_id}`}
                className="flex items-center space-x-1 text-teal-300 hover:text-teal-200 transition"
              >
                <User className="w-3.5 h-3.5 text-teal-500" />
                <span>{item.contact_name}</span>
              </Link>
            )}

            <div
              className={`flex items-center space-x-1 font-mono text-[11px] ${
                item.is_overdue && item.status === 'Pending'
                  ? 'text-rose-300 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>{item.timing_label}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isCompleted && item.status === 'Pending' && (
              <>
                <button
                  onClick={() => handleComplete(item.id)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Done</span>
                </button>
                <button
                  onClick={() => handleCancel(item.id)}
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition"
                  title="Cancel Follow-up"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {isCompleted && <FollowUpStatusBadge status="Completed" size="sm" />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />
      {/* ── Top Header ── */}
      <header className="px-6 py-5 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30">
            <Clock3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">Outreach Follow-ups</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-xs font-mono border border-amber-500/20">
                {totalPending} Pending
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Track communication tasks, presentation follow-ups, and relationship milestones
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
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Create Follow-up</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Search & Filter Bar */}
        <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task, organization, contact..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full sm:w-40 bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Queues', count: totalPending + completedFiltered.length },
            { id: 'overdue', label: 'Overdue', count: overdueFiltered.length, isWarning: true },
            { id: 'today', label: 'Today', count: todayFiltered.length },
            { id: 'upcoming', label: 'Upcoming', count: upcomingFiltered.length },
            { id: 'completed', label: 'Completed History', count: completedFiltered.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'bg-[#110B2E] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : tab.isWarning && tab.count > 0
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading follow-ups queue...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Loading Tasks</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchFollowUps}
              className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : totalPending === 0 && activeTab !== 'completed' ? (
          /* Empty State */
          <div className="p-16 rounded-2xl bg-[#110B2E] border border-slate-800 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">You're all caught up!</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No pending follow-ups due. Create action items after your meetings to keep outreach
              moving forward.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Create Follow-up</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* OVERDUE QUEUE */}
            {(activeTab === 'all' || activeTab === 'overdue') && overdueFiltered.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-rose-400 uppercase tracking-wider font-mono">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Overdue Tasks ({overdueFiltered.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {overdueFiltered.map(renderFollowUpCard)}
                </div>
              </section>
            )}

            {/* TODAY QUEUE */}
            {(activeTab === 'all' || activeTab === 'today') && todayFiltered.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Due Today ({todayFiltered.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {todayFiltered.map(renderFollowUpCard)}
                </div>
              </section>
            )}

            {/* UPCOMING QUEUE */}
            {(activeTab === 'all' || activeTab === 'upcoming') && upcomingFiltered.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Upcoming Follow-ups ({upcomingFiltered.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingFiltered.map(renderFollowUpCard)}
                </div>
              </section>
            )}

            {/* COMPLETED QUEUE */}
            {(activeTab === 'all' || activeTab === 'completed') && completedFiltered.length > 0 && (
              <section className="space-y-3 pt-4 border-t border-slate-800/60">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Completed History ({completedFiltered.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {completedFiltered.map(renderFollowUpCard)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Add Follow-up Modal with Org Selector */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white">Select Organization for Follow-up</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Organization</label>
              <select
                value={selectedOrgIdForModal || ''}
                onChange={(e) => setSelectedOrgIdForModal(Number(e.target.value))}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.organization_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Keep modal active to render AddFollowUpModal with selected org
                }}
                className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
              >
                Continue
              </button>
            </div>

            {selectedOrgIdForModal && (
              <AddFollowUpModal
                isOpen={isAddModalOpen}
                organizationId={selectedOrgIdForModal}
                organizationName={
                  organizations.find((o) => o.id === selectedOrgIdForModal)?.name
                }
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={fetchFollowUps}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default FollowUpsListPage
