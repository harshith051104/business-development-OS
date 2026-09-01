import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { opportunitiesService } from '../../services/opportunities'
import { organizationsService } from '../../services/organizations'
import { contactsService } from '../../services/contacts'
import { showcaseService } from '../../services/showcase'
import type { Organization } from '../../types/organization'
import type { Contact } from '../../types/contact'
import type { Project } from '../../types/project'
import type { OpportunityStage, OpportunityPriority } from '../../types/opportunity'
import Navbar from '../../components/layout/Navbar'
import {
  Target,
  ArrowLeft,
  Building2,
  User,
  Sparkles,
  DollarSign,
  Calendar,
  AlertCircle,
  RotateCw,
  FileText,
} from 'lucide-react'

const STAGES: OpportunityStage[] = [
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

export const OpportunityNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preselectedOrgId = searchParams.get('organization_id')
    ? Number(searchParams.get('organization_id'))
    : ''
  const preselectedContactId = searchParams.get('contact_id')
    ? Number(searchParams.get('contact_id'))
    : ''
  const preselectedProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : ''

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedOrgId, setSelectedOrgId] = useState<number | ''>(preselectedOrgId)
  const [selectedContactId, setSelectedContactId] = useState<number | ''>(preselectedContactId)
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>(preselectedProjectId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState<OpportunityStage>('Interested')
  const [priority, setPriority] = useState<OpportunityPriority>('High')
  const [estimatedValue, setEstimatedValue] = useState<string>('')
  const [currency, setCurrency] = useState('USD')
  const [probability, setProbability] = useState<number>(50)
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      try {
        const [orgsData, projsData] = await Promise.all([
          organizationsService.getOrganizations({ page_size: 100 }),
          showcaseService.getProjects({ page_size: 50 }),
        ])
        setOrganizations(orgsData.items)
        setProjects(projsData.items)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (!selectedOrgId) {
      setContacts([])
      setSelectedContactId('')
      return
    }

    contactsService
      .getOrganizationContacts(Number(selectedOrgId))
      .then((data) => {
        setContacts(data)
        if (preselectedContactId && data.some((c) => c.id === preselectedContactId)) {
          setSelectedContactId(preselectedContactId)
        } else if (data.length > 0 && !selectedContactId) {
          const primary = data.find((c) => c.is_primary_contact)
          if (primary) setSelectedContactId(primary.id)
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
    if (!name.trim()) {
      setError('Opportunity name is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const newOpp = await opportunitiesService.createOpportunity({
        organization_id: Number(selectedOrgId),
        primary_contact_id: selectedContactId ? Number(selectedContactId) : undefined,
        project_id: selectedProjectId ? Number(selectedProjectId) : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        stage,
        priority,
        estimated_value: estimatedValue ? Number(estimatedValue) : undefined,
        currency,
        probability: probability || undefined,
        expected_close_date: expectedCloseDate
          ? new Date(expectedCloseDate).toISOString()
          : undefined,
        next_action: nextAction.trim() || undefined,
        next_action_date: nextActionDate ? new Date(nextActionDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      })

      navigate(`/business-development/opportunities/${newOpp.id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to create opportunity.')
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
            to="/business-development/opportunities"
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Create Business Opportunity</h1>
            <p className="text-xs text-slate-400">Record a new potential partnership or technology collaboration</p>
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

          {/* 1. Target Account */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>1. Target Account & Stakeholder *</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Target Organization *</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Primary Contact (Optional)</label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">-- None / General Account --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.designation})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Opportunity Details */}
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>2. Opportunity Information *</span>
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Opportunity Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Enterprise Platform Collaboration"
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Associated Showcase Project</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
              >
                <option value="">-- None / General Enterprise Discussion --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Pipeline Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as OpportunityStage)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as OpportunityPriority)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
            </div>

            {/* Financial & Probability */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Estimated Value ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Probability ({probability}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={probability}
                  onChange={(e) => setProbability(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500 mt-2"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Expected Close Date</label>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            {/* Next Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Immediate Next Action</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Schedule architecture review with IT committee"
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Next Action Date</label>
                <input
                  type="datetime-local"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Description & Opportunity Notes</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key drivers, department scope, and partnership goals..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Link
              to="/business-development/opportunities"
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
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  <span>Create Opportunity</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default OpportunityNewPage
