import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { useAuth } from '../../context/AuthContext'
import { partnershipsService } from '../../services/partnerships'
import { organizationsService } from '../../services/organizations'
import { contactsService } from '../../services/contacts'
import { opportunitiesService } from '../../services/opportunities'
import { showcaseService } from '../../services/showcase'
import type { PartnershipType, PartnershipPriority, PartnershipStatus } from '../../types/partnership'
import type { Organization } from '../../types/organization'
import type { Contact } from '../../types/contact'
import type { Opportunity } from '../../types/opportunity'
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
  Calendar,
  Layers,
  FileText,
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

export const PartnershipNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // Entities
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  // Form Fields
  const [name, setName] = useState<string>('')
  const [partnershipType, setPartnershipType] = useState<PartnershipType>('Business Partnership')
  const [status, setStatus] = useState<PartnershipStatus>('Active')
  const [priority, setPriority] = useState<PartnershipPriority>('Medium')
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState<string>('')
  const [objectives, setObjectives] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [nextAction, setNextAction] = useState<string>('')
  const [nextActionDate, setNextActionDate] = useState<string>('')
  const [allowDuplicate, setAllowDuplicate] = useState<boolean>(false)

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Initial Load: Organizations & Projects
  useEffect(() => {
    const initLoad = async () => {
      try {
        const [orgsRes, projRes] = await Promise.all([
          organizationsService.getOrganizations({ page_size: 100 }),
          showcaseService.getProjects({ page_size: 50 }),
        ])
        setOrganizations(orgsRes.items)
        setProjects(projRes.items)

        const paramOrgId = searchParams.get('organization_id')
        const paramContactId = searchParams.get('contact_id')
        const paramOppId = searchParams.get('opportunity_id')
        const paramProjId = searchParams.get('project_id')

        if (paramOrgId) setSelectedOrgId(Number(paramOrgId))
        if (paramProjId) setSelectedProjectId(Number(paramProjId))
        if (paramContactId) setSelectedContactId(Number(paramContactId))
        if (paramOppId) setSelectedOppId(Number(paramOppId))
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }
    initLoad()
  }, [searchParams])

  // Load Contacts and Opportunities when Organization changes
  useEffect(() => {
    if (!selectedOrgId) {
      setContacts([])
      setSelectedContactId(null)
      setOpportunities([])
      setSelectedOppId(null)
      return
    }

    const loadOrgEntities = async () => {
      try {
        const [contactsRes, oppsRes] = await Promise.all([
          contactsService.getContacts({ organization_id: selectedOrgId, page_size: 50 }),
          opportunitiesService.getOpportunities({ organization_id: selectedOrgId, page_size: 50 }),
        ])
        setContacts(contactsRes.items)
        setOpportunities(oppsRes.items)
      } catch (err) {
        console.error('Failed to load org entities:', err)
      }
    }
    loadOrgEntities()
  }, [selectedOrgId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrgId) {
      setError('Please select an organization.')
      return
    }
    if (!name.trim()) {
      setError('Partnership name is required.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const created = await partnershipsService.createPartnership({
        organization_id: selectedOrgId,
        opportunity_id: selectedOppId || undefined,
        primary_contact_id: selectedContactId || undefined,
        project_id: selectedProjectId || undefined,
        name: name.trim(),
        partnership_type: partnershipType,
        status,
        priority,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        objectives: objectives.trim() || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        next_action: nextAction.trim() || undefined,
        next_action_date: nextActionDate ? new Date(nextActionDate).toISOString() : undefined,
        allow_duplicate: allowDuplicate,
      })

      navigate(`/business-development/partnerships/${created.id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to create partnership.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link
            to="/business-development/partnerships"
            className="hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Partnerships Directory</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium">New Partnership</span>
        </div>

        {/* Page Title Header */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <Handshake className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Create New Business Partnership
            </h1>
            <p className="text-xs text-slate-400">
              Establish a structured partnership relationship with a partner account
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            {error.includes('already exists') && (
              <button
                type="button"
                onClick={() => setAllowDuplicate(true)}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-white rounded-lg text-xs font-semibold"
              >
                Allow Duplicate
              </button>
            )}
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          {/* Section 1: Target Account Context */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>1. Partner Account & Relationship Context</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">
                  Target Organization <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={selectedOrgId || ''}
                  onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
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
                <label className="font-semibold text-slate-300">Primary Business Contact</label>
                <select
                  disabled={!selectedOrgId}
                  value={selectedContactId || ''}
                  onChange={(e) => setSelectedContactId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  <option value="">-- General Account (No Contact) --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.designation ? `(${c.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Associated Opportunity (Optional)</label>
                <select
                  disabled={!selectedOrgId}
                  value={selectedOppId || ''}
                  onChange={(e) => setSelectedOppId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  <option value="">-- Direct Partnership (No Prior Opportunity) --</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.name} ({opp.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Showcase Project</label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value="">-- Select Showcase Project --</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Partnership Metadata */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center space-x-2">
              <Handshake className="w-4 h-4" />
              <span>2. Partnership Specifications</span>
            </h2>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-300">
                Partnership Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apollo Company Group AI Integration Alliance"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">
                  Partnership Type <span className="text-rose-400">*</span>
                </label>
                <select
                  value={partnershipType}
                  onChange={(e) => setPartnershipType(e.target.value as PartnershipType)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  {PARTNERSHIP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PartnershipStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value="Active">Active (Standard)</option>
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">End Date (Optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Objectives & Execution */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80 text-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>3. Strategic Objectives & Next Action</span>
            </h2>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Agreed Business Objectives</label>
              <textarea
                rows={3}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="Key goals, milestone commitments, strategic value..."
                className="w-full p-3.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Next Business Action</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Schedule quarterly business review..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Next Action Date</label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Internal BD Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal context, commercial considerations, relationship history..."
                className="w-full p-3.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end space-x-3">
            <Link
              to="/business-development/partnerships"
              className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {loading ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Create Partnership</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default PartnershipNewPage
