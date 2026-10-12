import React, { useEffect, useMemo, useState } from 'react'
import Navbar from '../../components/layout/Navbar'
import { leadTrackerService } from '../../services/leadTracker'
import { gmailService } from '../../services/gmail'
import type { DeliverabilityHealth } from '../../services/gmail'
import { LEAD_TRACKER_CHECKBOX_FIELDS } from '../../types/leadTracker'
import type {
  LeadTrackerRow,
  LeadTrackerTeamProgress,
  LeadTrackerTimelineEvent,
} from '../../types/leadTracker'
import {
  ClipboardList,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  MailOpen,
  MessageSquare,
  History,
  Users,
  Activity,
  RefreshCw,
} from 'lucide-react'

const CHECKBOX_LABELS: Record<string, string> = {
  linkedin_followed: 'Followed',
  linkedin_connection_sent: 'Conn. Sent',
  linkedin_connection_accepted: 'Conn. Accepted',
  linkedin_first_message_sent: '1st Message',
  linkedin_reply_received: 'LI Reply',
  followup_1_sent: 'Follow-up 1',
  followup_2_sent: 'Follow-up 2',
  followup_3_sent: 'Follow-up 3',
  meeting_scheduled: 'Meeting',
  opportunity_closed: 'Closed',
}

export const LeadTrackerPage: React.FC = () => {
  const [rows, setRows] = useState<LeadTrackerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<LeadTrackerTeamProgress | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [timelineFor, setTimelineFor] = useState<LeadTrackerRow | null>(null)
  const [timeline, setTimeline] = useState<LeadTrackerTimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [health, setHealth] = useState<DeliverabilityHealth[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const loadBoard = async (p = page, s = search) => {
    setLoading(true)
    setError(null)
    try {
      const data = await leadTrackerService.getBoard({ page: p, page_size: pageSize, search: s || undefined })
      setRows(data.leads)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead tracker board.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoard(1, search)
    leadTrackerService.getTeamProgress().then(setTeam).catch(() => {})
    gmailService.getDeliverability().then(setHealth).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadBoard(1, search)
  }

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    loadBoard(p, search)
  }

  const toggleCheckbox = async (row: LeadTrackerRow, field: string) => {
    setSavingId(row.id)
    try {
      const updated = await leadTrackerService.updateCheckboxes(row.id, { [field]: !(row as any)[field] })
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
      leadTrackerService.getTeamProgress().then(setTeam).catch(() => {})
    } catch (err: any) {
      setError(err?.message || 'Failed to update checkbox.')
    } finally {
      setSavingId(null)
    }
  }

  const openTimeline = async (row: LeadTrackerRow) => {
    setTimelineFor(row)
    setTimelineLoading(true)
    try {
      const events = await leadTrackerService.getTimeline(row.id)
      setTimeline(events)
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await leadTrackerService.syncSheet()
      if (!result.success) {
        setSyncMessage(result.reason === 'not_configured' ? 'Google Sheets not configured.' : 'Sync failed.')
      } else {
        setSyncMessage(`Synced: ${result.updated} updated, ${result.checked} checked.`)
        if (result.updated > 0) loadBoard(page, search)
      }
    } catch (err: any) {
      setSyncMessage(err?.message || 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  const rangeLabel = useMemo(() => {
    if (total === 0) return '0 leads'
    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, total)
    return `${start}-${end} of ${total} leads`
  }, [page, pageSize, total])

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">Lead Tracker</h1>
            </div>
            <p className="text-sm text-gray-400">
              Milestone checklist and activity timeline for every lead in your campaigns.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {health.map((h) => (
              <div
                key={h.account_id}
                title={`${h.email}: ${h.sent} sent, ${h.bounce_rate}% bounce, ${h.reply_rate}% reply`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium ${
                  h.status === 'healthy'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : h.status === 'at_risk'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                {h.email}: {h.health_score}
              </div>
            ))}
            <button
              onClick={() => setShowTeam((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131127] border border-white/10 text-sm font-medium hover:bg-[#1a1733] transition"
            >
              <Users className="w-4 h-4 text-violet-300" />
              Team Progress
            </button>
            <button
              onClick={syncNow}
              disabled={syncing}
              title="Pull edits made directly in the ELLY Lead Tracker Google Sheet"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131127] border border-white/10 text-sm font-medium hover:bg-[#1a1733] transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-300 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="text-xs text-gray-400 -mt-2">{syncMessage}</div>
        )}

        {showTeam && team && (
          <div className="p-4 rounded-2xl bg-[#131127]/60 border border-white/5 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300">
                Team Progress — {team.total_completed}/{team.total_leads} opportunities closed
              </h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-left border-b border-white/5">
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Sent</th>
                  <th className="py-2 pr-4">LI Connected</th>
                  <th className="py-2 pr-4">Meetings</th>
                  <th className="py-2 pr-4">Closed</th>
                  <th className="py-2 pr-4">Completion</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((m) => (
                  <tr key={m.user_id ?? 'unassigned'} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 font-medium">{m.display_name}</td>
                    <td className="py-2 pr-4">{m.total_leads}</td>
                    <td className="py-2 pr-4">{m.email_sent}</td>
                    <td className="py-2 pr-4">{m.linkedin_connection_accepted}</td>
                    <td className="py-2 pr-4">{m.meeting_scheduled}</td>
                    <td className="py-2 pr-4">{m.opportunity_closed}</td>
                    <td className="py-2 pr-4">{m.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or company..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#131127] border border-white/10 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition">
            Search
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/5 overflow-x-auto bg-[#0d0b1f]">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-sm">No leads found.</div>
          ) : (
            <table className="w-full text-xs min-w-[1300px]">
              <thead>
                <tr className="text-gray-500 text-left border-b border-white/5 bg-[#0a0818]">
                  <th className="py-2 px-3 sticky left-0 bg-[#0a0818]">Lead</th>
                  <th className="py-2 px-3">Campaign</th>
                  <th className="py-2 px-3 text-center" title="Email Sent / Opened / Replied">
                    Email
                  </th>
                  {LEAD_TRACKER_CHECKBOX_FIELDS.map((f) => (
                    <th key={f} className="py-2 px-2 text-center whitespace-nowrap">
                      {CHECKBOX_LABELS[f] || f}
                    </th>
                  ))}
                  <th className="py-2 px-3">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 sticky left-0 bg-[#0d0b1f]">
                      <div className="font-medium">{row.name || '—'}</div>
                      <div className="text-gray-500">{row.company || row.email || ''}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-400">{row.campaign_name || '—'}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Mail className={`w-3.5 h-3.5 ${row.email_sent ? 'text-sky-400' : 'text-gray-600'}`} />
                        <MailOpen className={`w-3.5 h-3.5 ${row.email_opened ? 'text-amber-400' : 'text-gray-600'}`} />
                        <MessageSquare className={`w-3.5 h-3.5 ${row.email_replied ? 'text-emerald-400' : 'text-gray-600'}`} />
                      </div>
                    </td>
                    {LEAD_TRACKER_CHECKBOX_FIELDS.map((f) => (
                      <td key={f} className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean((row as any)[f])}
                          disabled={savingId === row.id}
                          onChange={() => toggleCheckbox(row, f)}
                          className="w-4 h-4 accent-violet-500 cursor-pointer"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-3">
                      <button
                        onClick={() => openTimeline(row)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-violet-300"
                        title="View timeline"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{rangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-[#131127] border border-white/10 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-[#131127] border border-white/10 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {timelineFor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
          <div className="w-full max-w-md h-full bg-[#0F0A24] border-l border-violet-900/40 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{timelineFor.name || 'Lead'} — Timeline</h2>
              <button onClick={() => setTimelineFor(null)} className="p-1.5 rounded-lg hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
            {timelineLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
              </div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-gray-500">No activity logged yet.</p>
            ) : (
              <ul className="space-y-3">
                {timeline.map((e) => (
                  <li key={e.id} className="p-3 rounded-xl bg-[#131127]/60 border border-white/5">
                    <div className="text-sm font-medium">{e.description}</div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadTrackerPage
