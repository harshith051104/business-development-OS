import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Navbar from '../../components/layout/Navbar'
import { useAuth } from '../../context/AuthContext'
import { leadTrackerService } from '../../services/leadTracker'
import { campaignService } from '../../services/campaigns'
import { gmailService } from '../../services/gmail'
import type { DeliverabilityHealth } from '../../services/gmail'
import type { Campaign } from '../../types/campaign'
import {
  CHECKBOX_FIELDS,
  CHECKBOX_LABELS,
  CHECKBOX_ICONS,
  type LeadTrackerRow,
  type LeadTrackerTeamProgress,
  type LeadTrackerTimelineEvent,
  type TrackerUser,
} from '../../types/leadTracker'
import {
  Sliders,
  Search,
  Users,
  RefreshCw,
  Plus,
  Check,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  Activity,
  UserPlus,
  Send,
  Circle,
} from 'lucide-react'

// ─── Format Date Utility ──────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

// ─── Checkbox Cell Component ──────────────────────────────────────────────────

function CheckCell({
  checked,
  field,
  leadId,
  onChange,
  disabled,
}: {
  checked: boolean
  field: string
  leadId: number
  onChange: (leadId: number, field: string, val: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        onClick={() => onChange(leadId, field, !checked)}
        disabled={disabled}
        title={`${CHECKBOX_LABELS[field] || field}: ${checked ? 'Completed' : 'Pending'}`}
        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all focus:outline-none ${
          checked
            ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/25'
            : 'border-slate-700 bg-slate-900/50 text-transparent hover:border-slate-500 hover:bg-slate-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const LeadTrackerPage: React.FC = () => {
  const { user, isAdmin, isBDUser } = useAuth()
  const canManageTeam = isAdmin || isBDUser

  // Data states
  const [rows, setRows] = useState<LeadTrackerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedUserTab, setSelectedUserTab] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sub-data states
  const [team, setTeam] = useState<LeadTrackerTeamProgress | null>(null)
  const [showTeam, setShowTeam] = useState(false)
  const [users, setUsers] = useState<TrackerUser[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [health, setHealth] = useState<DeliverabilityHealth[]>([])

  // Tracking in-flight edits & optimistic states
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ leadId: number; field: string } | null>(null)
  const cellInputRef = useRef<HTMLInputElement | null>(null)
  const [localValues, setLocalValues] = useState<Record<number, Record<string, string>>>({})
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync states
  const [syncing, setSyncing] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Bottom Tabs dropdown
  const [activeUserDropdownId, setActiveUserDropdownId] = useState<string | null>(null)

  // Timeline Modal / Side-Drawer states
  const [timelineFor, setTimelineFor] = useState<LeadTrackerRow | null>(null)
  const [timeline, setTimeline] = useState<LeadTrackerTimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [newTimelineNote, setNewTimelineNote] = useState('')
  const [loggingEvent, setLoggingEvent] = useState(false)

  // Add Lead Modal state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    focus: '',
    linkedin: '',
    company: '',
    campaign_id: '',
    notes: '',
  })

  // Team User Management Modal state
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<TrackerUser | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    display_name: '',
    email: '',
    role: 'BUSINESS_DEVELOPMENT',
    password: '',
  })

  // ─── Toast System ───────────────────────────────────────────────────────────

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text })
    setTimeout(() => {
      setNotification(null)
    }, 4000)
  }

  // ─── Fetch Data ─────────────────────────────────────────────────────────────

  const loadBoard = useCallback(
    async (p = page, s = search, assignedUser = selectedUserTab, st = statusFilter, silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const data = await leadTrackerService.getBoard({
          page: p,
          page_size: pageSize,
          search: s || undefined,
          assigned_user: assignedUser !== 'All' ? assignedUser : undefined,
          status: st !== 'All' ? st : undefined,
        })
        setRows(data.leads)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      } catch (err: any) {
        if (!silent) {
          setError(err?.message || 'Failed to load lead tracker board.')
          showToast('error', 'Failed to load tracker leads.')
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [page, pageSize, search, selectedUserTab, statusFilter]
  )

  const loadInitialMetadata = useCallback(async () => {
    try {
      const [userList, campaignList, teamProgress, delivHealth] = await Promise.all([
        leadTrackerService.getUsers().catch(() => [] as TrackerUser[]),
        campaignService.list().catch(() => [] as Campaign[]),
        leadTrackerService.getTeamProgress().catch(() => null),
        gmailService.getDeliverability().catch(() => [] as DeliverabilityHealth[]),
      ])
      setUsers(userList)
      setCampaigns(campaignList)
      if (teamProgress) setTeam(teamProgress)
      setHealth(delivHealth)
      if (campaignList.length > 0) {
        setLeadForm((prev) => ({ ...prev, campaign_id: String(campaignList[0].id) }))
      }
    } catch (err) {
      console.error('Failed to load initial metadata:', err)
    }
  }, [])

  useEffect(() => {
    loadBoard(1, search, selectedUserTab, statusFilter)
    loadInitialMetadata()
  }, [])

  // ─── Silent Polling Loop ────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (!editingCell && updating.size === 0 && !loading && !timelineFor) {
        loadBoard(page, search, selectedUserTab, statusFilter, true)
        leadTrackerService
          .getUsers()
          .then(setUsers)
          .catch(() => {})
      }
    }, 25000)
    return () => clearInterval(interval)
  }, [page, search, selectedUserTab, statusFilter, editingCell, updating, loading, timelineFor, loadBoard])

  // ─── Synchronize Local Editable Values ──────────────────────────────────────

  useEffect(() => {
    const values: Record<number, Record<string, string>> = {}
    rows.forEach((l) => {
      values[l.id] = {
        name: l.name || '',
        focus: l.focus || '',
        linkedin: l.linkedin || '',
        email: l.email || '',
        notes: l.notes || '',
        company: l.company || '',
      }
    })
    setLocalValues(values)
  }, [rows])

  // ─── Auto-focus Inline Input on Double-Click ────────────────────────────────

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus()
      cellInputRef.current.select()
    }
  }, [editingCell])

  // ─── Close User Dropdown on Click Outside ───────────────────────────────────

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveUserDropdownId(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // ─── Search Handler ─────────────────────────────────────────────────────────

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setPage(1)
      loadBoard(1, val, selectedUserTab, statusFilter)
    }, 400)
  }

  // ─── Status Filter Handler ──────────────────────────────────────────────────

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val)
    setPage(1)
    loadBoard(1, search, selectedUserTab, val)
  }

  // ─── Status Color Styles & Change Handler ───────────────────────────────────

  const getStatusBadgeStyle = (st?: string) => {
    switch (st) {
      case 'Interested':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
      case 'Not Interested':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/10'
      case 'Out of Office':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
      case 'Meeting Booked':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/10'
      case 'Replied':
        return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
      case 'Sent':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'Ready_For_Review':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'Bounced':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700'
    }
  }

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    const lead = rows.find((l) => l.id === leadId)
    if (!lead) return
    const prevStatus = lead.status

    setRows((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)))
    try {
      await leadTrackerService.updateCheckboxes(leadId, { status: newStatus })
      showToast('success', `Status updated to ${newStatus}`)
      if (newStatus === 'Meeting Booked') {
        leadTrackerService.updateCheckboxes(leadId, { meeting_scheduled: true }).catch(() => {})
        setRows((prev) => prev.map((l) => (l.id === leadId ? { ...l, meeting_scheduled: true } : l)))
      }
    } catch {
      setRows((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: prevStatus } : l)))
      showToast('error', 'Failed to update status.')
    }
  }

  // ─── Tab Selection (Bottom Sheet Navigation) ────────────────────────────────

  const selectTab = (tabName: string) => {
    setSelectedUserTab(tabName)
    setPage(1)
    setEditingCell(null)
    loadBoard(1, search, tabName, statusFilter)
  }

  // ─── Checkbox Toggle Handler (Optimistic with Rollback) ─────────────────────

  const handleCheckboxChange = async (leadId: number, field: string, val: boolean) => {
    const key = `${leadId}-${field}`
    setUpdating((prev) => new Set(prev).add(key))

    // Optimistic local update
    setRows((prev) => prev.map((r) => (r.id === leadId ? { ...r, [field]: val } : r)))
    if (timelineFor && timelineFor.id === leadId) {
      setTimelineFor((prev) => (prev ? { ...prev, [field]: val } : null))
    }

    try {
      await leadTrackerService.updateCheckboxes(leadId, { [field]: val })
      leadTrackerService.getTeamProgress().then(setTeam).catch(() => {})
      // If timeline is open for this lead, refresh events silently
      if (timelineFor && timelineFor.id === leadId) {
        leadTrackerService
          .getTimeline(leadId)
          .then(setTimeline)
          .catch(() => {})
      }
    } catch (e) {
      // Revert on error
      setRows((prev) => prev.map((r) => (r.id === leadId ? { ...r, [field]: !val } : r)))
      if (timelineFor && timelineFor.id === leadId) {
        setTimelineFor((prev) => (prev ? { ...prev, [field]: !val } : null))
      }
      showToast('error', 'Failed to update checkbox in database.')
    } finally {
      setUpdating((prev) => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  // ─── Inline Text Editing ────────────────────────────────────────────────────

  const handleCellDoubleClick = (leadId: number, field: string) => {
    setEditingCell({ leadId, field })
  }

  const handleLocalChange = (leadId: number, field: string, val: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || {}),
        [field]: val,
      },
    }))
  }

  const handleFieldSave = async (leadId: number, field: string) => {
    const val = localValues[leadId]?.[field] ?? ''
    const lead = rows.find((l) => l.id === leadId)
    if (!lead) return

    const originalVal = (lead as any)[field] || ''
    if (originalVal === val) {
      setEditingCell(null)
      return
    }

    // Optimistic update
    setRows((prev) => prev.map((l) => (l.id === leadId ? { ...l, [field]: val } : l)))
    setEditingCell(null)

    try {
      await leadTrackerService.updateCheckboxes(leadId, { [field]: val })
      showToast('success', `${field.charAt(0).toUpperCase() + field.slice(1)} updated.`)
    } catch (e) {
      showToast('error', 'Failed to save field value. Reverting...')
      // Revert master data
      setRows((prev) => prev.map((l) => (l.id === leadId ? { ...l, [field]: originalVal } : l)))
      // Revert local values
      setLocalValues((prev) => ({
        ...prev,
        [leadId]: {
          ...(prev[leadId] || {}),
          [field]: String(originalVal),
        },
      }))
    }
  }

  // ─── Delete Lead ────────────────────────────────────────────────────────────

  const handleDeleteLead = async (leadId: number, leadName?: string) => {
    if (window.confirm(`Are you sure you want to delete lead "${leadName || leadId}"?`)) {
      try {
        await leadTrackerService.deleteLead(leadId)
        showToast('success', `Lead "${leadName || leadId}" deleted successfully.`)
        loadBoard(page, search, selectedUserTab)
      } catch (err: any) {
        showToast('error', err?.message || 'Failed to delete lead.')
      }
    }
  }

  // ─── Google Sheets Sync ─────────────────────────────────────────────────────

  const handlePullSync = async () => {
    setSyncing(true)
    try {
      const res = await leadTrackerService.triggerPullSync()
      if (res.success) {
        showToast('success', `Sheets Pulled: ${res.updated} updated, ${res.checked} checked.`)
        loadBoard(page, search, selectedUserTab)
      } else {
        showToast('error', res.reason === 'not_configured' ? 'Google Sheets not configured.' : 'Sync failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Sheets pull failed.')
    } finally {
      setSyncing(false)
    }
  }

  const handlePushSync = async () => {
    setSyncing(true)
    try {
      const res = await leadTrackerService.triggerPushSync()
      if (res.success) {
        showToast('success', res.message || `Successfully pushed ${res.pushed} leads to Google Sheets.`)
      } else {
        showToast('error', 'Push to Google Sheets failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Sheets push failed.')
    } finally {
      setSyncing(false)
    }
  }

  // ─── Add Lead Form Submit ───────────────────────────────────────────────────

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadForm.name || !leadForm.email) {
      showToast('error', 'Name and Email are required.')
      return
    }
    try {
      await leadTrackerService.createLead({
        name: leadForm.name,
        email: leadForm.email,
        company: leadForm.company || undefined,
        focus: leadForm.focus || undefined,
        linkedin: leadForm.linkedin || undefined,
        campaign_id: leadForm.campaign_id ? Number(leadForm.campaign_id) : undefined,
        notes: leadForm.notes || undefined,
      })
      showToast('success', `Lead "${leadForm.name}" created successfully.`)
      setShowAddLeadModal(false)
      setLeadForm({
        name: '',
        email: '',
        focus: '',
        linkedin: '',
        company: '',
        campaign_id: campaigns[0]?.id ? String(campaigns[0].id) : '',
        notes: '',
      })
      loadBoard(page, search, selectedUserTab)
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add lead.')
    }
  }

  // ─── Team User Management Handlers ──────────────────────────────────────────

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        await leadTrackerService.updateUser(editingUser.id, {
          name: userForm.name,
          display_name: userForm.display_name,
          email: userForm.email,
          role: userForm.role,
        })
        showToast('success', `User "${userForm.display_name || userForm.name}" updated.`)
      } else {
        await leadTrackerService.createUser(userForm)
        showToast('success', `User "${userForm.display_name || userForm.name}" created.`)
      }
      setEditingUser(null)
      setUserForm({ name: '', display_name: '', email: '', role: 'BUSINESS_DEVELOPMENT', password: '' })
      const updatedUsers = await leadTrackerService.getUsers()
      setUsers(updatedUsers)
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save team member.')
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to remove team member "${userName}"?`)) {
      try {
        await leadTrackerService.deleteUser(userId)
        showToast('success', `User "${userName}" has been removed.`)
        const updatedUsers = await leadTrackerService.getUsers()
        setUsers(updatedUsers)
        if (selectedUserTab === userName) {
          selectTab('All')
        }
        if (editingUser?.id === userId) {
          setEditingUser(null)
          setUserForm({ name: '', display_name: '', email: '', role: 'BUSINESS_DEVELOPMENT', password: '' })
        }
      } catch (err: any) {
        showToast('error', err?.message || 'Failed to remove user.')
      }
    }
  }

  // ─── Timeline Open & Log Event ──────────────────────────────────────────────

  const openTimeline = async (row: LeadTrackerRow) => {
    setTimelineFor(row)
    setTimelineLoading(true)
    try {
      const events = await leadTrackerService.getTimeline(row.id)
      setTimeline(events)
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!timelineFor || !newTimelineNote.trim()) return
    setLoggingEvent(true)
    try {
      await leadTrackerService.addTimelineEvent(
        timelineFor.id,
        'manual_note',
        newTimelineNote.trim(),
        { user: user?.name }
      )
      setNewTimelineNote('')
      const updatedEvents = await leadTrackerService.getTimeline(timelineFor.id)
      setTimeline(updatedEvents)
      showToast('success', 'Timeline note logged.')
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to log timeline event.')
    } finally {
      setLoggingEvent(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden select-none font-sans md:pl-64">
      <Navbar />

      {/* Floating Glassmorphism Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-xl border border-white/10 bg-slate-900/90 text-white backdrop-blur-md shadow-2xl animate-fadeIn">
          <div
            className={`w-2 h-2 rounded-full ${
              notification.type === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-xs font-bold uppercase tracking-wider">{notification.text}</span>
        </div>
      )}

      {/* ─── TOP HEADER BAR ─── */}
      <div className="flex flex-col border-b border-white/5 bg-[#0e0e15] shrink-0 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <Sliders className="text-violet-400" size={24} />
              Outreach Progress Tracker
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {total} leads found · Real-time pipeline milestone checklists
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Box */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <Search size={14} />
              </span>
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search name, email, company..."
                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 font-medium w-52 transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500/50 font-medium cursor-pointer transition-all"
              title="Filter leads by response/outreach status"
            >
              <option value="All" className="bg-[#12121a]">All Statuses</option>
              <option value="Interested" className="bg-[#12121a]">Interested</option>
              <option value="Not Interested" className="bg-[#12121a]">Not Interested</option>
              <option value="Out of Office" className="bg-[#12121a]">Out of Office</option>
              <option value="Meeting Booked" className="bg-[#12121a]">Meeting Booked</option>
              <option value="Sent" className="bg-[#12121a]">Sent</option>
              <option value="Replied" className="bg-[#12121a]">Replied</option>
              <option value="Pending" className="bg-[#12121a]">Pending</option>
            </select>

            {/* Team Progress Toggle */}
            <button
              onClick={() => setShowTeam((v) => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Users size={14} className="text-violet-300" />
              Team Progress
            </button>

            {/* Manage Team (Admins & BD users) */}
            {canManageTeam && (
              <button
                onClick={() => {
                  setShowUserModal(true)
                  setEditingUser(null)
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Users size={14} />
                Manage Team
              </button>
            )}

            {/* Pull Sheets Sync */}
            <button
              onClick={handlePullSync}
              disabled={syncing}
              title="Pull edits from Google Sheets"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              Pull Sheets
            </button>

            {/* Push Sheets Sync */}
            <button
              onClick={handlePushSync}
              disabled={syncing}
              title="Push all lead states to Google Sheets"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              Push Sheets
            </button>

            {/* Add Lead */}
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl hover:shadow-lg hover:shadow-violet-600/20 transition-all cursor-pointer"
            >
              <Plus size={14} />
              Add Lead
            </button>
          </div>
        </div>

        {/* Deliverability Health score badges */}
        {health.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-1">
            {health.map((h) => (
              <div
                key={h.account_id}
                title={`${h.email}: ${h.sent} sent, ${h.bounce_rate}% bounce, ${h.reply_rate}% reply`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap ${
                  h.status === 'healthy'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : h.status === 'at_risk'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>
                  {h.email}: <span className="font-bold">{h.health_score}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── TEAM PROGRESS OVERVIEW EXPANDED ─── */}
      {showTeam && team && (
        <div className="p-4 mx-6 mt-4 rounded-2xl bg-[#131127]/60 border border-white/5 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">
              Team Progress — {team.total_completed}/{team.total_leads} opportunities closed
            </h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-left border-b border-white/5">
                <th className="py-2 pr-4">Member</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Sent</th>
                <th className="py-2 pr-4">LI Connected</th>
                <th className="py-2 pr-4">Meetings</th>
                <th className="py-2 pr-4">Closed</th>
                <th className="py-2 pr-4">Completion</th>
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.user_id ?? 'unassigned'} className="border-b border-white/5 last:border-0">
                  <td className="py-2 pr-4 font-medium">{m.display_name}</td>
                  <td className="py-2 pr-4">{m.total_leads}</td>
                  <td className="py-2 pr-4">{m.email_sent}</td>
                  <td className="py-2 pr-4">{m.linkedin_connection_accepted}</td>
                  <td className="py-2 pr-4">{m.meeting_scheduled}</td>
                  <td className="py-2 pr-4">{m.opportunity_closed}</td>
                  <td className="py-2 pr-4 font-bold text-violet-400">{m.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ERROR BANNER ─── */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── SPREADSHEET GRID CONTAINER ─── */}
      <div className="flex-1 overflow-hidden bg-[#0a0a0f] p-6 pt-4 flex flex-col max-w-full">
        <div className="flex-1 border border-white/5 bg-[#0f0f15]/50 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col max-w-full h-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400 h-full">
              <Loader2 className="animate-spin text-violet-500" size={32} />
              <span className="text-xs font-bold uppercase tracking-wider">Loading Tracker Data...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-sm">No leads found.</div>
          ) : (
            <>
              <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 max-w-full h-full">
                <table className="w-full border-collapse text-left text-xs text-slate-300 min-w-[2450px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#12121a] text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-20">
                      <th className="p-3.5 pl-6 min-w-[200px] sticky left-0 z-30 bg-[#12121a]">
                        Lead / Investor Name
                      </th>
                      <th className="p-3.5 min-w-[130px]">Focus</th>
                      <th className="p-3.5 min-w-[210px]">LinkedIn URL</th>
                      <th className="p-3.5 min-w-[190px]">Email</th>
                      <th className="p-3.5 min-w-[150px]">Status</th>

                      {/* 13 Checklist Milestone Columns */}
                      {CHECKBOX_FIELDS.map((f) => {
                        const Icon = CHECKBOX_ICONS[f] || Circle
                        return (
                          <th
                            key={f}
                            className="p-2 text-center min-w-[105px] whitespace-normal text-[9px] border-l border-white/5 leading-tight"
                            title={CHECKBOX_LABELS[f]}
                          >
                            <Icon size={13} className="block mx-auto mb-0.5" />
                            {CHECKBOX_LABELS[f]}
                          </th>
                        )
                      })}

                      <th className="p-3.5 min-w-[230px] border-l border-white/5">Notes</th>
                      <th className="p-3.5 min-w-[140px]">Campaign</th>
                      <th className="p-3.5 min-w-[110px]">Last Activity</th>
                      <th className="p-3.5 text-center min-w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-white/[0.015] transition-all align-middle group border-b border-white/5 h-[45px]"
                      >
                        {/* Investor / Contact Name */}
                        <td
                          onDoubleClick={() => handleCellDoubleClick(lead.id, 'name')}
                          className="p-3 pl-6 font-semibold text-white relative h-[45px] sticky left-0 z-10 bg-[#0f0f15]"
                        >
                          {editingCell?.leadId === lead.id && editingCell?.field === 'name' ? (
                            <input
                              ref={cellInputRef}
                              value={localValues[lead.id]?.name ?? ''}
                              onChange={(e) => handleLocalChange(lead.id, 'name', e.target.value)}
                              onBlur={() => handleFieldSave(lead.id, 'name')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFieldSave(lead.id, 'name')
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              className="absolute inset-0 w-full h-full px-3 bg-[#161622] text-white focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold"
                            />
                          ) : (
                            <div className="flex items-center justify-between group/cell pr-2">
                              <div>
                                <span className="truncate block font-medium">
                                  {localValues[lead.id]?.name || lead.name || '—'}
                                </span>
                                {lead.company && (
                                  <span className="text-[10px] text-slate-500 block truncate font-normal">
                                    {lead.company}
                                  </span>
                                )}
                              </div>
                              <Pencil
                                size={11}
                                className="text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer ml-1.5"
                              />
                            </div>
                          )}
                        </td>

                        {/* Focus */}
                        <td
                          onDoubleClick={() => handleCellDoubleClick(lead.id, 'focus')}
                          className="p-3 text-slate-300 relative h-[45px]"
                        >
                          {editingCell?.leadId === lead.id && editingCell?.field === 'focus' ? (
                            <input
                              ref={cellInputRef}
                              value={localValues[lead.id]?.focus ?? ''}
                              onChange={(e) => handleLocalChange(lead.id, 'focus', e.target.value)}
                              onBlur={() => handleFieldSave(lead.id, 'focus')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFieldSave(lead.id, 'focus')
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              className="absolute inset-0 w-full h-full px-3 bg-[#161622] text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          ) : (
                            <div className="flex items-center justify-between group/cell pr-2">
                              <span className="truncate block">
                                {localValues[lead.id]?.focus || lead.focus || '—'}
                              </span>
                              <Pencil
                                size={11}
                                className="text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer ml-1.5"
                              />
                            </div>
                          )}
                        </td>

                        {/* LinkedIn Profile */}
                        <td
                          onDoubleClick={() => handleCellDoubleClick(lead.id, 'linkedin')}
                          className="p-3 text-cyan-400 relative h-[45px]"
                        >
                          {editingCell?.leadId === lead.id && editingCell?.field === 'linkedin' ? (
                            <input
                              ref={cellInputRef}
                              value={localValues[lead.id]?.linkedin ?? ''}
                              onChange={(e) => handleLocalChange(lead.id, 'linkedin', e.target.value)}
                              onBlur={() => handleFieldSave(lead.id, 'linkedin')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFieldSave(lead.id, 'linkedin')
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              className="absolute inset-0 w-full h-full px-3 bg-[#161622] text-cyan-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          ) : (
                            <div className="flex items-center justify-between group/cell pr-2">
                              <span className="truncate block underline cursor-pointer">
                                {localValues[lead.id]?.linkedin || lead.linkedin || '—'}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                {lead.linkedin && (
                                  <a
                                    href={
                                      lead.linkedin.startsWith('http')
                                        ? lead.linkedin
                                        : `https://${lead.linkedin}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-cyan-400 transition-colors"
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                                <Pencil size={11} className="text-slate-600 cursor-pointer" />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Email */}
                        <td
                          onDoubleClick={() => handleCellDoubleClick(lead.id, 'email')}
                          className="p-3 text-slate-300 relative h-[45px]"
                        >
                          {editingCell?.leadId === lead.id && editingCell?.field === 'email' ? (
                            <input
                              ref={cellInputRef}
                              value={localValues[lead.id]?.email ?? ''}
                              onChange={(e) => handleLocalChange(lead.id, 'email', e.target.value)}
                              onBlur={() => handleFieldSave(lead.id, 'email')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFieldSave(lead.id, 'email')
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              className="absolute inset-0 w-full h-full px-3 bg-[#161622] text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          ) : (
                            <div className="flex items-center justify-between group/cell pr-2">
                              <span className="truncate block">
                                {localValues[lead.id]?.email || lead.email || '—'}
                              </span>
                              <Pencil
                                size={11}
                                className="text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer ml-1.5"
                              />
                            </div>
                          )}
                        </td>

                        {/* Status (Color coded badge + quick selector) */}
                        <td className="p-3 relative h-[45px]">
                          <select
                            value={lead.status || 'Pending'}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer focus:outline-none transition-all ${getStatusBadgeStyle(
                              lead.status
                            )}`}
                            title="Update response status"
                          >
                            <option value="Pending" className="bg-[#12121a] text-slate-300">Pending</option>
                            <option value="Sent" className="bg-[#12121a] text-blue-300">Sent</option>
                            <option value="Replied" className="bg-[#12121a] text-violet-300">Replied</option>
                            <option value="Interested" className="bg-[#12121a] text-emerald-300">Interested</option>
                            <option value="Not Interested" className="bg-[#12121a] text-rose-300">Not Interested</option>
                            <option value="Out of Office" className="bg-[#12121a] text-amber-300">Out of Office</option>
                            <option value="Meeting Booked" className="bg-[#12121a] text-sky-300">Meeting Booked</option>
                            <option value="Ready_For_Review" className="bg-[#12121a] text-purple-300">Ready for Review</option>
                            <option value="Bounced" className="bg-[#12121a] text-red-300">Bounced</option>
                          </select>
                        </td>

                        {/* Checkbox Checklist Cells */}
                        {CHECKBOX_FIELDS.map((f) => {
                          const isUp = updating.has(`${lead.id}-${f}`)
                          return (
                            <td key={f} className="p-2 border-l border-white/5 text-center">
                              <CheckCell
                                checked={Boolean((lead as any)[f])}
                                field={f}
                                leadId={lead.id}
                                onChange={handleCheckboxChange}
                                disabled={isUp}
                              />
                            </td>
                          )
                        })}

                        {/* Notes */}
                        <td
                          onDoubleClick={() => handleCellDoubleClick(lead.id, 'notes')}
                          className="p-3 text-slate-400 border-l border-white/5 relative h-[45px]"
                        >
                          {editingCell?.leadId === lead.id && editingCell?.field === 'notes' ? (
                            <input
                              ref={cellInputRef}
                              value={localValues[lead.id]?.notes ?? ''}
                              onChange={(e) => handleLocalChange(lead.id, 'notes', e.target.value)}
                              onBlur={() => handleFieldSave(lead.id, 'notes')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFieldSave(lead.id, 'notes')
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              className="absolute inset-0 w-full h-full px-3 bg-[#161622] text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          ) : (
                            <div className="flex items-center justify-between group/cell pr-2">
                              <span className="truncate block italic text-slate-400">
                                {localValues[lead.id]?.notes || lead.notes || 'Add details...'}
                              </span>
                              <Pencil
                                size={11}
                                className="text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer ml-1.5"
                              />
                            </div>
                          )}
                        </td>

                        {/* Campaign */}
                        <td className="p-3 text-slate-400 truncate max-w-[140px]">
                          {lead.campaign_name || 'General Outreach'}
                        </td>

                        {/* Last Activity */}
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {formatDate(lead.last_activity_at)}
                        </td>

                        {/* Actions (Log Timeline & Delete) */}
                        <td className="p-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openTimeline(lead)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-500/10 text-violet-400 hover:bg-violet-500 hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all shadow-sm border border-violet-500/15 cursor-pointer"
                              title="View Activity Timeline"
                            >
                              Log
                              <ArrowRight size={10} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteLead(lead.id, lead.name)}
                              className="inline-flex items-center justify-center p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-rose-500/15 cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ─── PAGINATION BAR ─── */}
              {total > 0 && (
                <div className="border-t border-white/5 bg-[#0a0a0f]/40 px-6 py-3 flex items-center justify-between shrink-0 font-sans text-xs">
                  <div className="text-slate-400 font-medium">
                    Showing <span className="text-white font-bold">{(page - 1) * pageSize + 1}</span> to{' '}
                    <span className="text-white font-bold">{Math.min(page * pageSize, total)}</span> of{' '}
                    <span className="text-white font-bold">{total}</span> leads
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => {
                        const newPage = page - 1
                        setPage(newPage)
                        loadBoard(newPage, search, selectedUserTab)
                      }}
                      className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      let pageNum = idx + 1
                      if (totalPages > 5) {
                        if (page > 3) {
                          pageNum = page - 2 + idx
                        }
                        if (pageNum + (4 - idx) > totalPages) {
                          pageNum = totalPages - 4 + idx
                        }
                      }
                      return (
                        <button
                          type="button"
                          key={pageNum}
                          onClick={() => {
                            setPage(pageNum)
                            loadBoard(pageNum, search, selectedUserTab)
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            page === pageNum
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500/50 shadow-md shadow-violet-500/10'
                              : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => {
                        const newPage = page + 1
                        setPage(newPage)
                        loadBoard(newPage, search, selectedUserTab)
                      }}
                      className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next Page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── BOTTOM SHEET TABS (TEAM MEMBER FILTERING) ─── */}
      <div className="border-t border-white/10 bg-[#0d0d14]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex-1 flex items-center overflow-x-auto gap-2 mx-2 scrollbar-none select-none">
          {/* All Tab */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => selectTab('All')}
              className={`flex items-center gap-1.5 px-4.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all border rounded-xl relative ${
                selectedUserTab === 'All'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500/50 shadow-lg shadow-violet-500/25'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border-white/5'
              }`}
            >
              All
            </button>
          </div>

          {/* Dynamic User Pills */}
          {users.map((u) => {
            const userName = u.display_name || u.name
            const isActive = selectedUserTab === userName
            return (
              <div key={u.id} className="relative flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => selectTab(userName)}
                  className={`flex items-center gap-1 px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all border rounded-xl relative ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500/50 shadow-lg shadow-violet-500/25'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border-white/5'
                  }`}
                >
                  {userName}
                  {canManageTeam && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveUserDropdownId(activeUserDropdownId === u.id ? null : u.id)
                      }}
                      className="ml-1.5 pl-1 text-[10px] text-slate-500 hover:text-white font-bold select-none cursor-pointer"
                      title="User options"
                    >
                      ▾
                    </span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {activeUserDropdownId === u.id && (
                  <div className="absolute bottom-full mb-2 left-0 w-36 bg-[#12121a] border border-white/10 rounded-lg shadow-2xl z-50 py-1 font-sans">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveUserDropdownId(null)
                        setEditingUser(u)
                        setUserForm({
                          name: u.name,
                          display_name: u.display_name,
                          email: u.email,
                          role: u.role || 'BUSINESS_DEVELOPMENT',
                          password: '',
                        })
                        setShowUserModal(true)
                      }}
                      className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white text-xs font-bold cursor-pointer"
                    >
                      <Pencil size={11} />
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        setActiveUserDropdownId(null)
                        await handleDeleteUser(u.id, userName)
                      }}
                      className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 size={11} />
                      Delete User
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Sync Active Beacon */}
        <div className="flex items-center gap-2 text-slate-500 shrink-0">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest pl-1 select-none flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            Sync Active
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: ADD LEAD MODAL ─── */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn font-sans p-4">
          <div className="bg-[#0e0e15] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="text-violet-400" size={20} />
                Add New Lead
              </h2>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <input
                    required
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                    Email Address *
                  </label>
                  <input
                    required
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                    Company / Org
                  </label>
                  <input
                    value={leadForm.company}
                    onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                    Focus / Strategy
                  </label>
                  <input
                    value={leadForm.focus}
                    onChange={(e) => setLeadForm({ ...leadForm, focus: e.target.value })}
                    placeholder="SaaS / Seed"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                  LinkedIn URL
                </label>
                <input
                  value={leadForm.linkedin}
                  onChange={(e) => setLeadForm({ ...leadForm, linkedin: e.target.value })}
                  placeholder="linkedin.com/in/janedoe"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                  Campaign
                </label>
                <select
                  value={leadForm.campaign_id}
                  onChange={(e) => setLeadForm({ ...leadForm, campaign_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#161622] border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {campaigns.length === 0 && <option value="">General Outreach</option>}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  placeholder="Background notes, initial thesis, or referral details..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold cursor-pointer hover:shadow-lg"
                >
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: TEAM USER MANAGEMENT ─── */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn font-sans p-4">
          <div className="bg-[#0e0e15] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Users className="text-violet-400" size={20} />
                Team Members & Bottom Tabs Configuration
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowUserModal(false)
                  setEditingUser(null)
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
              {/* User List */}
              <div className="flex flex-col border border-white/5 rounded-xl overflow-hidden bg-white/[0.01]">
                <div className="bg-white/5 px-3 py-2 border-b border-white/5 text-xs font-bold text-slate-400 flex justify-between items-center uppercase tracking-wider">
                  <span>Registered Users ({users.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(null)
                      setUserForm({
                        name: '',
                        display_name: '',
                        email: '',
                        role: 'BUSINESS_DEVELOPMENT',
                        password: '',
                      })
                    }}
                    className="text-[10px] bg-violet-600 text-white font-bold px-2 py-0.5 rounded shadow hover:bg-violet-700 cursor-pointer flex items-center gap-1"
                  >
                    <UserPlus size={11} /> Add
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 text-xs">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setEditingUser(u)
                        setUserForm({
                          name: u.name,
                          display_name: u.display_name,
                          email: u.email,
                          role: u.role || 'BUSINESS_DEVELOPMENT',
                          password: '',
                        })
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        editingUser?.id === u.id
                          ? 'bg-violet-600/20 border border-violet-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white">{u.display_name || u.name}</div>
                        <div className="text-[10px] text-slate-400">{u.email}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase tracking-widest text-violet-300 font-bold">
                        {u.role || 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add / Edit User Form */}
              <form onSubmit={handleSaveUser} className="flex flex-col justify-between text-xs">
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-white mb-2">
                    {editingUser ? `Edit ${editingUser.name}` : 'Add New Team Member'}
                  </h3>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Full Name *
                    </label>
                    <input
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Display Name (Tab Label)
                    </label>
                    <input
                      value={userForm.display_name}
                      onChange={(e) => setUserForm({ ...userForm, display_name: e.target.value })}
                      placeholder="Jane"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="jane@elly.com"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {!editingUser && (
                    <div>
                      <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                        Initial Password
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Role
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full px-3 py-2 bg-[#161622] border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="BUSINESS_DEVELOPMENT">Business Development</option>
                      <option value="ADMIN">Administrator</option>
                      <option value="USER">Standard User</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  {editingUser && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(editingUser.id, editingUser.name)}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg cursor-pointer"
                  >
                    {editingUser ? 'Save Changes' : 'Create Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ACTIVITY TIMELINE & MILESTONE LOGGER ─── */}
      {timelineFor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end animate-fadeIn font-sans">
          <div className="w-full max-w-xl h-full bg-[#0F0A24] border-l border-violet-900/40 p-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div>
              {/* Timeline Header */}
              <div className="flex items-start justify-between mb-4 border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Activity className="text-violet-400" size={20} />
                    {timelineFor.name || 'Lead'} — Timeline
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {timelineFor.company || timelineFor.email || 'Prospect activity log'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTimelineFor(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Milestone Checklist in Drawer */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Pipeline Milestones
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {CHECKBOX_FIELDS.map((f) => {
                    const isChecked = Boolean((timelineFor as any)[f])
                    const Icon = CHECKBOX_ICONS[f] || Circle
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => handleCheckboxChange(timelineFor.id, f, !isChecked)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className="truncate flex-1 font-medium">{CHECKBOX_LABELS[f]}</span>
                        {isChecked && <Check size={12} className="text-violet-400" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Activity Feed
                </h3>
                {timelineLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-gray-500 p-4 bg-white/[0.01] rounded-xl border border-white/5 text-center">
                    No activity logged yet.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {timeline.map((e) => (
                      <li
                        key={e.id}
                        className="p-3 rounded-xl bg-[#131127]/60 border border-white/5 text-xs hover:border-violet-500/20 transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white capitalize">
                            {e.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(e.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-slate-300">{e.description}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Log Note Input */}
            <form onSubmit={handleAddTimelineNote} className="mt-6 pt-4 border-t border-white/5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Log New Note / Event
              </label>
              <div className="flex gap-2">
                <input
                  value={newTimelineNote}
                  onChange={(e) => setNewTimelineNote(e.target.value)}
                  placeholder="e.g. Call scheduled, replied with questions..."
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={loggingEvent || !newTimelineNote.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={12} />
                  Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadTrackerPage
