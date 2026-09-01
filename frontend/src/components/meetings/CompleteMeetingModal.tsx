import React, { useState } from 'react'
import { X, CheckCircle2, FileText, Target, ArrowRight, CalendarPlus } from 'lucide-react'
import type { MeetingCompleteInput } from '../../types/meeting'

interface CompleteMeetingModalProps {
  isOpen: boolean
  meetingTitle: string
  organizationName?: string
  onClose: () => void
  onConfirm: (data: MeetingCompleteInput) => Promise<void>
}

export const CompleteMeetingModal: React.FC<CompleteMeetingModalProps> = ({
  isOpen,
  meetingTitle,
  organizationName,
  onClose,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('')
  const [decisions, setDecisions] = useState('')
  const [nextActions, setNextActions] = useState('')
  const [createFollowUp, setCreateFollowUp] = useState(false)
  const [followupTitle, setFollowupTitle] = useState('')
  const [followupDueAt, setFollowupDueAt] = useState('')
  const [followupPriority, setFollowupPriority] = useState<'High' | 'Medium' | 'Low'>('High')
  const [advanceOrgStatus, setAdvanceOrgStatus] = useState<string>('Discussion')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notes.trim()) {
      setError('Please provide discussion notes summarizing the meeting.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const payload: MeetingCompleteInput = {
        notes: notes.trim(),
        decisions: decisions.trim() || undefined,
        next_actions: nextActions.trim() || undefined,
        advance_org_status: advanceOrgStatus || undefined,
      }

      if (createFollowUp && followupTitle.trim() && followupDueAt) {
        payload.followup_title = followupTitle.trim()
        payload.followup_due_at = new Date(followupDueAt).toISOString()
        payload.followup_priority = followupPriority
      }

      await onConfirm(payload)
      onClose()
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to complete meeting.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Record Meeting Outcome</h2>
              <p className="text-xs text-slate-400">
                {meetingTitle} {organizationName ? `· ${organizationName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Discussion Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-violet-400" />
              <span>Discussion Notes *</span>
            </label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summary of topics discussed, customer interest, pain points, feedback..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
            />
          </div>

          {/* Decisions Made */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Key Decisions Made (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              placeholder="Agreed next milestones, technical review scope, stakeholder sign-offs..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Agreed Next Actions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>Agreed Next Actions (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={nextActions}
              onChange={(e) => setNextActions(e.target.value)}
              placeholder="Send project presentation deck, schedule technical review..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
          </div>

          {/* Organization Pipeline Stage Progression */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
              <span>Update Organization Pipeline Stage:</span>
            </label>
            <select
              value={advanceOrgStatus}
              onChange={(e) => setAdvanceOrgStatus(e.target.value)}
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition"
            >
              <option value="">Keep current organization stage</option>
              <option value="Discussion">Advance to Discussion (Active Discussions)</option>
              <option value="Partnership">Advance to Partnership (Partner Agreement)</option>
              <option value="Interested">Remain in Interested</option>
            </select>
          </div>

          {/* Create Follow-up Toggle */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createFollowUp}
                onChange={(e) => setCreateFollowUp(e.target.checked)}
                className="rounded bg-[#1A1040] border-slate-700 text-violet-600 focus:ring-0 w-4 h-4"
              />
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <CalendarPlus className="w-3.5 h-3.5 text-violet-400" />
                <span>Create linked follow-up task</span>
              </span>
            </label>

            {createFollowUp && (
              <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Follow-up Task *</span>
                  <input
                    type="text"
                    required={createFollowUp}
                    value={followupTitle}
                    onChange={(e) => setFollowupTitle(e.target.value)}
                    placeholder="e.g. Send technical architecture brief to Dr. Reddy"
                    className="w-full bg-[#110B2E] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Due Date & Time *</span>
                    <input
                      type="datetime-local"
                      required={createFollowUp}
                      value={followupDueAt}
                      onChange={(e) => setFollowupDueAt(e.target.value)}
                      className="w-full bg-[#110B2E] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Priority</span>
                    <select
                      value={followupPriority}
                      onChange={(e) => setFollowupPriority(e.target.value as any)}
                      className="w-full bg-[#110B2E] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Outcome...' : 'Mark as Completed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default CompleteMeetingModal
