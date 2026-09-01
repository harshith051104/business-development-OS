import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import ContactStatusBadge from '../../components/contacts/ContactStatusBadge'
import DecisionMakerBadge from '../../components/contacts/DecisionMakerBadge'
import PrimaryContactBadge from '../../components/contacts/PrimaryContactBadge'
import ContactStatusModal from '../../components/contacts/ContactStatusModal'
import AddNoteModal from '../../components/organizations/AddNoteModal'
import MeetingStatusBadge from '../../components/meetings/MeetingStatusBadge'
import FollowUpPriorityBadge from '../../components/followups/FollowUpPriorityBadge'
import FollowUpStatusBadge from '../../components/followups/FollowUpStatusBadge'
import AddFollowUpModal from '../../components/followups/AddFollowUpModal'
import { contactsService } from '../../services/contacts'
import { meetingsService } from '../../services/meetings'
import { followupsService } from '../../services/followups'
import { opportunitiesService } from '../../services/opportunities'
import OpportunityStageBadge from '../../components/opportunities/OpportunityStageBadge'
import OpportunityPriorityBadge from '../../components/opportunities/OpportunityPriorityBadge'
import CreateOpportunityModal from '../../components/opportunities/CreateOpportunityModal'
import RelationshipTimeline from '../../components/communications/RelationshipTimeline'
import type { Contact } from '../../types/contact'
import type { Meeting } from '../../types/meeting'
import type { FollowUp } from '../../types/followup'
import type { Opportunity } from '../../types/opportunity'
import {
  User,
  Building2,
  ArrowLeft,
  Edit2,
  GitFork,
  MessageSquare,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Clock,
  RotateCw,
  AlertCircle,
  Award,
  Star,
  Activity,
  CalendarPlus,
  ExternalLink,
  Sparkles,
  Clock3,
  CheckCircle2,
  Target,
  Plus,
  Send,
} from 'lucide-react'

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [contact, setContact] = useState<Contact | null>(null)
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

  const fetchContactData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [contactData, meetingsData, followupsData, oppsData] = await Promise.all([
        contactsService.getContact(id),
        meetingsService.getMeetings({ contact_id: Number(id), page_size: 20 }),
        followupsService.getFollowUps({ contact_id: Number(id), page_size: 20 }),
        opportunitiesService.getOpportunities({ contact_id: Number(id), page_size: 20 }),
      ])
      setContact(contactData)
      setMeetings(meetingsData.items)
      setFollowups(followupsData.items)
      setOpportunities(oppsData.items)
    } catch (err: any) {
      setError(err.detail || err.message || 'Contact not found.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContactData()
  }, [fetchContactData])

  const handleStatusChange = async (newStatus: string, note?: string) => {
    if (!id) return
    try {
      await contactsService.updateStatus(id, newStatus, note)
      fetchContactData()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to update status.')
    }
  }

  const handleAddNote = async (note: string) => {
    if (!id) return
    try {
      await contactsService.addNote(id, note)
      fetchContactData()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to add note.')
    }
  }

  const handleTogglePrimary = async () => {
    if (!contact) return
    try {
      await contactsService.updateContact(contact.id, {
        is_primary_contact: !contact.is_primary_contact,
      })
      fetchContactData()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to update primary contact status.')
    }
  }

  const handleQuickStatus = async (statusVal: string) => {
    if (!contact) return
    try {
      await contactsService.updateStatus(contact.id, statusVal, `Quick-updated to ${statusVal}`)
      fetchContactData()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to update status.')
    }
  }

  const handleCompleteFollowUp = async (folId: number) => {
    try {
      await followupsService.completeFollowUp(folId)
      fetchContactData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link
            to="/business-development/contacts"
            className="hover:text-white flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Contacts Directory</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium truncate">
            {contact?.full_name || 'Loading...'}
          </span>
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-teal-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading contact profile...</p>
          </div>
        ) : error || !contact ? (
          <div className="bg-[#110B2E] border border-rose-500/30 rounded-2xl p-8 text-center space-y-3 shadow-xl">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h2 className="text-base font-bold text-white">Contact Not Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">{error}</p>
            <Link
              to="/business-development/contacts"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-medium"
            >
              Return to Contacts
            </Link>
          </div>
        ) : (
          <>
            {/* ── Contact Header Card ── */}
            <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-lg shadow-teal-600/30 shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      {contact.full_name}
                    </h1>
                    <PrimaryContactBadge isPrimary={contact.is_primary_contact} size="md" />
                    <DecisionMakerBadge isDecisionMaker={contact.is_decision_maker} size="md" />
                    <ContactStatusBadge status={contact.connection_status} size="md" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="font-medium text-slate-300">
                      {contact.designation || 'Healthcare Stakeholder'}
                    </span>
                    {contact.department && (
                      <>
                        <span>·</span>
                        <span className="text-slate-400">{contact.department}</span>
                      </>
                    )}
                    {contact.organization_name && (
                      <>
                        <span>·</span>
                        <Link
                          to={`/business-development/organizations/${contact.organization_id}`}
                          className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{contact.organization_name}</span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                <Link
                  to={`/business-development/outreach?organization_id=${contact.organization_id}&contact_id=${contact.id}`}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Start Outreach</span>
                </Link>

                <Link
                  to={`/business-development/meetings/new?organization_id=${contact.organization_id}&contact_id=${contact.id}`}
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
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition shadow-md shadow-teal-600/25"
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Update Status</span>
                </button>

                <Link
                  to={`/business-development/contacts/${contact.id}/edit`}
                  className="flex items-center space-x-1.5 py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>
              </div>
            </div>

            {/* Quick Relationship Actions Row */}
            <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="font-semibold text-white">Quick Stage Progression:</span>
                <span>Click a stage to fast-advance this relationship</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {['Contacted', 'Connected', 'Interested'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleQuickStatus(st)}
                    disabled={contact.connection_status === st}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                      contact.connection_status === st
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 cursor-default'
                        : 'bg-[#1A1040] hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    Mark {st}
                  </button>
                ))}
                {!contact.is_primary_contact && (
                  <button
                    onClick={handleTogglePrimary}
                    className="px-3 py-1.5 rounded-xl bg-[#1A1040] hover:bg-teal-500/20 text-slate-300 hover:text-teal-300 border border-slate-700 text-xs font-medium transition"
                  >
                    Set as Primary
                  </button>
                )}
              </div>
            </div>

            {/* ── Main Details Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Contact Info, Meetings, Follow-ups, Activity Timeline */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Contact Information Card */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Contact Information</span>
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Email Address</span>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-xs text-teal-300 hover:text-teal-200 flex items-center gap-1.5 truncate"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Phone Number</span>
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-xs text-slate-200 hover:text-white flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{contact.phone}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">LinkedIn Profile</span>
                      {contact.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-teal-300 hover:text-teal-200 flex items-center gap-1.5 truncate"
                        >
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{contact.linkedin_url}</span>
                          <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Location</span>
                      <div className="text-xs text-slate-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{contact.location || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Associated Opportunities Section */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                          Associated Opportunities ({opportunities.length})
                        </h2>
                        <p className="text-xs text-slate-400">
                          Active partnership tracks involving this contact
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
                      No opportunities directly associated with this contact yet.
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
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-3">
                              {opp.estimated_value && (
                                <span className="text-emerald-400 font-mono">
                                  ${opp.estimated_value.toLocaleString()} {opp.currency}
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

                {/* 3. Meetings with Contact */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                          Meetings with Contact
                        </h2>
                        <p className="text-xs text-slate-400">
                          Scheduled presentations & meeting history
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/business-development/meetings/new?organization_id=${contact.organization_id}&contact_id=${contact.id}`}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-medium transition"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Schedule Meeting</span>
                    </Link>
                  </div>

                  {meetings.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                      No meetings recorded with this contact yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {meetings.map((m) => (
                        <div
                          key={m.id}
                          className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                            <div className="text-xs text-slate-400 flex items-center gap-3 font-mono">
                              <span>
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

                {/* 3. Follow-up Tasks with Contact */}
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
                          Action items assigned for this contact
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
                      No follow-ups recorded for this contact yet.
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

                {/* 4. Activity & Connection History Timeline */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>Connection & Activity History</span>
                  </h2>

                  {contact.activities && contact.activities.length > 0 ? (
                    <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                      {contact.activities.map((act) => (
                        <div key={act.id} className="relative group">
                          <div className="absolute -left-6 top-2 w-4 h-4 rounded-full bg-[#1A1040] border border-slate-700 flex items-center justify-center -translate-x-1/2">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          </div>

                          <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800/80 hover:border-slate-700 transition space-y-1">
                            <p className="text-xs font-semibold text-slate-200">{act.description}</p>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(act.created_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {act.performed_by && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-400">{act.performed_by}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic p-4 bg-[#1A1040] rounded-xl border border-slate-800">
                      No connection activities recorded yet.
                    </p>
                  )}
                </div>

                {/* 5. Internal Notes */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Internal Notes</span>
                    </h2>
                    <button
                      onClick={() => setIsNoteModalOpen(true)}
                      className="text-xs text-teal-400 hover:text-teal-300 font-medium"
                    >
                      + Add Note
                    </button>
                  </div>

                  {contact.notes ? (
                    <div className="bg-[#1A1040] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {contact.notes}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No notes recorded yet.</p>
                  )}
                </div>

                {/* Phase 8: Communication History & Timeline */}
                <RelationshipTimeline
                  organizationId={contact.organization_id}
                  organizationName={contact.organization_name || undefined}
                  contactId={contact.id}
                  contactName={contact.full_name}
                  title="Communication History & Outreach Timeline"
                />
              </div>

              {/* Right Column: Connection Timeline Dates & Parent Organization */}
              <div className="space-y-6">
                {/* Parent Organization Card */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>Parent Organization</span>
                  </h2>

                  <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-2">
                    <div className="text-sm font-bold text-white">{contact.organization_name}</div>
                    <Link
                      to={`/business-development/organizations/${contact.organization_id}`}
                      className="inline-flex items-center space-x-1 text-xs text-violet-400 hover:text-violet-300 font-medium"
                    >
                      <span>View Organization Profile</span>
                      <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                    </Link>
                  </div>
                </div>

                {/* Connection Milestones Card */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Relationship Timeline</span>
                  </h2>

                  <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">First Contact Date:</span>
                      <span className="font-mono text-slate-200">
                        {contact.first_contacted_at
                          ? new Date(contact.first_contacted_at).toLocaleDateString()
                          : 'Not yet contacted'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-slate-400">Last Contact Date:</span>
                      <span className="font-mono text-slate-200">
                        {contact.last_contacted_at
                          ? new Date(contact.last_contacted_at).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-slate-400">Next Follow-up:</span>
                      <span className="font-mono text-teal-300">
                        {contact.next_followup_at
                          ? new Date(contact.next_followup_at).toLocaleDateString()
                          : 'None set'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {contact && (
        <>
          <ContactStatusModal
            isOpen={isStatusModalOpen}
            contactName={contact.full_name}
            currentStatus={contact.connection_status}
            onClose={() => setIsStatusModalOpen(false)}
            onConfirm={handleStatusChange}
          />
          <AddNoteModal
            isOpen={isNoteModalOpen}
            organizationName={contact.full_name}
            onClose={() => setIsNoteModalOpen(false)}
            onAddNote={handleAddNote}
          />
          <AddFollowUpModal
            isOpen={isFollowUpModalOpen}
            organizationId={contact.organization_id}
            organizationName={contact.organization_name || undefined}
            contactId={contact.id}
            contactName={contact.full_name}
            onClose={() => setIsFollowUpModalOpen(false)}
            onSuccess={fetchContactData}
          />
          <CreateOpportunityModal
            isOpen={isOppModalOpen}
            organizationId={contact.organization_id}
            organizationName={contact.organization_name || undefined}
            contactId={contact.id}
            contactName={contact.full_name}
            onClose={() => setIsOppModalOpen(false)}
            onSuccess={fetchContactData}
          />
        </>
      )}
    </div>
  )
}
export default ContactDetailPage
