import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { meetingsService } from '../../services/meetings'
import { organizationsService } from '../../services/organizations'
import { contactsService } from '../../services/contacts'
import type { Organization } from '../../types/organization'
import type { Contact } from '../../types/contact'
import Navbar from '../../components/layout/Navbar'
import {
  CalendarPlus,
  ArrowLeft,
  Building2,
  Users,
  Clock,
  MapPin,
  Video,
  FileText,
  AlertCircle,
  RotateCw,
  Sparkles,
} from 'lucide-react'

const MEETING_TYPES = [
  'Business Discussion',
  'Project Showcase',
  'Partnership Discussion',
  'Introduction',
  'Technical Discussion',
  'Follow-up',
  'Other',
]

export const MeetingNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preselectedOrgId = searchParams.get('organization_id')
    ? Number(searchParams.get('organization_id'))
    : null
  const preselectedContactId = searchParams.get('contact_id')
    ? Number(searchParams.get('contact_id'))
    : null

  // State
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgLoading, setOrgLoading] = useState(true)

  const [selectedOrgId, setSelectedOrgId] = useState<number | ''>(preselectedOrgId || '')
  const [orgContacts, setOrgContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>(
    preselectedContactId ? [preselectedContactId] : []
  )

  const [title, setTitle] = useState('')
  const [meetingType, setMeetingType] = useState('Business Discussion')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('11:00')
  const [duration, setDuration] = useState<number>(45)
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [agenda, setAgenda] = useState('')
  const [description, setDescription] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch Organizations
  useEffect(() => {
    const fetchOrgs = async () => {
      setOrgLoading(true)
      try {
        const data = await organizationsService.getOrganizations({ page_size: 100 })
        setOrganizations(data.items)
      } catch (err: any) {
        console.error('Failed to load organizations for dropdown', err)
      } finally {
        setOrgLoading(false)
      }
    }
    fetchOrgs()
  }, [])

  // 2. Fetch Contacts when Organization changes
  useEffect(() => {
    if (!selectedOrgId) {
      setOrgContacts([])
      setSelectedContactIds([])
      return
    }

    const fetchContacts = async () => {
      setContactsLoading(true)
      try {
        const data = await contactsService.getOrganizationContacts(Number(selectedOrgId))
        setOrgContacts(data)
        if (preselectedContactId && data.some((c: Contact) => c.id === preselectedContactId)) {
          setSelectedContactIds([preselectedContactId])
        } else if (data.length > 0 && selectedContactIds.length === 0) {
          const primary = data.find((c: Contact) => c.is_primary_contact)
          if (primary) setSelectedContactIds([primary.id])
        }
      } catch (err) {
        console.error('Failed to load contacts for organization', err)
      } finally {
        setContactsLoading(false)
      }
    }
    fetchContacts()
  }, [selectedOrgId])

  const handleContactToggle = (contactId: number) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrgId) {
      setError('Please select a target organization.')
      return
    }
    if (!title.trim()) {
      setError('Meeting title is required.')
      return
    }
    if (!meetingDate || !meetingTime) {
      setError('Date and time are required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const scheduledDateTime = new Date(`${meetingDate}T${meetingTime}:00`).toISOString()
      const newMeeting = await meetingsService.createMeeting({
        organization_id: Number(selectedOrgId),
        primary_contact_id: selectedContactIds.length > 0 ? selectedContactIds[0] : undefined,
        contact_ids: selectedContactIds,
        title: title.trim(),
        meeting_type: meetingType,
        scheduled_at: scheduledDateTime,
        duration_minutes: duration,
        location: location.trim() || undefined,
        meeting_url: meetingUrl.trim() || undefined,
        agenda: agenda.trim() || undefined,
        description: description.trim() || undefined,
      })

      navigate(`/business-development/meetings/${newMeeting.id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to schedule meeting.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
            <h1 className="text-base font-bold text-white tracking-tight">Schedule Business Meeting</h1>
            <p className="text-xs text-slate-400">
              Set up a partner presentation, product demo, or executive briefing
            </p>
          </div>
        </div>
      </header>

      {/* ── Main Form Container ── */}
      <main className="flex-1 p-6 max-w-3xl w-full mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Target Organization */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4" />
                <span>1. Target Organization *</span>
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Select Organization *</label>
              {orgLoading ? (
                <div className="flex items-center space-x-2 text-xs text-slate-400 py-2">
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                  <span>Loading organizations directory...</span>
                </div>
              ) : (
                <select
                  required
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">-- Choose Organization --</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.organization_type} · {org.city || 'India'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Attendees from Organization */}
            {selectedOrgId && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>Attending Stakeholders & Contacts:</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {selectedContactIds.length} selected
                  </span>
                </label>

                {contactsLoading ? (
                  <p className="text-xs text-slate-500 italic">Loading contacts...</p>
                ) : orgContacts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-400">
                    No contacts recorded for this organization yet. Meeting will be linked directly
                    to the organization.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {orgContacts.map((c) => {
                      const isSelected = selectedContactIds.includes(c.id)
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleContactToggle(c.id)}
                          className={`p-3 rounded-xl border cursor-pointer select-none transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-teal-500/10 border-teal-500/40 text-teal-200'
                              : 'bg-[#1A1040] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-white">{c.full_name}</div>
                            <div className="text-[11px] text-slate-400">{c.designation}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Meeting Details */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" />
              <span>2. Meeting Information *</span>
            </h2>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Meeting Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Enterprise Platform Presentation"
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            {/* Type & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Meeting Type *</label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Duration (Minutes)</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes (Default)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes (1.5 Hours)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                </select>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Date *</label>
                <input
                  type="date"
                  required
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Time *</label>
                <input
                  type="time"
                  required
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            {/* Location & Video Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Location (Physical Room / Address)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Executive Boardroom / Apollo Hyderabad"
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Meeting Video URL (Teams / Zoom / Meet)</span>
                </label>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://teams.microsoft.com/..."
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>
          </div>

          {/* 3. Agenda & Objective */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>3. Agenda & Preliminary Notes (Optional)</span>
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Agenda Outline</label>
              <textarea
                rows={3}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="1. Platform Overview\n2. Clinical Decision Support & Bed Management Demo\n3. Integration Timeline & Commercial Discussion"
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <Link
              to="/business-development/meetings"
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
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4" />
                  <span>Schedule Meeting</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default MeetingNewPage
