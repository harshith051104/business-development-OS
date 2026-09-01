import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { opportunitiesService } from '../../services/opportunities'
import type { Opportunity, OpportunityFilters } from '../../types/opportunity'
import OpportunityStageBadge from '../../components/opportunities/OpportunityStageBadge'
import OpportunityPriorityBadge from '../../components/opportunities/OpportunityPriorityBadge'
import ChangeStageModal from '../../components/opportunities/ChangeStageModal'
import {
  Target,
  Plus,
  Search,
  Building2,
  User,
  Sparkles,
  DollarSign,
  Calendar,
  AlertTriangle,
  RotateCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react'

const STAGES = [
  'All',
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

const PRIORITIES = ['All', 'High', 'Medium', 'Low']

export const OpportunitiesListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [noNextActionCount, setNoNextActionCount] = useState<number>(0)
  const [activeCount, setActiveCount] = useState<number>(0)
  const [highPriorityCount, setHighPriorityCount] = useState<number>(0)

  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1)
  const [search, setSearch] = useState<string>(searchParams.get('search') || '')
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get('stage') || 'All')
  const [priorityFilter, setPriorityFilter] = useState<string>(
    searchParams.get('priority') || 'All'
  )
  const [noNextActionFilter, setNoNextActionFilter] = useState<boolean>(
    searchParams.get('no_next_action') === 'true'
  )

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Stage Modal
  const [stageModalOpp, setStageModalOpp] = useState<Opportunity | null>(null)

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: OpportunityFilters = {
        page,
        page_size: 15,
        search: search.trim() || undefined,
        stage: stageFilter !== 'All' ? stageFilter : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
        no_next_action: noNextActionFilter ? true : undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      }
      const data = await opportunitiesService.getOpportunities(filters)
      setOpportunities(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
      setNoNextActionCount(data.no_next_action_count)
      setActiveCount(data.active_count)
      setHighPriorityCount(data.high_priority_count)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load business opportunities.')
    } finally {
      setLoading(false)
    }
  }, [page, search, stageFilter, priorityFilter, noNextActionFilter])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchOpportunities()
  }

  const handleStageChangeConfirm = async (newStage: string, note?: string) => {
    if (!stageModalOpp) return
    await opportunitiesService.updateStage(stageModalOpp.id, newStage, note)
    setStageModalOpp(null)
    fetchOpportunities()
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-5 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Business Opportunities
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono border border-violet-500/20">
                {total} Total Opportunities
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage prospective enterprise partnerships, collaborative pilots, and deal progress
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/business-development/opportunities/new"
            className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Create Opportunity</span>
          </Link>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Warning Banner for Opportunities with No Next Action */}
        {noNextActionCount > 0 && !noNextActionFilter && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-200">
                  {noNextActionCount} Active Opportunit{noNextActionCount > 1 ? 'ies have' : 'y has'}{' '}
                  no next action set
                </h3>
                <p className="text-[11px] text-amber-300/80">
                  Assign immediate next business actions to keep partner discussions moving forward.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setNoNextActionFilter(true)
                setPage(1)
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold self-start sm:self-center transition"
            >
              Filter No Next Action ({noNextActionCount})
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunity name, organization, contact, project..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Stage Filter */}
            <div className="w-full md:w-44">
              <select
                value={stageFilter}
                onChange={(e) => {
                  setStageFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'All' ? 'All Stages' : s}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="w-full md:w-40">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p === 'All' ? 'All Priorities' : p}
                  </option>
                ))}
              </select>
            </div>

            {/* No Next Action Toggle */}
            <button
              type="button"
              onClick={() => {
                setNoNextActionFilter((prev) => !prev)
                setPage(1)
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 whitespace-nowrap ${
                noNextActionFilter
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-sm'
                  : 'bg-[#1A1040] text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>No Next Action</span>
            </button>

            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* Opportunity Cards / List */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading business opportunities...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Loading Opportunities</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchOpportunities}
              className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#110B2E] border border-slate-800 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Target className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-white">No opportunities found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create an opportunity when a business conversation begins with a target
              organization.
            </p>
            <Link
              to="/business-development/opportunities/new"
              className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Opportunity</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
                >
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        to={`/business-development/opportunities/${opp.id}`}
                        className="font-bold text-white text-sm sm:text-base hover:text-violet-300 transition"
                      >
                        {opp.name}
                      </Link>
                      <OpportunityStageBadge stage={opp.stage} size="sm" />
                      <OpportunityPriorityBadge priority={opp.priority} size="sm" />
                      {opp.estimated_value && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[11px] font-mono border border-emerald-500/20">
                          ${opp.estimated_value.toLocaleString()} {opp.currency}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      {opp.organization_name && (
                        <Link
                          to={`/business-development/organizations/${opp.organization_id}`}
                          className="flex items-center space-x-1.5 text-slate-300 hover:text-white transition"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{opp.organization_name}</span>
                        </Link>
                      )}

                      {opp.primary_contact_name && (
                        <Link
                          to={`/business-development/contacts/${opp.primary_contact_id}`}
                          className="flex items-center space-x-1.5 text-slate-300 hover:text-teal-300 transition"
                        >
                          <User className="w-3.5 h-3.5 text-teal-500" />
                          <span>{opp.primary_contact_name}</span>
                        </Link>
                      )}

                      {opp.project_title && (
                        <Link
                          to={`/business-development/showcase/${opp.project_id}`}
                          className="flex items-center space-x-1.5 text-violet-300 hover:text-violet-200 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                          <span>{opp.project_title}</span>
                        </Link>
                      )}

                      {opp.owner_name && (
                        <div className="text-slate-500 text-[11px]">
                          Owner: <span className="text-slate-300">{opp.owner_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Next Action Box */}
                    {opp.next_action ? (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-2 text-xs">
                        <span className="font-semibold text-slate-400">Next Action:</span>
                        <span className="text-slate-200">{opp.next_action}</span>
                        {opp.next_action_date && (
                          <span className="text-[11px] text-violet-400 font-mono">
                            (Due {new Date(opp.next_action_date).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-1.5 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>No next action recorded</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Quick Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => setStageModalOpp(opp)}
                      className="px-3 py-1.5 rounded-xl bg-[#1A1040] hover:bg-violet-600/20 text-violet-300 border border-slate-700 hover:border-violet-500/30 text-xs font-semibold transition"
                    >
                      Stage
                    </button>
                    <Link
                      to={`/business-development/opportunities/${opp.id}`}
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
                  opportunities)
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

      {/* Stage Change Modal */}
      {stageModalOpp && (
        <ChangeStageModal
          isOpen={!!stageModalOpp}
          opportunityName={stageModalOpp.name}
          currentStage={stageModalOpp.stage}
          onClose={() => setStageModalOpp(null)}
          onConfirm={(stg, note) => handleStageChangeConfirm(stg, note)}
        />
      )}
    </div>
  )
}
export default OpportunitiesListPage
