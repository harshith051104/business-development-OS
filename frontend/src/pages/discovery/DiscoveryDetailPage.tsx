import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { discoveryService } from '../../services/discovery'
import type { DiscoveredOrganization, DiscoveredContact } from '../../types/discovery'
import OrganizationTypeBadge from '../../components/organizations/OrganizationTypeBadge'
import {
  Compass,
  ArrowLeft,
  Building2,
  MapPin,
  Globe,
  Mail,
  Phone,
  Bookmark,
  Ban,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Award,
  Users,
  Search,
  UserCheck,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react'

const AVAILABLE_LEADERSHIP_ROLES = [
  'CEO',
  'CTO',
  'CDO',
  'CIO',
  'VP of Sales',
  'Head of Business Development',
  'Head of Innovation',
  'Head of Partnerships',
]

export const DiscoveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [item, setItem] = useState<DiscoveredOrganization | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Qualification State
  const [fit, setFit] = useState<string>('Medium')
  const [reason, setReason] = useState<string>('')
  const [qualifying, setQualifying] = useState<boolean>(false)
  const [qualifySuccess, setQualifySuccess] = useState<boolean>(false)

  // Decision-Maker Discovery State
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    'CEO',
    'CTO',
    'CDO',
    'CIO',
    'Head of Business Development',
    'Head of Innovation',
  ])
  const [contacts, setContacts] = useState<DiscoveredContact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const [searchingContacts, setSearchingContacts] = useState<boolean>(false)
  const [enrichingContactId, setEnrichingContactId] = useState<number | null>(null)

  // Add to ELLY CRM State
  const [priority, setPriority] = useState<string>('High')
  const [adding, setAdding] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await discoveryService.getById(Number(id))
        setItem(data)
        if (data.potential_fit) setFit(data.potential_fit)
        if (data.qualification_reason) setReason(data.qualification_reason)
        if (data.contacts && data.contacts.length > 0) {
          setContacts(data.contacts)
          setSelectedContactIds(data.contacts.map((c) => c.id))
        }
      } catch (err: any) {
        setError(err.detail || err.message || 'Failed to load discovery details.')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [id])

  // Auto dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const handleDiscoverContacts = async () => {
    if (!item) return
    setSearchingContacts(true)
    try {
      const discovered = await discoveryService.discoverContacts(item.id, {
        target_roles: selectedRoles,
        limit: 10,
      })
      setContacts(discovered)
      setSelectedContactIds(discovered.map((c) => c.id))
      setToastMessage(`Discovered ${discovered.length} decision-maker contacts.`)
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to discover decision-makers.')
    } finally {
      setSearchingContacts(false)
    }
  }

  const handleEnrichContact = async (contactId: number) => {
    if (!item) return
    setEnrichingContactId(contactId)
    try {
      const enriched = await discoveryService.enrichContact(item.id, contactId)
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? enriched : c))
      )
      setToastMessage(`Enriched email for ${enriched.full_name}`)
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to enrich contact email.')
    } finally {
      setEnrichingContactId(null)
    }
  }

  const toggleContactSelection = (contactId: number) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((cid) => cid !== contactId) : [...prev, contactId]
    )
  }

  const handleQualify = async () => {
    if (!item) return
    setQualifying(true)
    try {
      const updated = await discoveryService.qualify(item.id, {
        potential_fit: fit,
        qualification_reason: reason,
      })
      setItem(updated)
      setQualifySuccess(true)
      setToastMessage('Qualification details saved.')
      setTimeout(() => setQualifySuccess(false), 3000)
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to save qualification.')
    } finally {
      setQualifying(false)
    }
  }

  const handleAddToOrganizations = async () => {
    if (!item) return
    setAdding(true)
    try {
      const org = await discoveryService.addToOrganizations(item.id, {
        priority,
        notes: reason || `Sourced via AI B2B Discovery (${item.source_name})`,
        allow_duplicate: true,
        selected_contact_ids: selectedContactIds,
      })
      navigate(`/business-development/organizations/${org.id}`)
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to add organization.')
      setAdding(false)
    }
  }

  const handleSave = async () => {
    if (!item) return
    try {
      const updated = await discoveryService.save(item.id)
      setItem(updated)
      setToastMessage('Lead saved to bookmarks.')
    } catch (err) {
      alert('Failed to save discovery.')
    }
  }

  const handleSkip = async () => {
    if (!item) return
    try {
      const updated = await discoveryService.skip(item.id)
      setItem(updated)
      setToastMessage('Lead dismissed.')
    } catch (err) {
      alert('Failed to skip discovery.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/business-development/discover')}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">
              Review Discovered Organization & Executive Decision-Makers
            </h1>
            <p className="text-[11px] text-slate-400">
              Evaluate AI fit reasoning, discover decision-makers, and import to ELLY CRM
            </p>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#110B2E] border border-emerald-500/40 text-emerald-300 shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading discovery profile...</p>
          </div>
        ) : error || !item ? (
          <div className="p-12 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <h3 className="text-sm font-bold text-white">Discovery Record Not Found</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <Link
              to="/business-development/discover"
              className="inline-block px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Back to Discover
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Duplicate Notice Banner */}
            {item.is_existing_duplicate && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold">Organization Already in ELLY CRM:</span>
                    <span className="ml-1 text-slate-300">
                      An account matching &quot;{item.existing_org_name}&quot; already exists.
                    </span>
                  </div>
                </div>
                {item.existing_org_id && (
                  <Link
                    to={`/business-development/organizations/${item.existing_org_id}`}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-xs transition shrink-0 ml-4"
                  >
                    Open Existing
                  </Link>
                )}
              </div>
            )}

            {/* Top Profile Card */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <OrganizationTypeBadge type={item.organization_type} size="md" />
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      Status: {item.status}
                    </span>
                    {item.potential_fit && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          item.potential_fit === 'High'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : item.potential_fit === 'Medium'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-500/10 text-slate-300 border border-slate-500/30'
                        }`}
                      >
                        Fit: {item.potential_fit} {item.potential_fit_score ? `(${item.potential_fit_score}%)` : ''}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{item.name}</h2>
                  {(item.address || item.city || item.state || item.country) && (
                    <div className="flex items-start space-x-1.5 text-xs text-slate-400">
                      <MapPin className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <span>{item.address || [item.city, item.state, item.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Status Quick Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  {item.status !== 'saved' && (
                    <button
                      onClick={handleSave}
                      className="py-2 px-3 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-700"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  )}
                  {item.status !== 'skipped' && (
                    <button
                      onClick={handleSkip}
                      className="py-2 px-3 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-rose-300 text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-700"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Skip</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Explainable Fit Reasoning Card */}
              {item.qualification_reason && (
                <div className="p-4 rounded-2xl bg-[#1A1040] border border-violet-500/30 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-violet-400 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span>AI Fit Reasoning & Strategic Alignment</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {item.qualification_reason}
                  </p>
                </div>
              )}

              {/* Public Contact and Overview Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span>Website</span>
                  </div>
                  {item.website ? (
                    <a
                      href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-violet-400 hover:underline truncate block"
                    >
                      {item.website}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">Not available</span>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Email</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-200 block truncate">
                    {item.email || 'Not available'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Phone</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-200 block truncate">
                    {item.phone || 'Not available'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Executive Decision-Maker Discovery Studio ── */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Executive Decision-Maker Discovery
                    </h3>
                    <p className="text-xs text-slate-400">
                      Find key leadership stakeholders responsible for technology, innovation, and strategic partnerships
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDiscoverContacts}
                  disabled={searchingContacts}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30 transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {searchingContacts ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{contacts.length > 0 ? 'Re-Discover Contacts' : 'Find Decision Makers'}</span>
                </button>
              </div>

              {/* Target Roles Filter Pills */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Target Executive Roles
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LEADERSHIP_ROLES.map((r) => {
                    const isSelected = selectedRoles.includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm'
                            : 'bg-[#1A1040] text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {isSelected && <span className="mr-1">✓</span>}
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Discovered Contacts Roster */}
              {contacts.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {contacts.length} Decision Makers Found ·{' '}
                      <span className="text-teal-300 font-bold">{selectedContactIds.length} Selected for CRM</span>
                    </span>
                    <button
                      onClick={() =>
                        setSelectedContactIds(
                          selectedContactIds.length === contacts.length
                            ? []
                            : contacts.map((c) => c.id)
                        )
                      }
                      className="text-teal-400 hover:underline text-xs"
                    >
                      {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contacts.map((contact) => {
                      const isSelected = selectedContactIds.includes(contact.id)
                      const isEnriching = enrichingContactId === contact.id

                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleContactSelection(contact.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                            isSelected
                              ? 'bg-[#1A1040] border-teal-500/50 ring-1 ring-teal-500/30'
                              : 'bg-[#110B2E] border-slate-800/90 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start space-x-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="mt-1 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-0"
                              />
                              <div>
                                <div className="text-xs font-bold text-white">{contact.full_name}</div>
                                <div className="text-[11px] text-teal-300 font-medium">{contact.job_title}</div>
                                <div className="text-[10px] text-slate-500">{contact.department || 'Executive Leadership'}</div>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                contact.fit_level === 'High'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              Fit: {contact.fit_level}
                            </span>
                          </div>

                          {/* Contact Fit Reason */}
                          {contact.fit_reason && (
                            <p className="text-[11px] text-slate-300 bg-[#110B2E] p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                              {contact.fit_reason}
                            </p>
                          )}

                          {/* Email & Enrichment Action */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                            <div className="flex items-center space-x-1.5 text-[11px] truncate text-slate-300">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{contact.email || 'Email unverified'}</span>
                            </div>

                            {contact.email_status !== 'enriched' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEnrichContact(contact.id)
                                }}
                                disabled={isEnriching}
                                className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-[10px] font-bold border border-teal-500/30 transition flex items-center space-x-1 shrink-0 ml-2"
                              >
                                {isEnriching ? (
                                  <RotateCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Zap className="w-3 h-3 text-amber-400" />
                                )}
                                <span>Enrich Email</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Add to Pipeline Action Card ── */}
            <div className="bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border border-violet-500/30 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-violet-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Ready for Connection Funnel</span>
                </div>
                <h4 className="text-base font-bold text-white">Add Organization & Contacts to ELLY CRM</h4>
                <p className="text-xs text-slate-300">
                  Converts this discovered lead and {selectedContactIds.length} decision makers into ELLY CRM records with stage <strong className="text-white">Potential</strong>.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs font-semibold focus:outline-none"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>

                <button
                  onClick={handleAddToOrganizations}
                  disabled={adding}
                  className="py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-violet-600/30 disabled:opacity-50"
                >
                  {adding ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add to ELLY CRM</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
export default DiscoveryDetailPage
