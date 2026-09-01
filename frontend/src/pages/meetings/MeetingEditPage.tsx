import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { meetingsService } from '../../services/meetings'
import type { Meeting } from '../../types/meeting'
import Navbar from '../../components/layout/Navbar'
import {
  ArrowLeft,
  Calendar,
  Save,
  RotateCw,
  AlertCircle,
  Building2,
  MapPin,
  Video,
  FileText,
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

const MEETING_STATUSES = ['Scheduled', 'Completed', 'Rescheduled', 'Cancelled']

export const MeetingEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [meetingType, setMeetingType] = useState('Business Discussion')
  const [status, setStatus] = useState('Scheduled')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [duration, setDuration] = useState<number>(45)
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [agenda, setAgenda] = useState('')
  const [notes, setNotes] = useState('')
  const [decisions, setDecisions] = useState('')
  const [nextActions, setNextActions] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchMeeting = async () => {
      setLoading(true)
      try {
        const data = await meetingsService.getMeeting(id)
        setMeeting(data)
        setTitle(data.title)
        setMeetingType(data.meeting_type)
        setStatus(data.status)
        setDuration(data.duration_minutes)
        setLocation(data.location || '')
        setMeetingUrl(data.meeting_url || '')
        setAgenda(data.agenda || '')
        setNotes(data.notes || '')
        setDecisions(data.decisions || '')
        setNextActions(data.next_actions || '')

        const dt = new Date(data.scheduled_at)
        const year = dt.getFullYear()
        const month = String(dt.getMonth() + 1).padStart(2, '0')
        const day = String(dt.getDate()).padStart(2, '0')
        setMeetingDate(`${year}-${month}-${day}`)

        const hours = String(dt.getHours()).padStart(2, '0')
        const mins = String(dt.getMinutes()).padStart(2, '0')
        setMeetingTime(`${hours}:${mins}`)
      } catch (err: any) {
        setError(err.detail || err.message || 'Failed to load meeting.')
      } finally {
        setLoading(false)
      }
    }
    fetchMeeting()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    if (!title.trim()) {
      setError('Meeting title is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const scheduledDateTime =
        meetingDate && meetingTime
          ? new Date(`${meetingDate}T${meetingTime}:00`).toISOString()
          : undefined

      await meetingsService.updateMeeting(id, {
        title: title.trim(),
        meeting_type: meetingType,
        status: status as any,
        scheduled_at: scheduledDateTime,
        duration_minutes: duration,
        location: location.trim() || undefined,
        meeting_url: meetingUrl.trim() || undefined,
        agenda: agenda.trim() || undefined,
        notes: notes.trim() || undefined,
        decisions: decisions.trim() || undefined,
        next_actions: nextActions.trim() || undefined,
      })

      navigate(`/business-development/meetings/${id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update meeting.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] flex items-center justify-center text-white">
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
            to={`/business-development/meetings/${id}`}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Edit Business Meeting</h1>
            <p className="text-xs text-slate-400">{meeting?.organization_name || 'Meeting record'}</p>
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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Meeting Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Meeting Type</label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  {MEETING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Time</label>
                <input
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Duration (Min)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Meeting URL</label>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Agenda</label>
              <textarea
                rows={3}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Discussion Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Link
              to={`/business-development/meetings/${id}`}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default MeetingEditPage
