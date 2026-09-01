import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { meetingsService } from '../../services/meetings'
import { followupsService } from '../../services/followups'
import type { Meeting } from '../../types/meeting'
import type { FollowUp } from '../../types/followup'
import MeetingStatusBadge from '../../components/meetings/MeetingStatusBadge'
import CompleteMeetingModal from '../../components/meetings/CompleteMeetingModal'
import Navbar from '../../components/layout/Navbar'
import AddFollowUpModal from '../../components/followups/AddFollowUpModal'
import FollowUpPriorityBadge from '../../components/followups/FollowUpPriorityBadge'
import FollowUpStatusBadge from '../../components/followups/FollowUpStatusBadge'
import {
  Calendar,
  Building2,
  Users,
  Clock,
  MapPin,
  Video,
  FileText,
  CheckCircle2,
  Target,
  ArrowLeft,
  Edit2,
  RotateCw,
  AlertCircle,
  ExternalLink,
  CalendarPlus,
  XCircle,
  Clock3,
} from 'lucide-react'

export const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false)
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState<boolean>(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false)
  const [cancelReason, setCancelReason] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<boolean>(false)

  const fetchMeeting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await meetingsService.getMeeting(id)
      setMeeting(data)

      // Fetch linked follow-ups
      const folData = await followupsService.getFollowUps({ meeting_id: Number(id) })
      setFollowups(folData.items)
    } catch (err: any) {
      setError(err.detail || err.message || 'Meeting not found.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchMeeting()
  }, [fetchMeeting])

  const handleCancelMeeting = async () => {
    if (!meeting) return
    setActionLoading(true)
    try {
      await meetingsService.cancelMeeting(meeting.id, cancelReason)
      setIsCancelModalOpen(false)
      fetchMeeting()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to cancel meeting.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteFollowup = async (folId: number) => {
    try {
      await followupsService.completeFollowUp(folId)
      fetchMeeting()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
          <p className="text-xs text-slate-400">Loading meeting profile...</p>
        </div>
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-[#0A071B] flex items-center justify-center p-6 text-white">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Meeting Not Found</h2>
          <p className="text-xs text-slate-400">{error}</p>
          <Link
            to="/business-development/meetings"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
          >
            Return to Meetings
          </Link>
        </div>
      </div>
    )
  }

  const meetingDate = new Date(meeting.scheduled_at)

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />
      {/* ── Top Bar ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to="/business-development/meetings"
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-violet-400">Meeting #{meeting.id}</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">{meeting.meeting_type}</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">{meeting.title}</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {meeting.status === 'Scheduled' && (
            <>
              <button
                onClick={() => setIsCompleteModalOpen(true)}
                className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>

              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="flex items-center space-x-1.5 py-2 px-3 rounded-xl bg-[#1A1040] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-medium transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </>
          )}

          <Link
            to={`/business-development/meetings/${meeting.id}/edit`}
            className="flex items-center space-x-1.5 py-2 px-3 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Link>
        </div>
      </header>

      {/* ── Main Content Grid ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Hero Card */}
        <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {meeting.title}
                </h2>
                <MeetingStatusBadge status={meeting.status} size="md" />
                <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono border border-violet-500/20">
                  {meeting.meeting_type}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                {meeting.organization_name && (
                  <Link
                    to={`/business-development/organizations/${meeting.organization_id}`}
                    className="flex items-center space-x-1.5 text-violet-400 hover:text-violet-300 font-semibold"
                  >
                    <Building2 className="w-4 h-4 text-violet-400" />
                    <span>{meeting.organization_name}</span>
                  </Link>
                )}

                <div className="flex items-center space-x-1.5 text-slate-300 font-mono">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>
                    {meetingDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    at{' '}
                    {meetingDate.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    ({meeting.duration_minutes} Minutes)
                  </span>
                </div>

                {meeting.location && (
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>{meeting.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Call Quick Link */}
            {meeting.meeting_url && (
              <a
                href={meeting.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 shrink-0 self-start md:self-center"
              >
                <Video className="w-4 h-4" />
                <span>Join Video Conference</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}
          </div>
        </div>

        {/* Two Columns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Agenda, Discussion Notes, Decisions, Next Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agenda */}
            {meeting.agenda && (
              <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Meeting Agenda</span>
                </h3>
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {meeting.agenda}
                </div>
              </div>
            )}

            {/* Discussion Notes */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Discussion Notes</span>
                </h3>
                {meeting.status === 'Scheduled' && (
                  <button
                    onClick={() => setIsCompleteModalOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    + Record Notes
                  </button>
                )}
              </div>

              {meeting.notes ? (
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {meeting.notes}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                  No discussion notes recorded yet. Click "Mark Completed" to record meeting
                  outcomes.
                </p>
              )}
            </div>

            {/* Decisions Made */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Agreed Decisions</span>
              </h3>
              {meeting.decisions ? (
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {meeting.decisions}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                  No explicit decisions recorded.
                </p>
              )}
            </div>

            {/* Next Actions */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Agreed Next Actions</span>
              </h3>
              {meeting.next_actions ? (
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {meeting.next_actions}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                  No specific next actions recorded.
                </p>
              )}
            </div>

            {/* Cancellation Notice if Cancelled */}
            {meeting.status === 'Cancelled' && meeting.cancellation_reason && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                <span className="text-xs font-bold text-rose-300">Cancellation Reason:</span>
                <p className="text-xs text-rose-200">{meeting.cancellation_reason}</p>
              </div>
            )}
          </div>

          {/* Right Column: Attendees Roster & Linked Follow-ups */}
          <div className="space-y-6">
            {/* Attendees Card */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Attendees & Stakeholders</span>
              </h3>

              {meeting.attendees && meeting.attendees.length > 0 ? (
                <div className="space-y-2.5">
                  {meeting.attendees.map((att) => (
                    <Link
                      key={att.id}
                      to={`/business-development/contacts/${att.id}`}
                      className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 hover:border-teal-500/40 transition block group space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white group-hover:text-teal-300 transition">
                          {att.full_name}
                        </span>
                        {att.is_decision_maker && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            Decision Maker
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{att.designation}</p>
                      {att.email && (
                        <p className="text-[10px] text-slate-500 font-mono">{att.email}</p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No specific contacts attached.</p>
              )}
            </div>

            {/* Linked Follow-ups Card */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>Linked Follow-ups</span>
                </h3>
                <button
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium"
                >
                  + Add Follow-up
                </button>
              </div>

              {followups.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">No action follow-ups created yet.</p>
                  <button
                    onClick={() => setIsFollowUpModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
                  >
                    Add First Follow-up
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {followups.map((f) => (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl bg-[#1A1040] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-white">{f.title}</span>
                        <FollowUpPriorityBadge priority={f.priority} size="sm" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span className="font-mono">{f.timing_label}</span>
                        {f.status === 'Pending' ? (
                          <button
                            onClick={() => handleCompleteFollowup(f.id)}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold"
                          >
                            Mark Done
                          </button>
                        ) : (
                          <FollowUpStatusBadge status={f.status} size="sm" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Complete Modal */}
      <CompleteMeetingModal
        isOpen={isCompleteModalOpen}
        meetingTitle={meeting.title}
        organizationName={meeting.organization_name}
        onClose={() => setIsCompleteModalOpen(false)}
        onConfirm={async (data) => {
          await meetingsService.completeMeeting(meeting.id, data)
          fetchMeeting()
        }}
      />

      {/* Add Follow-up Modal */}
      <AddFollowUpModal
        isOpen={isFollowUpModalOpen}
        organizationId={meeting.organization_id}
        organizationName={meeting.organization_name}
        contactId={meeting.primary_contact_id}
        contactName={meeting.primary_contact_name}
        meetingId={meeting.id}
        onClose={() => setIsFollowUpModalOpen(false)}
        onSuccess={fetchMeeting}
      />

      {/* Cancel Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Cancel Meeting</h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to cancel "{meeting.title}"? You can specify a reason below.
            </p>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Client requested postponement due to audit..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleCancelMeeting}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default MeetingDetailPage
