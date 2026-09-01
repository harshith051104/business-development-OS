import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { useAuth } from '../../context/AuthContext'
import { outreachService } from '../../services/outreach'
import { organizationsService } from '../../services/organizations'
import { contactsService } from '../../services/contacts'
import { opportunitiesService } from '../../services/opportunities'
import { showcaseService } from '../../services/showcase'
import { gmailService } from '../../services/gmail'
import { api } from '../../services/api'
import type { GmailStatus } from '../../services/gmail'
import type {
  OutreachDraft,
  OutreachTemplate,
  OutreachChannelType,
} from '../../types/outreach'
import type { Organization } from '../../types/organization'
import type { Contact } from '../../types/contact'
import type { Opportunity } from '../../types/opportunity'
import type { Project } from '../../types/project'
import OrganizationTypeBadge from '../../components/organizations/OrganizationTypeBadge'
import {
  Send,
  Building2,
  Users,
  Target,
  Sparkles,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  RotateCw,
  AlertCircle,
  FileText,
  Clock3,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
} from 'lucide-react'

const CHANNELS: { type: OutreachChannelType; label: string; icon: any }[] = [
  { type: 'Email', label: 'Email', icon: Mail },
  { type: 'Phone', label: 'Phone', icon: Phone },
  { type: 'LinkedIn', label: 'LinkedIn', icon: Globe },
  { type: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
  { type: 'Other', label: 'Other', icon: Send },
]

export const OutreachWorkspacePage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Entities state
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  // Templates
  const [templates, setTemplates] = useState<OutreachTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)

  // Editor State
  const [channel, setChannel] = useState<OutreachChannelType>('Email')
  const [subject, setSubject] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [callPurpose, setCallPurpose] = useState<string>('')
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)

  // Execution Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false)
  const [recordSummary, setRecordSummary] = useState<string>('')
  const [recordNotes, setRecordNotes] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<boolean>(true)
  const [newStatus, setNewStatus] = useState<string>('Contacted')
  const [createFollowup, setCreateFollowup] = useState<boolean>(true)
  const [followupTitle, setFollowupTitle] = useState<string>('')
  const [followupDueDays, setFollowupDueDays] = useState<number>(3)
  const [followupPriority, setFollowupPriority] = useState<string>('Medium')

  // Feedback State
  const [loading, setLoading] = useState<boolean>(false)
  const [savingDraft, setSavingDraft] = useState<boolean>(false)
  const [recording, setRecording] = useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Mode State: Manual vs AI Generated
  const [workspaceMode, setWorkspaceMode] = useState<'manual' | 'ai'>('manual')
  const [personalizationScore, setPersonalizationScore] = useState<number | null>(null)
  const [generatingAI, setGeneratingAI] = useState<boolean>(false)

  // Gmail State
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [sendingViaGmail, setSendingViaGmail] = useState<boolean>(false)

  const handleGenerateAIDraft = async () => {
    if (!selectedContactId) {
      setFeedbackMsg({ type: 'error', text: 'Please select an organization and target contact first.' })
      return
    }
    setGeneratingAI(true)
    setFeedbackMsg(null)
    try {
      const res = await api.post<any>(
        `/business-development/outreach/generate-ai-draft?contact_id=${selectedContactId}${
          selectedProjectId ? `&project_id=${selectedProjectId}` : ''
        }`
      )
      if (res.subject) setSubject(res.subject)
      if (res.body_plain) setMessage(res.body_plain)
      if (res.personalization_score !== undefined) setPersonalizationScore(res.personalization_score)
      setFeedbackMsg({
        type: 'success',
        text: `AI personalized pitch generated! Personalization Score: ${res.personalization_score.toFixed(0)}/100.`,
      })
    } catch (err: any) {
      console.error(err)
      setFeedbackMsg({ type: 'error', text: 'Failed to generate AI draft.' })
    } finally {
      setGeneratingAI(false)
    }
  }

  // Initial Load: Organizations, Projects, Templates, Gmail Status
  useEffect(() => {
    const initLoad = async () => {
      try {
        const [orgsRes, projRes, tplRes, gmailSt] = await Promise.all([
          organizationsService.getOrganizations({ page_size: 100 }),
          showcaseService.getProjects({ page_size: 50 }),
          outreachService.listTemplates({ active_only: true }),
          gmailService.getStatus().catch(() => ({ connected: false, sender_email: '', message: 'Gmail not available' })),
        ])
        setOrganizations(orgsRes.items)
        setProjects(projRes.items)
        setTemplates(tplRes)
        setGmailStatus(gmailSt)

        // Check URL params
        const paramOrgId = searchParams.get('organization_id')
        const paramContactId = searchParams.get('contact_id')
        const paramOppId = searchParams.get('opportunity_id')
        const paramProjId = searchParams.get('project_id')
        const paramDraftId = searchParams.get('draft_id')

        if (paramOrgId) {
          setSelectedOrgId(Number(paramOrgId))
        }
        if (paramProjId) {
          setSelectedProjectId(Number(paramProjId))
        }

        if (paramDraftId) {
          const draft = await outreachService.getDraft(Number(paramDraftId))
          setCurrentDraftId(draft.id)
          setSelectedOrgId(draft.organization_id)
          if (draft.contact_id) setSelectedContactId(draft.contact_id)
          if (draft.opportunity_id) setSelectedOppId(draft.opportunity_id)
          if (draft.project_id) setSelectedProjectId(draft.project_id)
          if (draft.channel) setChannel(draft.channel)
          if (draft.subject) setSubject(draft.subject)
          if (draft.message) setMessage(draft.message)
          if (draft.call_purpose) setCallPurpose(draft.call_purpose)
        } else if (paramContactId) {
          setSelectedContactId(Number(paramContactId))
        }
        if (paramOppId) {
          setSelectedOppId(Number(paramOppId))
        }
      } catch (err) {
        console.error('Failed to initialize outreach workspace:', err)
      }
    }
    initLoad()
  }, [searchParams])

  // Load Contacts & Opportunities when Org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setSelectedOrg(null)
      setContacts([])
      setSelectedContactId(null)
      setOpportunities([])
      setSelectedOppId(null)
      return
    }

    const loadOrgDetails = async () => {
      try {
        const [org, contactsRes, oppsRes] = await Promise.all([
          organizationsService.getOrganization(selectedOrgId),
          contactsService.getContacts({ organization_id: selectedOrgId, page_size: 50 }),
          opportunitiesService.getOpportunities({ organization_id: selectedOrgId, page_size: 50 }),
        ])
        setSelectedOrg(org)
        setContacts(contactsRes.items)
        setOpportunities(oppsRes.items)
      } catch (err) {
        console.error('Failed to load org details:', err)
      }
    }
    loadOrgDetails()
  }, [selectedOrgId])

  // Track selected contact object
  useEffect(() => {
    if (selectedContactId && contacts.length > 0) {
      const c = contacts.find((item) => item.id === selectedContactId) || null
      setSelectedContact(c)
    } else {
      setSelectedContact(null)
    }
  }, [selectedContactId, contacts])

  // Apply template with token replacement
  const handleApplyTemplate = (tplId: number) => {
    setSelectedTemplateId(tplId)
    const tpl = templates.find((t) => t.id === tplId)
    if (!tpl) return

    const contactName = selectedContact ? selectedContact.full_name : '[Contact Name]'
    const orgName = selectedOrg ? selectedOrg.name : '[Organization Name]'
    const selectedProj = projects.find((p) => p.id === selectedProjectId)
    const projName = selectedProj ? selectedProj.name : 'ELLY Healthcare Platform'
    const senderName = user?.name || 'Business Development Team'

    const replaceTokens = (text: string) =>
      text
        .replace(/{{contact_name}}/g, contactName)
        .replace(/{{organization_name}}/g, orgName)
        .replace(/{{project_name}}/g, projName)
        .replace(/{{sender_name}}/g, senderName)

    if (tpl.subject) {
      setSubject(replaceTokens(tpl.subject))
    }
    if (tpl.body) {
      setMessage(replaceTokens(tpl.body))
    }
    if (tpl.channel) {
      setChannel(tpl.channel)
    }
  }

  // Save Draft
  const handleSaveDraft = async () => {
    if (!selectedOrgId) {
      alert('Please select an organization before saving draft.')
      return
    }
    setSavingDraft(true)
    setFeedbackMsg(null)
    try {
      const payload: Partial<OutreachDraft> = {
        organization_id: selectedOrgId,
        contact_id: selectedContactId || undefined,
        opportunity_id: selectedOppId || undefined,
        project_id: selectedProjectId || undefined,
        channel,
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
        call_purpose: callPurpose.trim() || undefined,
        status: 'Draft',
      }

      if (currentDraftId) {
        await outreachService.updateDraft(currentDraftId, payload)
        setFeedbackMsg({ type: 'success', text: 'Draft updated successfully.' })
      } else {
        const created = await outreachService.createDraft(payload)
        setCurrentDraftId(created.id)
        setFeedbackMsg({ type: 'success', text: 'New draft saved successfully.' })
      }
      setTimeout(() => setFeedbackMsg(null), 3000)
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.detail || 'Failed to save draft.' })
    } finally {
      setSavingDraft(false)
    }
  }

  // Open Channel External Client
  const handleOpenClient = () => {
    if (channel === 'Email') {
      const emailTo = selectedContact?.email || ''
      const safeMailto = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(message)}`
      window.location.href = safeMailto
    } else if (channel === 'Phone') {
      const phoneNum = selectedContact?.phone || ''
      if (phoneNum) {
        window.location.href = `tel:${encodeURIComponent(phoneNum)}`
      } else {
        alert('Selected contact does not have a phone number.')
      }
    } else if (channel === 'LinkedIn') {
      const linkedin = selectedContact?.linkedin_url
      if (linkedin) {
        const safeUrl = linkedin.startsWith('http') ? linkedin : `https://${linkedin}`
        window.open(safeUrl, '_blank', 'noopener,noreferrer')
      } else {
        alert('Selected contact does not have a LinkedIn profile URL.')
      }
    } else if (channel === 'WhatsApp') {
      const phoneNum = (selectedContact?.phone || '').replace(/[^0-9]/g, '')
      if (phoneNum) {
        const safeWa = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`
        window.open(safeWa, '_blank', 'noopener,noreferrer')
      } else {
        alert('Selected contact does not have a valid phone number for WhatsApp.')
      }
    }
  }

  // Send via Gmail API
  const handleSendViaGmail = async () => {
    if (!selectedContact?.email) {
      alert('Selected contact does not have an email address.')
      return
    }
    if (!subject.trim()) {
      alert('Please enter a subject line.')
      return
    }
    if (!message.trim()) {
      alert('Please enter a message.')
      return
    }

    setSendingViaGmail(true)
    try {
      const result = await gmailService.sendEmail({
        to: selectedContact.email,
        subject: subject.trim(),
        body: message.trim(),
      })

      if (result.success) {
        // Auto-record the communication
        if (selectedOrgId) {
          try {
            await outreachService.recordAction({
              draft_id: currentDraftId || undefined,
              organization_id: selectedOrgId,
              contact_id: selectedContactId || undefined,
              opportunity_id: selectedOppId || undefined,
              channel: 'Email',
              direction: 'Outgoing',
              subject: subject.trim(),
              summary: `Email sent via Gmail: ${subject.trim()}`,
              notes: message.trim(),
              update_organization_status: true,
              new_organization_status: 'Contacted',
            })
          } catch {
            // Communication recording is best-effort
          }
        }

        setFeedbackMsg({
          type: 'success',
          text: `Email sent successfully to ${selectedContact.email}${result.thread_id ? ' (threaded)' : ''}`,
        })
        setTimeout(() => setFeedbackMsg(null), 5000)
      } else {
        setFeedbackMsg({
          type: 'error',
          text: result.error || 'Failed to send email via Gmail.',
        })
        setTimeout(() => setFeedbackMsg(null), 5000)
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.detail || err.message || 'Failed to send email via Gmail.',
      })
    } finally {
      setSendingViaGmail(false)
    }
  }

  // Open Record Communication Modal
  const handleOpenRecordModal = () => {
    if (!selectedOrgId) {
      alert('Please select an organization to record communication.')
      return
    }
    const defaultSummary = subject
      ? subject
      : `${channel} outreach to ${selectedContact ? selectedContact.full_name : selectedOrg?.name}`
    setRecordSummary(defaultSummary)
    setRecordNotes(message)
    setFollowupTitle(`Follow up with ${selectedContact ? selectedContact.full_name : selectedOrg?.name}`)
    setIsRecordModalOpen(true)
  }

  // Execute Record Action
  const handleExecuteRecord = async () => {
    if (!selectedOrgId || !recordSummary.trim()) return
    setRecording(true)
    try {
      const dueAt = new Date()
      dueAt.setDate(dueAt.getDate() + followupDueDays)

      const res = await outreachService.recordAction({
        draft_id: currentDraftId || undefined,
        organization_id: selectedOrgId,
        contact_id: selectedContactId || undefined,
        opportunity_id: selectedOppId || undefined,
        channel,
        direction: 'Outgoing',
        subject: subject || recordSummary,
        summary: recordSummary.trim(),
        notes: recordNotes.trim() || undefined,
        update_organization_status: updateStatus,
        new_organization_status: newStatus,
        create_followup: createFollowup,
        followup_title: followupTitle.trim(),
        followup_due_at: dueAt.toISOString(),
        followup_priority: followupPriority,
      })

      setIsRecordModalOpen(false)
      setFeedbackMsg({
        type: 'success',
        text: `Communication recorded successfully! ${
          res.organization_status_updated ? `Organization status moved to ${res.new_organization_status}.` : ''
        }`,
      })

      // Reset editor or navigate
      setTimeout(() => {
        navigate('/business-development/communications')
      }, 1500)
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to record communication.')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Header ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-600/30">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Business Development Outreach Workspace
            </h1>
            <p className="text-xs text-slate-400">
              Prepare, review, and execute manual multichannel outreach to prospective partners
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Gmail Status Badge */}
          <Link
            to="/business-development/gmail-setup"
            className={`inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl border text-xs font-semibold transition ${
              gmailStatus?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{gmailStatus?.connected ? `Gmail: ${gmailStatus.sender_email}` : 'Connect Gmail'}</span>
          </Link>

          <Link
            to="/business-development/outreach/drafts"
            className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <Bookmark className="w-3.5 h-3.5 text-violet-400" />
            <span>View Saved Drafts</span>
          </Link>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center space-x-2 animate-in fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Column: Target Context Selectors (4 cols) ── */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. Target Organization */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-violet-400" />
                <span>1. Select Organization</span>
              </label>

              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-violet-500"
              >
                <option value="">-- Choose Target Organization --</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.organization_type})
                  </option>
                ))}
              </select>

              {selectedOrg && (
                <div className="p-3 rounded-xl bg-[#1A1040]/70 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <OrganizationTypeBadge type={selectedOrg.organization_type} size="sm" />
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                      Status: {selectedOrg.status}
                    </span>
                  </div>
                  {selectedOrg.city && (
                    <div className="text-slate-400 text-[11px] truncate">
                      Location: {[selectedOrg.city, selectedOrg.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Target Contact */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>2. Select Contact</span>
                </label>
                {selectedOrgId && (
                  <Link
                    to={`/business-development/contacts/new?organization_id=${selectedOrgId}`}
                    className="text-[11px] text-violet-400 hover:text-white underline"
                  >
                    + Add Contact
                  </Link>
                )}
              </div>

              {!selectedOrgId ? (
                <p className="text-xs text-slate-500 italic">Select an organization first.</p>
              ) : contacts.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  No contacts found for this account.
                </div>
              ) : (
                <select
                  value={selectedContactId || ''}
                  onChange={(e) => setSelectedContactId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-violet-500"
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.designation ? `(${c.designation})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {selectedContact && (
                <div className="p-3 rounded-xl bg-[#1A1040]/70 border border-slate-800 space-y-1 text-xs">
                  <div className="font-bold text-white">{selectedContact.full_name}</div>
                  {selectedContact.designation && (
                    <div className="text-slate-400 text-[11px]">{selectedContact.designation}</div>
                  )}
                  {selectedContact.email && (
                    <div className="text-slate-300 text-[11px] font-mono truncate">
                      Email: {selectedContact.email}
                    </div>
                  )}
                  {selectedContact.phone && (
                    <div className="text-slate-300 text-[11px] font-mono">
                      Phone: {selectedContact.phone}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Opportunity & Project Context */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>3. Business Context</span>
              </label>

              {/* Opportunity Picker */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400">Opportunity (Optional)</span>
                <select
                  value={selectedOppId || ''}
                  onChange={(e) => setSelectedOppId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value="">-- No Specific Opportunity --</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.name} ({opp.stage})
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Showcase Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Project / Showcase</span>
                  {selectedProjectId && (
                    <Link
                      to={`/business-development/showcase/${selectedProjectId}`}
                      target="_blank"
                      className="text-[10px] text-violet-400 hover:text-white inline-flex items-center space-x-1"
                    >
                      <span>View Demo</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
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

          {/* ── Right Column: Outreach Editor & Channels (8 cols) ── */}
          <div className="lg:col-span-8 space-y-5">
            {/* Mode Switcher: Manual vs AI Generated */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('manual')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    workspaceMode === 'manual' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white bg-slate-800/40'
                  }`}
                >
                  Manual Mode
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('ai')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                    workspaceMode === 'ai' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-white bg-slate-800/40'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span>AI Generated Mode</span>
                </button>
              </div>

              {workspaceMode === 'ai' ? (
                <div className="flex items-center space-x-2">
                  {personalizationScore !== null && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Personalization Score: {personalizationScore.toFixed(0)} / 100
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateAIDraft}
                    disabled={generatingAI || !selectedContactId}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/20 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{generatingAI ? 'Generating...' : 'Generate AI Outreach'}</span>
                  </button>
                </div>
              ) : (
                /* Template Picker */
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-violet-400" />
                  <select
                    value={selectedTemplateId || ''}
                    onChange={(e) => {
                      if (e.target.value) handleApplyTemplate(Number(e.target.value))
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                  >
                    <option value="">-- Use Approved Template --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.channel})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Channel Tabs */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {CHANNELS.map((ch) => {
                  const Icon = ch.icon
                  const active = channel === ch.type
                  return (
                    <button
                      key={ch.type}
                      onClick={() => setChannel(ch.type)}
                      className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 border ${
                        active
                          ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/30'
                          : 'bg-[#1A1040] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{ch.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Main Message Editor Box */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              {/* Channel specific metadata headers */}
              {channel === 'Email' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-16">To:</span>
                    <input
                      type="text"
                      disabled
                      value={selectedContact?.email || 'No contact email available'}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-16">Subject:</span>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Outreach subject line..."
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white font-medium text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {channel === 'Phone' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-24">Phone:</span>
                    <input
                      type="text"
                      disabled
                      value={selectedContact?.phone || 'No phone number available'}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-24">Call Purpose:</span>
                    <input
                      type="text"
                      value={callPurpose}
                      onChange={(e) => setCallPurpose(e.target.value)}
                      placeholder="e.g. Discovery call on workflow integration..."
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white font-medium text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {channel === 'LinkedIn' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-24">Profile:</span>
                    <input
                      type="text"
                      disabled
                      value={selectedContact?.linkedin_url || 'No LinkedIn URL on file'}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {channel === 'WhatsApp' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-24">WhatsApp To:</span>
                    <input
                      type="text"
                      disabled
                      value={selectedContact?.phone || 'No phone number available'}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Message Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold">
                    {channel === 'Phone' ? 'Call Discussion Notes' : 'Message Content'}
                  </span>
                  <span className="font-mono text-[10px]">{message.length} chars</span>
                </div>
                <textarea
                  rows={9}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    channel === 'Phone'
                      ? 'Record talking points, client feedback, or discussion summary...'
                      : 'Type your message or select an approved template above...'
                  }
                  className="w-full p-4 rounded-2xl bg-[#1A1040] border border-slate-700 text-white text-xs leading-relaxed focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || !selectedOrgId}
                    className="py-2 px-4 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {savingDraft ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                    <span>Save Draft</span>
                  </button>

                  {/* Email channel: show Gmail send OR mailto fallback */}
                  {channel === 'Email' ? (
                    gmailStatus?.connected ? (
                      <button
                        type="button"
                        onClick={handleSendViaGmail}
                        disabled={!selectedOrgId || sendingViaGmail || !selectedContact?.email}
                        className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50 shadow-lg shadow-emerald-600/30"
                      >
                        {sendingViaGmail ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        <span>{sendingViaGmail ? 'Sending...' : 'Send via Gmail'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenClient}
                        disabled={!selectedOrgId}
                        className="py-2 px-4 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Email Client</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenClient}
                      disabled={!selectedOrgId}
                      className="py-2 px-4 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>
                        {channel === 'Phone'
                          ? 'Call Contact'
                          : channel === 'LinkedIn'
                          ? 'Open LinkedIn'
                          : channel === 'WhatsApp'
                          ? 'Open WhatsApp'
                          : 'Launch Channel'}
                      </span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenRecordModal}
                  disabled={!selectedOrgId}
                  className="py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-violet-600/30 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Contacted</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Record Outreach & Status Transition Modal ── */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800/80">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Record Communication</h3>
                <p className="text-xs text-slate-400">
                  Save to relationship history and optionally update status & follow-up
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Communication Summary</label>
                <input
                  type="text"
                  value={recordSummary}
                  onChange={(e) => setRecordSummary(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Status Bump Option */}
              <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-0"
                  />
                  <span>Update Organization Relationship Status</span>
                </label>

                {updateStatus && (
                  <div className="pl-6 space-y-1">
                    <span className="text-[11px] text-slate-400">Set new pipeline stage:</span>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none"
                    >
                      <option value="Contacted">Contacted (Recommended)</option>
                      <option value="Connected">Connected</option>
                      <option value="Interested">Interested</option>
                      <option value="Active Discussion">Active Discussion</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Follow-up Creation Option */}
              <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createFollowup}
                    onChange={(e) => setCreateFollowup(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-0"
                  />
                  <span>Create Follow-up Task</span>
                </label>

                {createFollowup && (
                  <div className="pl-6 space-y-2">
                    <input
                      type="text"
                      value={followupTitle}
                      onChange={(e) => setFollowupTitle(e.target.value)}
                      placeholder="Follow-up title..."
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Due In (Days)</span>
                        <select
                          value={followupDueDays}
                          onChange={(e) => setFollowupDueDays(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                        >
                          <option value={1}>1 Day (Tomorrow)</option>
                          <option value={3}>3 Days</option>
                          <option value={5}>5 Days</option>
                          <option value={7}>1 Week</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400">Priority</span>
                        <select
                          value={followupPriority}
                          onChange={(e) => setFollowupPriority(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRecord}
                disabled={recording}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-violet-600/30 disabled:opacity-50"
              >
                {recording && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default OutreachWorkspacePage
