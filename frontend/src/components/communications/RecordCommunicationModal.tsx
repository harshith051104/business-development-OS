import React, { useState, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Building2,
  User,
  Target,
  Calendar,
  AlertCircle,
  RotateCw,
} from 'lucide-react'
import { communicationsService } from '../../services/communications'
import { contactsService } from '../../services/contacts'
import { opportunitiesService } from '../../services/opportunities'
import type { Contact } from '../../types/contact'
import type { Opportunity } from '../../types/opportunity'
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
} from '../../types/communication'

interface RecordCommunicationModalProps {
  isOpen: boolean
  organizationId: number
  organizationName?: string
  contactId?: number
  contactName?: string
  opportunityId?: number
  opportunityName?: string
  onClose: () => void
  onSuccess: () => void
}

const CHANNELS: CommunicationChannel[] = [
  'Email',
  'Phone',
  'LinkedIn',
  'WhatsApp',
  'Meeting',
  'Video Call',
  'In Person',
  'Other',
]

export const RecordCommunicationModal: React.FC<RecordCommunicationModalProps> = ({
  isOpen,
  organizationId,
  organizationName,
  contactId: initialContactId,
  contactName,
  opportunityId: initialOpportunityId,
  opportunityName,
  onClose,
  onSuccess,
}) => {
  const [channel, setChannel] = useState<CommunicationChannel>('Email')
  const [direction, setDirection] = useState<CommunicationDirection>('Outgoing')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [commDate, setCommDate] = useState(
    new Date().toISOString().substring(0, 16)
  )
  const [status, setStatus] = useState<CommunicationStatus>('Completed')

  const [selectedContactId, setSelectedContactId] = useState<number | ''>(
    initialContactId || ''
  )
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<number | ''>(
    initialOpportunityId || ''
  )

  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && organizationId) {
      contactsService
        .getOrganizationContacts(organizationId)
        .then((data) => setContacts(data))
        .catch((err) => console.error(err))

      opportunitiesService
        .getOpportunities({ organization_id: organizationId, page_size: 50 })
        .then((data) => setOpportunities(data.items))
        .catch((err) => console.error(err))
    }
  }, [isOpen, organizationId])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await communicationsService.createCommunication({
        organization_id: organizationId,
        contact_id: selectedContactId ? Number(selectedContactId) : undefined,
        opportunity_id: selectedOpportunityId
          ? Number(selectedOpportunityId)
          : undefined,
        channel,
        direction,
        subject: subject.trim(),
        summary: summary.trim() || undefined,
        content: content.trim() || undefined,
        communication_date: commDate ? new Date(commDate).toISOString() : undefined,
        status,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to record communication.')
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
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Record Communication Log</h2>
              <p className="text-xs text-slate-400">
                {organizationName || 'Organization'}
                {contactName ? ` · ${contactName}` : ''}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Channel & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Channel *</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Direction *</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as CommunicationDirection)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="Outgoing">Outgoing (We contacted them)</option>
                <option value="Incoming">Incoming (They contacted us)</option>
              </select>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Subject / Topic *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Introductory Email sent regarding ELLY Platform capabilities"
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Contact & Opportunity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Contact Person (Optional)</label>
              <select
                value={selectedContactId}
                onChange={(e) =>
                  setSelectedContactId(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="">-- General Organization Level --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.designation})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Opportunity Track (Optional)
              </label>
              <select
                value={selectedOpportunityId}
                onChange={(e) =>
                  setSelectedOpportunityId(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="">-- None / General Discussion --</option>
                {opportunities.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    {opp.name} ({opp.stage})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Communication Date & Time</label>
              <input
                type="datetime-local"
                value={commDate}
                onChange={(e) => setCommDate(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CommunicationStatus)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Executive Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="High-level summary of the exchange..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Full Content / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Communication Content / Discussion Notes
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Record email body snippet, call points, or message summary..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-800">
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
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Record Communication</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default RecordCommunicationModal
