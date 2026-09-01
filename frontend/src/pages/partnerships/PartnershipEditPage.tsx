import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { partnershipsService } from '../../services/partnerships'
import { contactsService } from '../../services/contacts'
import { showcaseService } from '../../services/showcase'
import type { Partnership, PartnershipType, PartnershipPriority, PartnershipStatus } from '../../types/partnership'
import type { Contact } from '../../types/contact'
import type { Project } from '../../types/project'
import {
  Handshake,
  ArrowLeft,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Building2,
  Users,
  Target,
  Sparkles,
  Save,
} from 'lucide-react'

const PARTNERSHIP_TYPES: PartnershipType[] = [
  'Technology Partnership',
  'Business Partnership',
  'Strategic Partnership',
  'Integration Partnership',
  'Service Partnership',
  'Distribution Partnership',
  'Referral Partnership',
  'Other',
]

export const PartnershipEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [partnership, setPartnership] = useState<Partnership | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Form Fields
  const [name, setName] = useState<string>('')
  const [partnershipType, setPartnershipType] = useState<PartnershipType>('Business Partnership')
  const [status, setStatus] = useState<PartnershipStatus>('Active')
  const [priority, setPriority] = useState<PartnershipPriority>('Medium')
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [objectives, setObjectives] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [nextAction, setNextAction] = useState<string>('')
  const [nextActionDate, setNextActionDate] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!id) return
      setLoading(true)
      try {
        const [p, projRes] = await Promise.all([
          partnershipsService.getPartnership(Number(id)),
          showcaseService.getProjects({ page_size: 50 }),
        ])
        setPartnership(p)
        setProjects(projRes.items)

        setName(p.name)
        setPartnershipType(p.partnership_type)
        setStatus(p.status)
        setPriority(p.priority)
        setSelectedContactId(p.primary_contact_id || null)
        setSelectedProjectId(p.project_id || null)
        setStartDate(p.start_date ? p.start_date.split('T')[0] : '')
        setEndDate(p.end_date ? p.end_date.split('T')[0] : '')
        setObjectives(p.objectives || '')
        setDescription(p.description || '')
        setNotes(p.notes || '')
        setNextAction(p.next_action || '')
        setNextActionDate(p.next_action_date ? p.next_action_date.split('T')[0] : '')

        if (p.organization_id) {
          const cRes = await contactsService.getContacts({ organization_id: p.organization_id, page_size: 50 })
          setContacts(cRes.items)
        }
      } catch (err: any) {
        setError(err.detail || err.message || 'Failed to load partnership.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !name.trim()) {
      setError('Partnership name is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await partnershipsService.updatePartnership(Number(id), {
        name: name.trim(),
        partnership_type: partnershipType,
        status,
        priority,
        primary_contact_id: selectedContactId,
        project_id: selectedProjectId,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        objectives: objectives.trim() || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        next_action: nextAction.trim() || undefined,
        next_action_date: nextActionDate ? new Date(nextActionDate).toISOString() : undefined,
      })

      navigate(`/business-development/partnerships/${id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update partnership.')
    } finally {
      setSaving(false)
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

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link
            to={`/business-development/partnerships/${id}`}
            className="hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Partnership Details</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium">Edit Partnership</span>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800/80">
            <div className="p-2.5 rounded-2xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Edit Partnership</h1>
              <p className="text-xs text-slate-400">
                Update alliance specifications, objectives, and assigned contacts
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">
                Partnership Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Partnership Type</label>
                <select
                  value={partnershipType}
                  onChange={(e) => setPartnershipType(e.target.value as PartnershipType)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                >
                  {PARTNERSHIP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PartnershipStatus)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                  <option value="Ended">Ended</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PartnershipPriority)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Primary Contact</label>
                <select
                  value={selectedContactId || ''}
                  onChange={(e) => setSelectedContactId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                >
                  <option value="">-- General Account (No Contact) --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.designation ? `(${c.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Associated Project</label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                >
                  <option value="">-- No Specific Project --</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">End Date (Optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Strategic Objectives</label>
              <textarea
                rows={3}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Next Action</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Next Action Date</label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Internal Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end space-x-3">
            <Link
              to={`/business-development/partnerships/${id}`}
              className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {saving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default PartnershipEditPage
