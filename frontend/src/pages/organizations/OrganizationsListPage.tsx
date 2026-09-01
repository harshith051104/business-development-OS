import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import StatusBadge from '../../components/organizations/StatusBadge'
import PriorityBadge from '../../components/organizations/PriorityBadge'
import StatusChangeModal from '../../components/organizations/StatusChangeModal'
import { organizationsService } from '../../services/organizations'
import type {
  Organization,
  OrganizationFilterParams,
  OrganizationType,
  ConnectionStatus,
  PriorityLevel,
} from '../../types/organization'
import {
  Building2,
  Search,
  Plus,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  GitFork,
  ArrowUpDown,
  RotateCw,
  AlertCircle,
  MapPin,
  Globe,
  Inbox,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react'

const orgTypes: OrganizationType[] = [
  'Company',
  'Company Group',
  'Startup',
  'SaaS Company',
  'Technology Company',
  'Enterprise',
  'Consulting Firm',
  'Financial Services',
  'Insurance Company',
  'Manufacturing',
  'Retail',
  'Education',
  'NGO',
  'Other',
]

const statusStages: ConnectionStatus[] = [
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

const priorityLevels: PriorityLevel[] = ['High', 'Medium', 'Low']

export const OrganizationsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Search and filter states
  const [searchInput, setSearchInput] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedPriority, setSelectedPriority] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modal states
  const [statusModalOrg, setStatusModalOrg] = useState<Organization | null>(null)
  const [deleteConfirmOrg, setDeleteConfirmOrg] = useState<Organization | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false)

  // Fetch organizations
  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: OrganizationFilterParams = {
        page,
        page_size: pageSize,
        search: searchInput.trim() || undefined,
        organization_type: selectedType || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        city: selectedCity.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      const data = await organizationsService.getOrganizations(params)
      setOrganizations(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      setError(err.detail || err.message || 'Unable to load organizations directory.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchInput, selectedType, selectedStatus, selectedPriority, selectedCity, sortBy, sortOrder])

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchOrgs()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, selectedType, selectedStatus, selectedPriority, selectedCity, sortBy, sortOrder])

  useEffect(() => {
    fetchOrgs()
  }, [page, pageSize])

  const clearFilters = () => {
    setSearchInput('')
    setSelectedType('')
    setSelectedStatus('')
    setSelectedPriority('')
    setSelectedCity('')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  const hasActiveFilters =
    searchInput || selectedType || selectedStatus || selectedPriority || selectedCity

  const handleStatusChangeConfirm = async (newStatus: string, note?: string) => {
    if (!statusModalOrg) return
    try {
      await organizationsService.updateStatus(statusModalOrg.id, newStatus, note)
      fetchOrgs()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmOrg) return
    setDeleteLoading(true)
    try {
      await organizationsService.deleteOrganization(deleteConfirmOrg.id)
      setDeleteConfirmOrg(null)
      fetchOrgs()
    } catch (err: any) {
      alert(err.detail || 'Failed to delete organization')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Organizations</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono font-semibold border border-violet-500/20">
                {total} Total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Search, classify, and track target companies, organizations, and potential business partners
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <Link
              to="/business-development/organizations/new"
              className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition shadow-lg shadow-violet-600/25 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Organization</span>
            </Link>
          </div>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-4 shadow-xl space-y-3">
          {/* Top Search Row */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by organization name, city, state, type, or industry..."
                className="w-full pl-10 pr-4 py-2 bg-[#1A1040] border border-slate-700/80 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 bg-[#1A1040] p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Table View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'cards' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {/* Category/Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="">All Types</option>
              {orgTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="">All Stages</option>
              {statusStages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="">All Priorities</option>
              {priorityLevels.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-')
                setSortBy(sb)
                setSortOrder(so as 'asc' | 'desc')
              }}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-violet-500"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="name-asc">Name (A - Z)</option>
              <option value="name-desc">Name (Z - A)</option>
              <option value="priority-asc">Priority (High to Low)</option>
              <option value="updated_at-desc">Recently Updated</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center justify-center space-x-1 border border-slate-700"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Content View: Loading / Error / Empty / List ── */}
        {loading ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <RotateCw className="w-6 h-6 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Loading organizations directory...</p>
          </div>
        ) : error ? (
          <div className="bg-[#110B2E] border border-red-500/20 rounded-2xl p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-sm font-bold text-white">Error loading organizations</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchOrgs}
              className="py-1.5 px-4 rounded-xl bg-violet-600 text-white text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">No organizations found</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No organizations match your current search or filter criteria.'
                  : 'Start by adding a company, organization, or potential business partner.'}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                to="/business-development/organizations/new"
                className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Organization</span>
              </Link>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ── Table Layout ── */
          <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-[#1A1040]/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Organization</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Connection Status</th>
                    <th className="py-3.5 px-4">Updated</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {organizations.map((org) => (
                    <tr
                      key={org.id}
                      className="hover:bg-[#1A1040]/40 transition group cursor-pointer"
                      onClick={() => navigate(`/business-development/organizations/${org.id}`)}
                    >
                      {/* Name & Website */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white group-hover:text-violet-300 transition">
                          {org.name}
                        </div>
                        {org.website && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px] flex items-center gap-1 mt-0.5">
                            <Globe className="w-3 h-3 text-slate-600 shrink-0" />
                            <span>{org.website.replace(/^https?:\/\//, '')}</span>
                          </div>
                        )}
                      </td>

                      {/* Category / Type */}
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        {org.organization_type}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {org.city ? (
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>
                              {org.city}
                              {org.state ? `, ${org.state}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityBadge priority={org.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={org.status} />
                      </td>

                      {/* Updated Date */}
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(org.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Action Menu */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setStatusModalOrg(org)}
                            title="Change Connection Status"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-violet-500/20 text-slate-400 hover:text-violet-300 border border-slate-800 transition"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/business-development/organizations/${org.id}`}
                            title="View Profile"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/business-development/organizations/${org.id}/edit`}
                            title="Edit Organization"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => setDeleteConfirmOrg(org)}
                            title="Delete Organization"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── Cards Layout ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                onClick={() => navigate(`/business-development/organizations/${org.id}`)}
                className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800/80 hover:border-violet-500/40 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-[#1A1040] border border-slate-800">
                        <Building2 className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm group-hover:text-violet-300 transition">
                          {org.name}
                        </h3>
                        <span className="text-[11px] text-slate-400">{org.organization_type}</span>
                      </div>
                    </div>
                    <PriorityBadge priority={org.priority} />
                  </div>

                  <div className="flex items-center space-x-2 my-3">
                    <StatusBadge status={org.status} size="md" />
                  </div>

                  {org.city && (
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {org.city}
                        {org.state ? `, ${org.state}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="pt-3 border-t border-slate-800/60 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500 font-mono">
                    Updated{' '}
                    {new Date(org.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setStatusModalOrg(org)}
                      className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-violet-500/20 text-slate-400 hover:text-violet-300 border border-slate-800"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      to={`/business-development/organizations/${org.id}/edit`}
                      className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination Controls ── */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(page * pageSize, total)}
              </span>{' '}
              of <span className="font-semibold text-white">{total}</span> organizations
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-[#110B2E] border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 rounded-xl bg-[#110B2E] border border-slate-800 font-mono text-white">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-[#110B2E] border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Status Change Modal ── */}
      {statusModalOrg && (
        <StatusChangeModal
          isOpen={!!statusModalOrg}
          organizationName={statusModalOrg.name}
          currentStatus={statusModalOrg.status}
          onClose={() => setStatusModalOrg(null)}
          onConfirm={handleStatusChangeConfirm}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2.5 text-red-400">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Delete Organization</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">{deleteConfirmOrg.name}</span>? This will
              archive the organization from your active BD directory.
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOrg(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default OrganizationsListPage
