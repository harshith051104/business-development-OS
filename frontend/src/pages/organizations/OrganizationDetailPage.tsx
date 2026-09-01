import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import StatusBadge from '../../components/organizations/StatusBadge'
import PriorityBadge from '../../components/organizations/PriorityBadge'
import StatusChangeModal from '../../components/organizations/StatusChangeModal'
import AddNoteModal from '../../components/organizations/AddNoteModal'
import ContactStatusBadge from '../../components/contacts/ContactStatusBadge'
import DecisionMakerBadge from '../../components/contacts/DecisionMakerBadge'
import PrimaryContactBadge from '../../components/contacts/PrimaryContactBadge'
import MeetingStatusBadge from '../../components/meetings/MeetingStatusBadge'
import FollowUpPriorityBadge from '../../components/followups/FollowUpPriorityBadge'
import FollowUpStatusBadge from '../../components/followups/FollowUpStatusBadge'
import AddFollowUpModal from '../../components/followups/AddFollowUpModal'
import { organizationsService } from '../../services/organizations'
import { contactsService } from '../../services/contacts'
import { meetingsService } from '../../services/meetings'
import { followupsService } from '../../services/followups'
import { opportunitiesService } from '../../services/opportunities'
import { partnershipsService } from '../../services/partnerships'
import OpportunityStageBadge from '../../components/opportunities/OpportunityStageBadge'
import OpportunityPriorityBadge from '../../components/opportunities/OpportunityPriorityBadge'
import CreateOpportunityModal from '../../components/opportunities/CreateOpportunityModal'
import PartnershipTypeBadge from '../../components/partnerships/PartnershipTypeBadge'
import PartnershipStatusBadge from '../../components/partnerships/PartnershipStatusBadge'
import RelationshipTimeline from '../../components/communications/RelationshipTimeline'
import type { Organization } from '../../types/organization'
import type { Contact } from '../../types/contact'
import type { Meeting } from '../../types/meeting'
import type { FollowUp } from '../../types/followup'
import type { Opportunity } from '../../types/opportunity'
import type { Partnership } from '../../types/partnership'
import {
  Building2,
  ArrowLeft,
  Edit2,
  GitFork,
  MessageSquare,
  UserPlus,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Layers,
  FileText,
  Clock,
  RotateCw,
  AlertCircle,
  Send,
  Trash2,
  Users,
  ExternalLink,
  ChevronRight,
  Handshake,
  Star,
  Sparkles,
  CalendarPlus,
  Clock3,
  CheckCircle2,
  Target,
  Plus,
} from 'lucide-react'

export const OrganizationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [org, setOrg] = useState<Organization | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false)
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState<boolean>(false)
  const [isOppModalOpen, setIsOppModalOpen] = useState<boolean>(false)
  const [partnerships, setPartnerships] = useState<Partnership[]>([])

  const fetchOrgData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [orgData, contactsData, meetingsData, followupsData, oppsData, partRes] = await Promise.all([
        organizationsService.getOrganization(id),
        contactsService.getOrganizationContacts(id),
        meetingsService.getMeetings({ organization_id: Number(id), page_size: 20 }),
        followupsService.getFollowUps({ organization_id: Number(id), page_size: 20 }),
        opportunitiesService.getOpportunities({ organization_id: Number(id), page_size: 20 }),
        partnershipsService.listPartnerships({ organization_id: Number(id), page_size: 20 }),
      ])
      setOrg(orgData)
      setContacts(contactsData)
      setMeetings(meetingsData.items)
      setFollowups(followupsData.items)
      setOpportunities(oppsData.items)
      setPartnerships(partRes.items)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load organization details.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOrgData()
  }, [fetchOrgData])

  const handleStatusChange = async (newStatus: string, note?: string) => {
    if (!id) return
    try {
      await organizationsService.updateStatus(id, newStatus, note)
      fetchOrgData()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to update status.')
    }
  }

  const handleAddNote = async (note: string) => {
    if (!id) return
    try {
      await organizationsService.addNote(id, note)
      fetchOrgData()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to add note.')
    }
  }

  const handleCompleteFollowUp = async (folId: number) => {
    try {
      await followupsService.completeFollowUp(folId)
      fetchOrgData()
    } catch (err) {
      console.error(err)
    }
  }

  const primaryContact = contacts.find((c) => c.is_primary_contact)

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link
            to="/business-development/organizations"
            className="hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Organizations Directory</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium truncate">{org?.name || 'Loading...'}</span>
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading organization details...</p>
          </div>
        ) : error || !org ? (
          <div className="bg-[#110B2E] border border-rose-500/30 rounded-2xl p-8 text-center space-y-3 shadow-xl">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h2 className="text-base font-bold text-white">Organization Not Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">{error}</p>
            <Link
              to="/business-development/organizations"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium"
            >
              Return to Directory
            </Link>
          </div>
        ) : (
          <>
            {/* ── Organization Header Card ── */}
            <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30 shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      {org.name}
                    </h1>
                    <PriorityBadge priority={org.priority} size="md" />
                    <StatusBadge status={org.status} size="md" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="font-medium text-slate-300">{org.organization_type}</span>
                    {org.city && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {org.city}
                          {org.state ? `, ${org.state}` : ''}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Created{' '}
                      {new Date(org.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                <Link
                  to={`/business-development/outreach?organization_id=${org.id}`}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Start Outreach</span>
                </Link>

                <Link
                  to={`/business-development/meetings/new?organization_id=${org.id}`}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Schedule Meeting</span>
                </Link>

                <button
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition"
                >
                  <Clock3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Follow-up</span>
                </button>

                <Link
                  to="/business-development/showcase"
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Showcase</span>
                </Link>

                <button
                  onClick={() => setIsStatusModalOpen(true)}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition"
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Change Status</span>
                </button>

                <Link
                  to={`/business-development/organizations/${org.id}/edit`}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>
              </div>
            </div>

            {/* ── Main Details Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Contacts, Meetings, Follow-ups, Overview */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Associated Contacts List */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400">
                          Associated Contacts
                        </h2>
                        <p className="text-xs text-slate-400">
                          Key decision makers & stakeholders for this account
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/business-development/contacts/new?organization_id=${org.id}`}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-medium transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Contact</span>
                    </Link>
                  </div>

                  {contacts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#1A1040] border border-slate-800 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        No contacts associated with this organization yet.
                      </p>
                      <Link
                        to={`/business-development/contacts/new?organization_id=${org.id}`}
                        className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add First Contact</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contacts.map((c) => (
                        <Link
                          key={c.id}
                          to={`/business-development/contacts/${c.id}`}
                          className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 hover:border-teal-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-white text-sm group-hover:text-teal-300 transition">
                                {c.full_name}
                              </span>
                              <PrimaryContactBadge isPrimary={c.is_primary_contact} />
                              <DecisionMakerBadge isDecisionMaker={c.is_decision_maker} />
                            </div>
                            <div className="text-xs text-slate-400">
                              <span className="text-slate-300">{c.designation || 'Stakeholder'}</span>
                              {c.department && <span> · {c.department}</span>}
                            </div>
                            {c.email && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                                <Mail className="w-3 h-3 text-slate-600" />
                                <span>{c.email}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                            <ContactStatusBadge status={c.connection_status} size="sm" />
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Business Opportunities Section */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                          Business Opportunities ({opportunities.length})
                        </h2>
                        <p className="text-xs text-slate-400">
                          Active partnership tracks & commercial scope
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsOppModalOpen(true)}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-medium transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Opportunity</span>
                    </button>
                  </div>

                  {opportunities.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                      No business opportunities recorded for this organization yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {opportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/business-development/opportunities/${opp.id}`}
                                className="font-bold text-white text-xs sm:text-sm hover:text-violet-300 transition"
                              >
                                {opp.name}
                              </Link>
                              <OpportunityStageBadge stage={opp.stage} size="sm" />
                              <OpportunityPriorityBadge priority={opp.priority} size="sm" />
                              {opp.estimated_value && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[10px] font-mono border border-emerald-500/20">
                                  ${opp.estimated_value.toLocaleString()} {opp.currency}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                              {opp.project_title && (
                                <span className="text-violet-300 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-violet-400" />
                                  <span>{opp.project_title}</span>
                                </span>
                              )}
                              {opp.next_action && (
                                <span className="text-slate-300">Next: {opp.next_action}</span>
                              )}
                            </div>
                          </div>

                          <Link
                            to={`/business-development/opportunities/${opp.id}`}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium self-end sm:self-center transition"
                          >
                            Details
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2.5 Partnerships Section */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Handshake className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                          Active Partnerships
                        </h2>
                        <p className="text-xs text-slate-400">
                          Formal business alliances & strategic agreements
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/business-development/partnerships/new?organization_id=${org.id}`}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-violet-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Partnership</span>
                    </Link>
                  </div>

                  {partnerships.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 italic">
                      No partnerships established for this organization yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {partnerships.map((p) => (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-2 hover:border-violet-500/40 transition flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={`/business-development/partnerships/${p.id}`}
                                className="font-bold text-white hover:text-violet-300 transition text-xs block truncate"
                              >
                                {p.name}
                              </Link>
                              <PartnershipStatusBadge status={p.status} size="sm" />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <PartnershipTypeBadge type={p.partnership_type} size="sm" />
                              <PriorityBadge priority={p.priority} size="sm" />
                            </div>
                            {p.next_action && (
                              <div className="text-[11px] text-slate-300">
                                <span className="text-slate-500">Next:</span> {p.next_action}
                              </div>
                            )}
                          </div>
                          <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                            <Link
                              to={`/business-development/partnerships/${p.id}`}
                              className="text-xs text-violet-400 hover:text-white font-semibold"
                            >
                              View Partnership →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Business Meetings Section */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                          Business Meetings
                        </h2>
                        <p className="text-xs text-slate-400">
                          Scheduled presentations & meeting history
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/business-development/meetings/new?organization_id=${org.id}`}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-medium transition"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Schedule Meeting</span>
                    </Link>
                  </div>

                  {meetings.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                      No business meetings logged with this organization yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {meetings.map((m) => (
                        <div
                          key={m.id}
                          className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Link
                                to={`/business-development/meetings/${m.id}`}
                                className="font-bold text-white text-xs sm:text-sm hover:text-violet-300 transition"
                              >
                                {m.title}
                              </Link>
                              <MeetingStatusBadge status={m.status} size="sm" />
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-3">
                              <span className="font-mono text-slate-300">
                                {new Date(m.scheduled_at).toLocaleDateString()} at{' '}
                                {new Date(m.scheduled_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span>·</span>
                              <span>{m.meeting_type}</span>
                            </div>
                          </div>

                          <Link
                            to={`/business-development/meetings/${m.id}`}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium self-end sm:self-center transition"
                          >
                            Details
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Follow-up Tasks Section */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock3 className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400">
                          Follow-up Tasks
                        </h2>
                        <p className="text-xs text-slate-400">
                          Outreach action items and timeline milestones
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsFollowUpModalOpen(true)}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
                    >
                      <Clock3 className="w-3.5 h-3.5" />
                      <span>Add Follow-up</span>
                    </button>
                  </div>

                  {followups.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                      No follow-ups recorded for this organization yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {followups.map((f) => (
                        <div
                          key={f.id}
                          className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-xs font-bold ${
                                  f.status === 'Completed'
                                    ? 'line-through text-slate-400'
                                    : 'text-white'
                                }`}
                              >
                                {f.title}
                              </span>
                              <FollowUpPriorityBadge priority={f.priority} size="sm" />
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Due: {f.timing_label}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {f.status === 'Pending' ? (
                              <button
                                onClick={() => handleCompleteFollowUp(f.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Done</span>
                              </button>
                            ) : (
                              <FollowUpStatusBadge status="Completed" size="sm" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Organization Overview & Details */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>Organization Overview</span>
                  </h2>

                  {org.description ? (
                    <p className="text-xs text-slate-300 leading-relaxed bg-[#1A1040] p-4 rounded-xl border border-slate-800">
                      {org.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No description provided yet.</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Website</span>
                      {org.website ? (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 truncate"
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{org.website}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Official Email</span>
                      {org.email ? (
                        <a
                          href={`mailto:${org.email}`}
                          className="text-xs text-slate-200 hover:text-white flex items-center gap-1.5 truncate"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{org.email}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Official Phone</span>
                      {org.phone ? (
                        <div className="text-xs text-slate-200 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{org.phone}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Facility Size</span>
                      <div className="text-xs text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{org.size || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4b. Location Map */}
                {(org.address || org.city || org.country || org.latitude) && (
                  <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>Location</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {org.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                          <span className="text-slate-300">{org.address}</span>
                        </div>
                      )}
                      {org.city && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                          <span className="text-slate-300">{org.city}{org.state ? `, ${org.state}` : ''}</span>
                        </div>
                      )}
                      {org.country && (
                        <div className="flex items-start gap-2">
                          <Globe className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                          <span className="text-slate-300">{org.country}</span>
                        </div>
                      )}
                      {org.latitude && org.longitude && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500 font-mono text-[10px]">GPS</span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {org.latitude.toFixed(4)}, {org.longitude.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                    {org.latitude && org.longitude ? (
                      <div className="rounded-xl overflow-hidden border border-slate-700">
                        <iframe
                          title="Organization Location"
                          width="100%"
                          height="250"
                          frameBorder="0"
                          scrolling="no"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${org.longitude - 0.01},${org.latitude - 0.01},${org.longitude + 0.01},${org.latitude + 0.01}&layer=mapnik&marker=${org.latitude},${org.longitude}`}
                          className="grayscale hover:grayscale-0 transition-all duration-300"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500 text-xs">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Location coordinates unavailable
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Internal BD Notes */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Internal BD Notes</span>
                    </h2>
                    <button
                      onClick={() => setIsNoteModalOpen(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      + Add Note
                    </button>
                  </div>

                  {org.notes ? (
                    <div className="bg-[#1A1040] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed space-y-2">
                      {org.notes}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-[#1A1040]/40 border border-slate-800/80 text-center text-xs text-slate-500">
                      No internal notes recorded yet.
                    </div>
                  )}
                </div>

                {/* Phase 8: Communication History & Timeline */}
                <RelationshipTimeline
                  organizationId={org.id}
                  organizationName={org.name}
                  contactId={primaryContact?.id}
                  contactName={primaryContact?.full_name}
                  title="Communication History & Relationship Timeline"
                />
              </div>

              {/* Right Column: Primary Contact & Connection Status */}
              <div className="space-y-6">
                {/* Primary Contact Card */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400 flex items-center gap-2">
                    <Star className="w-4 h-4 fill-current text-teal-400" />
                    <span>Primary Contact</span>
                  </h2>

                  {primaryContact ? (
                    <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-2">
                      <div className="font-bold text-white text-sm">{primaryContact.full_name}</div>
                      <div className="text-xs text-slate-300">{primaryContact.designation}</div>
                      {primaryContact.email && (
                        <div className="text-xs text-slate-400 font-mono pt-1">{primaryContact.email}</div>
                      )}
                      <Link
                        to={`/business-development/contacts/${primaryContact.id}`}
                        className="inline-flex items-center space-x-1 text-xs text-teal-400 hover:text-teal-300 font-medium pt-1"
                      >
                        <span>View Contact Profile</span>
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                      </Link>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-center text-xs text-slate-500">
                      No primary contact designated yet.
                    </div>
                  )}
                </div>

                {/* Connection Stage Card */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400 flex items-center gap-2">
                    <GitFork className="w-4 h-4" />
                    <span>Outreach Stage</span>
                  </h2>

                  <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Pipeline Stage</span>
                      <StatusBadge status={org.status} size="md" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-xs text-slate-400 font-medium">BD Priority</span>
                      <PriorityBadge priority={org.priority} size="md" />
                    </div>

                    <button
                      onClick={() => setIsStatusModalOpen(true)}
                      className="w-full mt-2 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition"
                    >
                      Advance Pipeline Stage
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {org && (
        <>
          <StatusChangeModal
            isOpen={isStatusModalOpen}
            organizationName={org.name}
            currentStatus={org.status}
            onClose={() => setIsStatusModalOpen(false)}
            onConfirm={handleStatusChange}
          />
          <AddNoteModal
            isOpen={isNoteModalOpen}
            organizationName={org.name}
            onClose={() => setIsNoteModalOpen(false)}
            onAddNote={handleAddNote}
          />
          <AddFollowUpModal
            isOpen={isFollowUpModalOpen}
            organizationId={org.id}
            organizationName={org.name}
            contactId={primaryContact?.id}
            contactName={primaryContact?.full_name}
            onClose={() => setIsFollowUpModalOpen(false)}
            onSuccess={fetchOrgData}
          />
          <CreateOpportunityModal
            isOpen={isOppModalOpen}
            organizationId={org.id}
            organizationName={org.name}
            contactId={primaryContact?.id}
            contactName={primaryContact?.full_name}
            onClose={() => setIsOppModalOpen(false)}
            onSuccess={fetchOrgData}
          />
        </>
      )}
    </div>
  )
}
export default OrganizationDetailPage
