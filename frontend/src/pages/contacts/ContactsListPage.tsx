import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import ContactStatusBadge from '../../components/contacts/ContactStatusBadge'
import DecisionMakerBadge from '../../components/contacts/DecisionMakerBadge'
import PrimaryContactBadge from '../../components/contacts/PrimaryContactBadge'
import ContactStatusModal from '../../components/contacts/ContactStatusModal'
import { contactsService } from '../../services/contacts'
import { organizationsService } from '../../services/organizations'
import type { Contact, ContactFilterParams, ContactRelationshipStatus } from '../../types/contact'
import type { Organization } from '../../types/organization'
import {
  Users,
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
  RotateCw,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Inbox,
  LayoutGrid,
  List as ListIcon,
  Award,
  Star,
} from 'lucide-react'

const contactStatuses: ContactRelationshipStatus[] = [
  'Not Contacted',
  'Contacted',
  'Connected',
  'Interested',
  'Inactive',
]

export const ContactsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Filter and search states
  const [searchInput, setSearchInput] = useState<string>('')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedDecisionMaker, setSelectedDecisionMaker] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals
  const [statusModalContact, setStatusModalContact] = useState<Contact | null>(null)
  const [deleteConfirmContact, setDeleteConfirmContact] = useState<Contact | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false)

  // Fetch organization list for filter dropdown
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const data = await organizationsService.getOrganizations({ page_size: 100 })
        setOrganizations(data.items)
      } catch (err) {
        console.error(err)
      }
    }
    loadOrgs()
  }, [])

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: ContactFilterParams = {
        page,
        page_size: pageSize,
        search: searchInput.trim() || undefined,
        organization_id: selectedOrgId ? Number(selectedOrgId) : undefined,
        is_decision_maker:
          selectedDecisionMaker === 'yes' ? true : selectedDecisionMaker === 'no' ? false : undefined,
        connection_status: selectedStatus || undefined,
        department: selectedDepartment.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      const data = await contactsService.getContacts(params)
      setContacts(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      setError(err.detail || err.message || 'Unable to load contacts directory.')
    } finally {
      setLoading(false)
    }
  }, [
    page,
    pageSize,
    searchInput,
    selectedOrgId,
    selectedDecisionMaker,
    selectedStatus,
    selectedDepartment,
    sortBy,
    sortOrder,
  ])

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchContacts()
    }, 300)
    return () => clearTimeout(timer)
  }, [
    searchInput,
    selectedOrgId,
    selectedDecisionMaker,
    selectedStatus,
    selectedDepartment,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    fetchContacts()
  }, [page, pageSize])

  const clearFilters = () => {
    setSearchInput('')
    setSelectedOrgId('')
    setSelectedDecisionMaker('')
    setSelectedStatus('')
    setSelectedDepartment('')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  const hasActiveFilters =
    searchInput || selectedOrgId || selectedDecisionMaker || selectedStatus || selectedDepartment

  const handleStatusChangeConfirm = async (newStatus: string, note?: string) => {
    if (!statusModalContact) return
    try {
      await contactsService.updateStatus(statusModalContact.id, newStatus, note)
      fetchContacts()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmContact) return
    setDeleteLoading(true)
    try {
      await contactsService.deleteContact(deleteConfirmContact.id)
      setDeleteConfirmContact(null)
      fetchContacts()
    } catch (err: any) {
      alert(err.detail || 'Failed to delete contact')
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
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Business Contacts</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 text-xs font-mono font-semibold border border-teal-500/20">
                {total} Total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Identify decision-makers, track outreach status, and maintain relationship history
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <Link
              to="/business-development/contacts/new"
              className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs transition shadow-lg shadow-teal-600/25 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </Link>
          </div>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by contact name, organization, designation, email, or phone..."
                className="w-full pl-10 pr-4 py-2 bg-[#1A1040] border border-slate-700/80 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
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

            {/* Layout Toggle */}
            <div className="flex items-center space-x-1 bg-[#1A1040] p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Table View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'cards' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {/* Organization Filter */}
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>

            {/* Decision Maker Filter */}
            <select
              value={selectedDecisionMaker}
              onChange={(e) => setSelectedDecisionMaker(e.target.value)}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="">Decision Maker: All</option>
              <option value="yes">Decision Makers Only</option>
              <option value="no">Non-Decision Makers</option>
            </select>

            {/* Connection Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="">All Relationship Statuses</option>
              {contactStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
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
              className="px-3 py-1.5 bg-[#1A1040] border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="name-asc">Name (A - Z)</option>
              <option value="designation-asc">Designation</option>
              <option value="connection_status-asc">Relationship Status</option>
            </select>

            {/* Clear Filters */}
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

        {/* ── Content View ── */}
        {loading ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <RotateCw className="w-6 h-6 animate-spin text-teal-400 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Loading business contacts...</p>
          </div>
        ) : error ? (
          <div className="bg-[#110B2E] border border-red-500/20 rounded-2xl p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-sm font-bold text-white">Error loading contacts</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchContacts}
              className="py-1.5 px-4 rounded-xl bg-teal-600 text-white text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">No contacts found</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No contacts match your current search or filter parameters.'
                  : 'Start by adding hospital directors, CTOs, CIOs, and key stakeholders.'}
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
                to="/business-development/contacts/new"
                className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Contact</span>
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
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Organization</th>
                    <th className="py-3.5 px-4">Designation & Department</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-[#1A1040]/40 transition group cursor-pointer"
                      onClick={() => navigate(`/business-development/contacts/${contact.id}`)}
                    >
                      {/* Name & Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white group-hover:text-teal-300 transition">
                            {contact.full_name}
                          </span>
                          <PrimaryContactBadge isPrimary={contact.is_primary_contact} />
                          <DecisionMakerBadge isDecisionMaker={contact.is_decision_maker} />
                        </div>
                      </td>

                      {/* Organization Name */}
                      <td className="py-3.5 px-4">
                        {contact.organization_name ? (
                          <Link
                            to={`/business-development/organizations/${contact.organization_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
                          >
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[180px]">{contact.organization_name}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Designation & Department */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium">{contact.designation || '—'}</div>
                        {contact.department && (
                          <div className="text-[11px] text-slate-400">{contact.department}</div>
                        )}
                      </td>

                      {/* Contact Details */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="space-y-0.5 text-[11px]">
                          {contact.email && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate max-w-[180px]">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Connection Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <ContactStatusBadge status={contact.connection_status} />
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setStatusModalContact(contact)}
                            title="Update Relationship Status"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-teal-500/20 text-slate-400 hover:text-teal-300 border border-slate-800 transition"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/business-development/contacts/${contact.id}`}
                            title="View Contact Profile"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/business-development/contacts/${contact.id}/edit`}
                            title="Edit Contact"
                            className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => setDeleteConfirmContact(contact)}
                            title="Delete Contact"
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
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => navigate(`/business-development/contacts/${contact.id}`)}
                className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800/80 hover:border-teal-500/40 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-white text-sm group-hover:text-teal-300 transition">
                          {contact.full_name}
                        </h3>
                        <PrimaryContactBadge isPrimary={contact.is_primary_contact} />
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {contact.designation || 'Healthcare Professional'}
                      </span>
                    </div>
                    <DecisionMakerBadge isDecisionMaker={contact.is_decision_maker} />
                  </div>

                  {contact.organization_name && (
                    <div className="text-xs text-violet-400 flex items-center gap-1.5 my-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{contact.organization_name}</span>
                    </div>
                  )}

                  <div className="my-2">
                    <ContactStatusBadge status={contact.connection_status} size="md" />
                  </div>

                  <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                    {contact.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="pt-3 border-t border-slate-800/60 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500 font-mono">
                    {contact.department || 'General'}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setStatusModalContact(contact)}
                      className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-teal-500/20 text-slate-400 hover:text-teal-300 border border-slate-800"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      to={`/business-development/contacts/${contact.id}/edit`}
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
              of <span className="font-semibold text-white">{total}</span> contacts
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

      {/* Status Modal */}
      {statusModalContact && (
        <ContactStatusModal
          isOpen={!!statusModalContact}
          contactName={statusModalContact.full_name}
          currentStatus={statusModalContact.connection_status}
          onClose={() => setStatusModalContact(null)}
          onConfirm={handleStatusChangeConfirm}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2.5 text-red-400">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Delete Contact</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">{deleteConfirmContact.full_name}</span>? This
              will archive the contact from your active BD directory.
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmContact(null)}
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
export default ContactsListPage
