import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { communicationsService } from '../../services/communications'
import { organizationsService } from '../../services/organizations'
import { contactsService } from '../../services/contacts'
import { opportunitiesService } from '../../services/opportunities'
import type { Organization } from '../../types/organization'
import type { Contact } from '../../types/contact'
import type { Opportunity } from '../../types/opportunity'
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
} from '../../types/communication'
import Navbar from '../../components/layout/Navbar'
import {
  MessageSquare,
  ArrowLeft,
  Building2,
  User,
  Target,
  Calendar,
  AlertCircle,
  RotateCw,
} from 'lucide-react'

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

export const CommunicationNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preselectedOrgId = searchParams.get('organization_id')
    ? Number(searchParams.get('organization_id'))
    : ''
  const preselectedContactId = searchParams.get('contact_id')
    ? Number(searchParams.get('contact_id'))
    : ''
  const preselectedOppId = searchParams.get('opportunity_id')
    ? Number(searchParams.get('opportunity_id'))
    : ''

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedOrgId, setSelectedOrgId] = useState<number | ''>(preselectedOrgId)
  const [selectedContactId, setSelectedContactId] = useState<number | ''>(preselectedContactId)
  const [selectedOppId, setSelectedOppId] = useState<number | ''>(preselectedOppId)

  const [channel, setChannel] = useState<CommunicationChannel>('Email')
  const [direction, setDirection] = useState<CommunicationDirection>('Outgoing')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [commDate, setCommDate] = useState(new Date().toISOString().substring(0, 16))
  const [status, setStatus] = useState<CommunicationStatus>('Completed')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    organizationsService
      .getOrganizations({ page_size: 100 })
      .then((data) => setOrganizations(data.items))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedOrgId) {
      setContacts([])
      setOpportunities([])
      setSelectedContactId('')
      setSelectedOppId('')
      return
    }

    Promise.all([
      contactsService.getOrganizationContacts(Number(selectedOrgId)),
      opportunitiesService.getOpportunities({
        organization_id: Number(selectedOrgId),
        page_size: 50,
      }),
    ])
      .then(([contactsData, oppsData]) => {
        setContacts(contactsData)
        setOpportunities(oppsData.items)

        if (preselectedContactId && contactsData.some((c) => c.id === preselectedContactId)) {
          setSelectedContactId(preselectedContactId)
        }
        if (preselectedOppId && oppsData.items.some((o) => o.id === preselectedOppId)) {
          setSelectedOppId(preselectedOppId)
        }
      })
      .catch((err) => console.error(err))
  }, [selectedOrgId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrgId) {
      setError('Please select a target organization.')
      return
    }
    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const newComm = await communicationsService.createCommunication({
        organization_id: Number(selectedOrgId),
        contact_id: selectedContactId ? Number(selectedContactId) : undefined,
        opportunity_id: selectedOppId ? Number(selectedOppId) : undefined,
        channel,
        direction,
        subject: subject.trim(),
        summary: summary.trim() || undefined,
        content: content.trim() || undefined,
        communication_date: commDate ? new Date(commDate).toISOString() : undefined,
        status,
      })

      navigate(`/business-development/communications/${newComm.id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to record communication.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to="/business-development/communications"
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Record Communication</h1>
            <p className="text-xs text-slate-400">Log emails, calls, and direct outreach interactions</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-3xl w-full mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account & Stakeholder */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>1. Target Account & Stakeholder *</span>
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Organization *</label>
              <select
                required
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="">-- Choose Organization --</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.organization_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Contact Person (Optional)</label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">-- None / General Account Level --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Opportunity Track (Optional)</label>
                <select
                  value={selectedOppId}
                  onChange={(e) => setSelectedOppId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">-- None / General Outreach --</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.name} ({opp.stage})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Communication Info */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>2. Interaction Details *</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Channel *</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
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
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="Outgoing">Outgoing (We reached out)</option>
                  <option value="Incoming">Incoming (They contacted us)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Subject / Topic *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Email sent with commercial proposal & deployment roadmap"
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Executive Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary of key conversation takeaway..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Content / Full Notes</label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Message body snippet, call points, or next steps..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Link
              to="/business-development/communications"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  <span>Record Communication</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default CommunicationNewPage
