import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { communicationsService } from '../../services/communications'
import { contactsService } from '../../services/contacts'
import { opportunitiesService } from '../../services/opportunities'
import type { Contact } from '../../types/contact'
import type { Opportunity } from '../../types/opportunity'
import type {
  Communication,
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

export const CommunicationEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [communication, setCommunication] = useState<Communication | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedContactId, setSelectedContactId] = useState<number | ''>('')
  const [selectedOppId, setSelectedOppId] = useState<number | ''>('')
  const [channel, setChannel] = useState<CommunicationChannel>('Email')
  const [direction, setDirection] = useState<CommunicationDirection>('Outgoing')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [commDate, setCommDate] = useState('')
  const [status, setStatus] = useState<CommunicationStatus>('Completed')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const comm = await communicationsService.getCommunication(id)
        setCommunication(comm)

        setSelectedContactId(comm.contact_id || '')
        setSelectedOppId(comm.opportunity_id || '')
        setChannel(comm.channel as CommunicationChannel)
        setDirection(comm.direction as CommunicationDirection)
        setSubject(comm.subject)
        setSummary(comm.summary || '')
        setContent(comm.content || '')
        setCommDate(
          comm.communication_date ? comm.communication_date.substring(0, 16) : ''
        )
        setStatus(comm.status as CommunicationStatus)

        const [contactsData, oppsData] = await Promise.all([
          contactsService.getOrganizationContacts(comm.organization_id),
          opportunitiesService.getOpportunities({
            organization_id: comm.organization_id,
            page_size: 50,
          }),
        ])
        setContacts(contactsData)
        setOpportunities(oppsData.items)
      } catch (err: any) {
        setError(err.detail || err.message || 'Failed to load record.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !subject.trim()) {
      setError('Subject is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await communicationsService.updateCommunication(id, {
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

      navigate(`/business-development/communications/${id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update communication.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-white flex items-center justify-center">
        <RotateCw className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to={`/business-development/communications/${id}`}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Edit Communication Log</h1>
            <p className="text-xs text-slate-400">{communication?.organization_name}</p>
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

          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Contact Person</label>
                <select
                  value={selectedContactId}
                  onChange={(e) =>
                    setSelectedContactId(e.target.value ? Number(e.target.value) : '')
                  }
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
                <label className="text-xs font-semibold text-slate-300">Opportunity Track</label>
                <select
                  value={selectedOppId}
                  onChange={(e) =>
                    setSelectedOppId(e.target.value ? Number(e.target.value) : '')
                  }
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Channel</label>
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
                <label className="text-xs font-semibold text-slate-300">Direction</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as CommunicationDirection)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="Outgoing">Outgoing</option>
                  <option value="Incoming">Incoming</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Subject *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
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
              <label className="text-xs font-semibold text-slate-300">Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Content / Full Notes</label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Link
              to={`/business-development/communications/${id}`}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default CommunicationEditPage
