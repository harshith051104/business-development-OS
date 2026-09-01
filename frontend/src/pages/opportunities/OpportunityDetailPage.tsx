import React, { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { opportunitiesService } from '../../services/opportunities'
import type { Opportunity, OpportunityStage } from '../../types/opportunity'
import OpportunityStageBadge from '../../components/opportunities/OpportunityStageBadge'
import OpportunityPriorityBadge from '../../components/opportunities/OpportunityPriorityBadge'
import ChangeStageModal from '../../components/opportunities/ChangeStageModal'
import ConvertToPartnershipModal from '../../components/partnerships/ConvertToPartnershipModal'
import RelationshipTimeline from '../../components/communications/RelationshipTimeline'
import {
  Target,
  ArrowLeft,
  Edit,
  Trash2,
  Building2,
  User,
  Sparkles,
  DollarSign,
  Calendar,
  Clock,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  AlertCircle,
  ExternalLink,
  Plus,
  ArrowRight,
  GitFork,
  MessageSquare,
  ShieldAlert,
  Handshake,
} from 'lucide-react'

const PIPELINE_STAGES: OpportunityStage[] = [
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

export const OpportunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isStageModalOpen, setIsStageModalOpen] = useState(false)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await opportunitiesService.getOpportunity(id)
      setOpportunity(data)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load opportunity details.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  const handleStageChange = async (newStage: string, note?: string) => {
    if (!opportunity) return
    await opportunitiesService.updateStage(opportunity.id, newStage, note)
    fetchDetails()
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opportunity || !noteText.trim()) return
    setIsSubmittingNote(true)
    try {
      await opportunitiesService.addNote(opportunity.id, noteText.trim())
      setNoteText('')
      setIsNoteModalOpen(false)
      fetchDetails()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to add note.')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const handleDelete = async () => {
    if (!opportunity) return
    setIsDeleting(true)
    try {
      await opportunitiesService.deleteOpportunity(opportunity.id)
      navigate('/business-development/opportunities')
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to delete opportunity.')
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading opportunity details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !opportunity) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3 max-w-md">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Opportunity Not Found</h3>
            <p className="text-xs text-slate-400">{error || 'This opportunity may have been removed.'}</p>
            <Link
              to="/business-development/opportunities"
              className="inline-flex px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Back to Opportunities
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const currentStageIndex = PIPELINE_STAGES.indexOf(opportunity.stage as OpportunityStage)

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/business-development/opportunities"
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {opportunity.name}
              </h1>
              <OpportunityStageBadge stage={opportunity.stage} size="sm" />
              <OpportunityPriorityBadge priority={opportunity.priority} size="sm" />
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{opportunity.organization_name}</span>
              {opportunity.primary_contact_name && (
                <>
                  <span>·</span>
                  <span className="text-teal-400">{opportunity.primary_contact_name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {opportunity.stage !== 'Partnership' && (
            <button
              onClick={() => setIsConvertModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5"
            >
              <Handshake className="w-3.5 h-3.5" />
              <span>Convert to Partnership</span>
            </button>
          )}
          <button
            onClick={() => setIsStageModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 flex items-center space-x-1.5"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Update Stage</span>
          </button>
          <Link
            to={`/business-development/opportunities/${opportunity.id}/edit`}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
            title="Edit Opportunity"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition border border-slate-800 hover:border-rose-500/30"
            title="Delete Opportunity"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main Content Grid ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Stage Progress Funnel Bar */}
        <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pipeline Stage Progression
            </h3>
            <span className="text-xs font-bold text-violet-400">
              Stage {currentStageIndex >= 0 ? currentStageIndex + 1 : 1} of 7: {opportunity.stage}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {PIPELINE_STAGES.map((stg, idx) => {
              const isCompleted = idx < currentStageIndex
              const isCurrent = idx === currentStageIndex
              return (
                <div key={stg} className="space-y-1.5 text-center">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                        : isCurrent
                        ? 'bg-violet-500 shadow-md shadow-violet-500/50 animate-pulse'
                        : 'bg-slate-800'
                    }`}
                  />
                  <span
                    className={`text-[10px] block truncate font-medium ${
                      isCurrent
                        ? 'text-violet-300 font-bold'
                        : isCompleted
                        ? 'text-slate-300'
                        : 'text-slate-600'
                    }`}
                  >
                    {stg}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left 2 Columns ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Financial & Probability Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-lg space-y-1">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Estimated Value</span>
                </span>
                <div className="text-lg font-bold text-white font-mono">
                  {opportunity.estimated_value
                    ? `$${opportunity.estimated_value.toLocaleString()} ${opportunity.currency}`
                    : 'Not specified'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-lg space-y-1">
                <span className="text-[11px] text-slate-400">Close Probability</span>
                <div className="flex items-center space-x-2">
                  <div className="text-lg font-bold text-violet-300 font-mono">
                    {opportunity.probability !== undefined && opportunity.probability !== null
                      ? `${opportunity.probability}%`
                      : '—'}
                  </div>
                  <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-violet-500 h-full rounded-full"
                      style={{ width: `${opportunity.probability || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-lg space-y-1">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Expected Close</span>
                </span>
                <div className="text-xs font-bold text-slate-200">
                  {opportunity.expected_close_date
                    ? new Date(opportunity.expected_close_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Flexible'}
                </div>
              </div>
            </div>

            {/* Immediate Next Action Banner */}
            <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Immediate Next Business Action</span>
                </h3>
              </div>

              {opportunity.next_action ? (
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">
                      {opportunity.next_action}
                    </div>
                    {opportunity.next_action_date && (
                      <div className="text-xs text-violet-300 font-mono flex items-center gap-1.5">
                        <Clock3 className="w-3.5 h-3.5" />
                        <span>
                          Target Date:{' '}
                          {new Date(opportunity.next_action_date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" />
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 text-amber-300 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>No next business action specified</span>
                  </div>
                  <Link
                    to={`/business-development/opportunities/${opportunity.id}/edit`}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-200 text-xs font-semibold hover:bg-amber-500/30 transition"
                  >
                    Set Next Action
                  </Link>
                </div>
              )}
            </div>

            {/* Description & Scope */}
            {opportunity.description && (
              <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Opportunity Scope & Objective
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {opportunity.description}
                </p>
              </div>
            )}

            {/* Internal Notes */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  <span>Internal BD Notes</span>
                </h3>
                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className="px-3 py-1 rounded-xl bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 text-xs font-semibold transition border border-violet-500/30 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Note</span>
                </button>
              </div>

              {opportunity.notes ? (
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {opportunity.notes}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-500 italic">
                  No internal notes recorded yet.
                </div>
              )}
            </div>

            {/* Phase 8: Communication History & Timeline */}
            <RelationshipTimeline
              organizationId={opportunity.organization_id}
              organizationName={opportunity.organization_name || undefined}
              contactId={opportunity.primary_contact_id || undefined}
              contactName={opportunity.primary_contact_name || undefined}
              opportunityId={opportunity.id}
              opportunityName={opportunity.name}
              title="Opportunity Communication & Interaction History"
            />

            {/* Activity History Timeline */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Opportunity Activity History
              </h3>

              {opportunity.activities && opportunity.activities.length > 0 ? (
                <div className="space-y-3">
                  {opportunity.activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800/80 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span className="font-semibold text-violet-300">{act.activity_type}</span>
                        <span className="font-mono">
                          {new Date(act.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-300">{act.description}</p>
                      {act.performed_by && (
                        <div className="text-[10px] text-slate-500">By {act.performed_by}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-500 italic">
                  No activity history recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Related Entities ── */}
          <div className="space-y-6">
            {/* Organization Card */}
            <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-violet-400" />
                <span>Target Organization</span>
              </span>
              <div className="space-y-1">
                <Link
                  to={`/business-development/organizations/${opportunity.organization_id}`}
                  className="text-sm font-bold text-white hover:text-violet-300 transition flex items-center justify-between group"
                >
                  <span>{opportunity.organization_name}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                </Link>
                <div className="text-xs text-slate-400">Account Record</div>
              </div>
            </div>

            {/* Primary Contact Card */}
            {opportunity.primary_contact_name && (
              <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  <span>Key Stakeholder</span>
                </span>
                <div className="space-y-1">
                  <Link
                    to={`/business-development/contacts/${opportunity.primary_contact_id}`}
                    className="text-sm font-bold text-white hover:text-teal-300 transition flex items-center justify-between group"
                  >
                    <span>{opportunity.primary_contact_name}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                  </Link>
                  {opportunity.primary_contact_designation && (
                    <div className="text-xs text-slate-400">
                      {opportunity.primary_contact_designation}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Showcase Project Card */}
            {opportunity.project_title && (
              <div className="p-5 rounded-2xl bg-[#110B2E] border border-violet-500/30 bg-violet-950/10 shadow-xl space-y-3">
                <span className="text-[11px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>Showcase Project In Scope</span>
                </span>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-white">{opportunity.project_title}</div>
                  <Link
                    to={`/business-development/showcase/${opportunity.project_id}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition shadow-md shadow-violet-600/30"
                  >
                    <span>Open Presentation Deck</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Ownership & Metadata */}
            <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Account Ownership
              </span>
              <div className="flex items-center justify-between text-slate-300">
                <span>Assigned Owner:</span>
                <span className="font-semibold text-white">
                  {opportunity.owner_name || 'BD Team'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Created Date:</span>
                <span>{new Date(opportunity.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stage Modal */}
      {isStageModalOpen && (
        <ChangeStageModal
          isOpen={isStageModalOpen}
          opportunityName={opportunity.name}
          currentStage={opportunity.stage}
          onClose={() => setIsStageModalOpen(false)}
          onConfirm={(stg, note) => handleStageChange(stg, note)}
        />
      )}

      {/* Add Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Add Internal Note</h3>
            <form onSubmit={handleAddNote} className="space-y-4">
              <textarea
                rows={4}
                required
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type your note here..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              <div className="flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isSubmittingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-sm font-bold text-white">Delete Business Opportunity</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove <span className="font-bold text-white">"{opportunity.name}"</span>? This will soft-delete the opportunity.
            </p>
            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Convert to Partnership Modal */}
      {opportunity && (
        <ConvertToPartnershipModal
          opportunity={opportunity}
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          onSuccess={fetchDetails}
        />
      )}
    </div>
  )
}
export default OpportunityDetailPage
