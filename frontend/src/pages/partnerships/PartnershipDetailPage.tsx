import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { partnershipsService } from '../../services/partnerships'
import { meetingsService } from '../../services/meetings'
import { followupsService } from '../../services/followups'
import { communicationsService } from '../../services/communications'
import type { Partnership } from '../../types/partnership'
import type { Meeting } from '../../types/meeting'
import type { FollowUp, FollowUpPriority } from '../../types/followup'
import type { Communication } from '../../types/communication'
import PartnershipTypeBadge from '../../components/partnerships/PartnershipTypeBadge'
import PartnershipStatusBadge from '../../components/partnerships/PartnershipStatusBadge'
import PriorityBadge from '../../components/organizations/PriorityBadge'
import RelationshipTimeline from '../../components/communications/RelationshipTimeline'
import {
  Handshake,
  ArrowLeft,
  Edit2,
  Building2,
  Users,
  Target,
  Sparkles,
  RotateCw,
  AlertCircle,
  Clock3,
  Calendar,
  Send,
  MessageSquare,
  ExternalLink,
  Trash2,
  CheckCircle2,
  PauseCircle,
  XCircle,
  FileText,
  UserCheck,
  CalendarPlus,
  AlertTriangle,
} from 'lucide-react'

export const PartnershipDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [partnership, setPartnership] = useState<Partnership | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Status Change Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false)
  const [newStatus, setNewStatus] = useState<string>('Active')
  const [statusNote, setStatusNote] = useState<string>('')
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false)

  // Follow-up Modal State
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState<boolean>(false)
  const [followupTitle, setFollowupTitle] = useState<string>('')
  const [followupDueDays, setFollowupDueDays] = useState<number>(3)
  const [followupPriority, setFollowupPriority] = useState<FollowUpPriority>('Medium')
  const [addingFollowup, setAddingFollowup] = useState<boolean>(false)

  const fetchPartnershipData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const p = await partnershipsService.getPartnership(Number(id))
      setPartnership(p)
      setNewStatus(p.status)

      // Fetch associated items for the organization
      if (p.organization_id) {
        const [mRes, fRes, cRes] = await Promise.all([
          meetingsService.getMeetings({ organization_id: p.organization_id, page_size: 20 }),
          followupsService.getFollowUps({ organization_id: p.organization_id, page_size: 20 }),
          communicationsService.getCommunications({ organization_id: p.organization_id, page_size: 20 }),
        ])
        setMeetings(mRes.items)
        setFollowups(fRes.items)
        setCommunications(cRes.items)
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load partnership details.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPartnershipData()
  }, [fetchPartnershipData])

  const handleStatusUpdate = async () => {
    if (!partnership) return
    setUpdatingStatus(true)
    try {
      await partnershipsService.updateStatus(partnership.id, newStatus, statusNote.trim() || undefined)
      setIsStatusModalOpen(false)
      fetchPartnershipData()
    } catch (err: any) {
      alert(err.detail || 'Failed to update status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleCreateFollowup = async () => {
    if (!partnership || !followupTitle.trim()) return
    setAddingFollowup(true)
    try {
      const dueAt = new Date()
      dueAt.setDate(dueAt.getDate() + followupDueDays)

      await followupsService.createFollowUp({
        organization_id: partnership.organization_id,
        contact_id: partnership.primary_contact_id || undefined,
        title: followupTitle.trim(),
        priority: followupPriority,
        due_at: dueAt.toISOString(),
      })
      setIsFollowupModalOpen(false)
      setFollowupTitle('')
      fetchPartnershipData()
    } catch (err: any) {
      alert(err.detail || 'Failed to create follow-up.')
    } finally {
      setAddingFollowup(false)
    }
  }

  const handleDelete = async () => {
    if (!partnership) return
    if (!window.confirm(`Are you sure you want to archive the partnership '${partnership.name}'?`)) {
      return
    }
    try {
      await partnershipsService.deletePartnership(partnership.id)
      navigate('/business-development/partnerships')
    } catch (err: any) {
      alert(err.detail || 'Failed to delete partnership.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <RotateCw className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      </div>
    )
  }

  if (error || !partnership) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col">
        <Navbar />
        <div className="flex-1 p-8 max-w-4xl mx-auto text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Partnership Not Found</h2>
          <p className="text-xs text-slate-400">{error || 'The requested partnership could not be loaded.'}</p>
          <Link
            to="/business-development/partnerships"
            className="inline-block px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
          >
            Back to Partnerships
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link
            to="/business-development/partnerships"
            className="hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Partnerships Directory</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium truncate">{partnership.name}</span>
        </div>

        {/* ── Partnership Header Banner ── */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30 shrink-0">
                <Handshake className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {partnership.name}
                  </h1>
                  <PartnershipStatusBadge status={partnership.status} size="md" />
                  <PriorityBadge priority={partnership.priority} size="md" />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <PartnershipTypeBadge type={partnership.partnership_type} size="sm" />
                  <span>·</span>
                  <Link
                    to={`/business-development/organizations/${partnership.organization_id}`}
                    className="hover:text-violet-300 font-semibold text-slate-200 flex items-center gap-1"
                  >
                    <Building2 className="w-3.5 h-3.5 text-violet-400" />
                    <span>{partnership.organization_name || `Org #${partnership.organization_id}`}</span>
                  </Link>
                  <span>·</span>
                  <span className="font-mono text-slate-400">
                    Started: {new Date(partnership.start_date).toLocaleDateString()}
                  </span>
                  {partnership.end_date && (
                    <>
                      <span>·</span>
                      <span
                        className={`font-mono ${
                          partnership.is_ending_soon ? 'text-amber-400 font-bold' : 'text-slate-400'
                        }`}
                      >
                        Ends: {new Date(partnership.end_date).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/business-development/outreach?organization_id=${partnership.organization_id}&contact_id=${partnership.primary_contact_id || ''}`}
                className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Outreach</span>
              </Link>

              <Link
                to={`/business-development/meetings/new?organization_id=${partnership.organization_id}&contact_id=${partnership.primary_contact_id || ''}`}
                className="py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition flex items-center space-x-1.5"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Schedule Meeting</span>
              </Link>

              <button
                onClick={() => setIsFollowupModalOpen(true)}
                className="py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <Clock3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Follow-up</span>
              </button>

              <button
                onClick={() => setIsStatusModalOpen(true)}
                className="py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Change Status
              </button>

              <Link
                to={`/business-development/partnerships/${partnership.id}/edit`}
                className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                <Edit2 className="w-4 h-4" />
              </Link>

              <button
                onClick={handleDelete}
                className="p-2 rounded-xl bg-[#1A1040] hover:bg-rose-950/40 border border-slate-700 text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expiry / Attention Notification */}
          {(partnership.is_ending_soon || partnership.needs_attention) && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {partnership.is_ending_soon
                    ? 'This partnership end date is approaching within 30 days.'
                    : 'This active partnership requires a scheduled next action.'}
                </span>
              </div>
              <button
                onClick={() => setIsFollowupModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-xs"
              >
                Schedule Follow-up
              </button>
            </div>
          )}
        </div>

        {/* ── 2-Column Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Column: Specs & Objectives (8 cols) ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Strategic Objectives */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Agreed Business Objectives</span>
              </h3>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {partnership.objectives || 'No explicit objectives recorded for this partnership.'}
              </p>
            </div>

            {/* Next Action Banner */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <Clock3 className="w-4 h-4 text-violet-400" />
                <span>Next Business Action</span>
              </h3>
              {partnership.next_action ? (
                <div className="p-4 rounded-2xl bg-[#1A1040] border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{partnership.next_action}</span>
                    {partnership.next_action_date && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Scheduled Target Date: {new Date(partnership.next_action_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsFollowupModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
                  >
                    Log Progress
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                  <span>Next action required for this active partnership.</span>
                  <Link
                    to={`/business-development/partnerships/${partnership.id}/edit`}
                    className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold"
                  >
                    Set Next Action
                  </Link>
                </div>
              )}
            </div>

            {/* Partnership Description & Internal Notes */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Partnership Scope & Internal Notes</span>
              </h3>

              {partnership.description && (
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-slate-400">Description / Background:</span>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{partnership.description}</p>
                </div>
              )}

              {partnership.notes && (
                <div className="space-y-1 text-xs pt-3 border-t border-slate-800/60">
                  <span className="font-semibold text-slate-400">Internal BD Notes:</span>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
                    {partnership.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline History Component */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-violet-400" />
                <span>Relationship Timeline & Activity</span>
              </h3>
              <RelationshipTimeline organizationId={partnership.organization_id} />
            </div>
          </div>

          {/* ── Right Column: Related Cards & Entity Context (4 cols) ── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Primary Contact Card */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-violet-400" />
                  <span>Primary Contact</span>
                </h3>
                {partnership.primary_contact_id && (
                  <Link
                    to={`/business-development/contacts/${partnership.primary_contact_id}`}
                    className="text-[10px] text-violet-400 hover:text-white"
                  >
                    View Profile
                  </Link>
                )}
              </div>

              {partnership.primary_contact_name ? (
                <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1.5">
                  <div className="font-bold text-white text-sm">{partnership.primary_contact_name}</div>
                  {partnership.primary_contact_designation && (
                    <div className="text-slate-400 text-[11px]">{partnership.primary_contact_designation}</div>
                  )}
                  {partnership.primary_contact_email && (
                    <div className="text-slate-300 text-[11px] font-mono truncate">
                      {partnership.primary_contact_email}
                    </div>
                  )}
                  {partnership.primary_contact_phone && (
                    <div className="text-slate-300 text-[11px] font-mono">
                      {partnership.primary_contact_phone}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic">No primary contact attached.</p>
              )}
            </div>

            {/* Showcase Project Card */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Associated Project</span>
                </h3>
                {partnership.project_id && (
                  <Link
                    to={`/business-development/showcase/${partnership.project_id}`}
                    target="_blank"
                    className="text-[10px] text-indigo-400 hover:text-white inline-flex items-center space-x-1"
                  >
                    <span>View Showcase</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>

              {partnership.project_name ? (
                <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1">
                  <div className="font-bold text-white text-xs">{partnership.project_name}</div>
                  <p className="text-slate-400 text-[11px]">
                    Referenced showcase initiative for partner alignment.
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 italic">General platform partnership.</p>
              )}
            </div>

            {/* Internal BD Ownership */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Internal Ownership</span>
              </h3>
              <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1">
                <div className="font-bold text-white">
                  {partnership.owner_name || 'Unassigned BD Owner'}
                </div>
                {partnership.owner_email && (
                  <div className="text-slate-400 text-[11px] font-mono">{partnership.owner_email}</div>
                )}
                <div className="text-[10px] text-slate-500 pt-1">
                  Responsible for executive relationship and milestone execution
                </div>
              </div>
            </div>

            {/* Upcoming Follow-ups (Phase 6) */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Clock3 className="w-4 h-4 text-amber-400" />
                  <span>Follow-up Tasks</span>
                </h3>
                <button
                  onClick={() => setIsFollowupModalOpen(true)}
                  className="text-[10px] text-amber-400 hover:text-white"
                >
                  + Add
                </button>
              </div>

              {followups.length === 0 ? (
                <p className="text-slate-500 italic">No active follow-ups.</p>
              ) : (
                <div className="space-y-2">
                  {followups.slice(0, 4).map((f) => (
                    <div key={f.id} className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <div className="font-semibold text-slate-200 text-[11px] truncate">{f.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Due: {new Date(f.due_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Change Status Modal ── */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Update Partnership Status</h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Target Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                >
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                  <option value="Ended">Ended</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Transition Note</label>
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Reason for status change..."
                  className="w-full p-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                disabled={updatingStatus}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-violet-600/30 disabled:opacity-50"
              >
                {updatingStatus && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Follow-up Modal ── */}
      {isFollowupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Create Partnership Follow-up</h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Follow-up Task</label>
                <input
                  type="text"
                  value={followupTitle}
                  onChange={(e) => setFollowupTitle(e.target.value)}
                  placeholder="e.g. Conduct quarterly milestone review..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Due In (Days)</label>
                  <select
                    value={followupDueDays}
                    onChange={(e) => setFollowupDueDays(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                  >
                    <option value={1}>1 Day (Tomorrow)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>1 Week</option>
                    <option value={14}>2 Weeks</option>
                    <option value={30}>1 Month</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Priority</label>
                  <select
                    value={followupPriority}
                    onChange={(e) => setFollowupPriority(e.target.value as FollowUpPriority)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsFollowupModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFollowup}
                disabled={addingFollowup || !followupTitle.trim()}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-violet-600/30 disabled:opacity-50"
              >
                {addingFollowup && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Add Task</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default PartnershipDetailPage
