import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import { knowledgeBaseService } from '../../services/knowledgeBase'
import { integrationService, type IntegrationStatus } from '../../services/integrations'
import { insightsService } from '../../lib/financials'
import type { AdminDashboardStats, AdminTeamMember } from '../../types/admin'
import type { KBDocument } from '../../types/knowledgeBase'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

type Load<T> = { data: T | null; error: string | null }

function useLoad<T>(fn: () => Promise<T>): Load<T> {
  const [state, setState] = useState<Load<T>>({ data: null, error: null })
  useEffect(() => {
    fn()
      .then((data) => setState({ data, error: null }))
      .catch((err) => setState({ data: null, error: err?.detail || err?.message || 'Unavailable' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

interface Attention {
  key: string
  text: string
  link: string
  action: string
}

export const AdminDashboardPage: React.FC = () => {
  const stats = useLoad<AdminDashboardStats>(() => adminService.getDashboardStats())
  const inactive = useLoad(() => adminService.listUsers({ page: 1, page_size: 1, is_active: false }))
  const team = useLoad(() => adminService.getTeam())
  const kb = useLoad<KBDocument[]>(() => knowledgeBaseService.list())
  const orgs = useLoad(() => insightsService.list({ owner_scope: 'all' }))
  const integrations = useLoad<IntegrationStatus[]>(() => integrationService.getStatus())

  const loading = [stats, inactive, team, kb, orgs].some((s) => !s.data && !s.error)
  const failed = [
    ['Users', inactive.error],
    ['Team', team.error],
    ['Knowledge Base', kb.error],
    ['Organizations', orgs.error],
  ].filter(([, e]) => e)

  const attention: Attention[] = []
  if (inactive.data && inactive.data.total > 0)
    attention.push({ key: 'inactive', text: `${inactive.data.total} user account${inactive.data.total === 1 ? ' is' : 's are'} deactivated.`, link: '/admin/users', action: 'Review users' })
  if (kb.data) {
    if (kb.data.length === 0) attention.push({ key: 'kb-empty', text: 'The Knowledge Base is empty, so Ask ELLY has no company material to cite.', link: '/admin/knowledge-base', action: 'Add sources' })
    const broken = kb.data.filter((d) => !d.searchable).length
    if (broken) attention.push({ key: 'kb-broken', text: `${broken} knowledge source${broken === 1 ? ' is' : 's are'} not searchable.`, link: '/admin/knowledge-base', action: 'Fix sources' })
    const keyword = kb.data.filter((d) => d.searchable && d.search_mode !== 'semantic_and_keyword').length
    if (keyword) attention.push({ key: 'kb-keyword', text: `${keyword} knowledge source${keyword === 1 ? ' is' : 's are'} searchable by keyword only (no meaning-based search).`, link: '/admin/knowledge-base', action: 'View status' })
  }
  if (orgs.data) {
    const unassigned = orgs.data.items.filter((o) => !o.owner_id).length
    if (unassigned) attention.push({ key: 'unassigned', text: `${unassigned} organization${unassigned === 1 ? ' has' : 's have'} no owner, so they don’t appear in anyone’s queue.`, link: '/admin/team', action: 'Assign owners' })
  }
  if (team.data) {
    const cutoff = Date.now() - 30 * 864e5
    const quiet = team.data.items.filter(
      (m: AdminTeamMember) => m.is_active && (!m.last_activity_date || new Date(m.last_activity_date).getTime() < cutoff),
    ).length
    if (quiet) attention.push({ key: 'quiet', text: `${quiet} active team member${quiet === 1 ? ' has' : 's have'} no recorded activity in 30 days.`, link: '/admin/team', action: 'Open team view' })
  }

  return (
    <div className="min-h-screen bg-[#0E0B1D] text-[#C9C2E3] md:pl-64">
      <AdminNavbar />
      <main className="p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Admin overview</h1>
          <p className="text-xs text-slate-400 mt-1">What needs attention across the workspace. Team-wide numbers are visible to admins only.</p>
        </div>

        <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-2">Needs attention</h2>
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </p>
          ) : (
            <>
              {attention.length === 0 && failed.length === 0 && (
                <p className="flex items-center gap-2 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4" /> Nothing needs attention right now.
                </p>
              )}
              <ul className="divide-y divide-slate-800/70">
                {attention.map((a) => (
                  <li key={a.key} className="flex items-center gap-3 py-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="flex-1 text-slate-200">{a.text}</span>
                    <Link to={a.link} className="px-2.5 py-1 rounded-md border border-slate-700 text-slate-200 hover:border-slate-500 shrink-0">
                      {a.action}
                    </Link>
                  </li>
                ))}
              </ul>
              {failed.length > 0 && (
                <p className="flex items-center gap-2 text-xs text-rose-300 mt-2">
                  <AlertCircle className="w-4 h-4" /> Couldn’t check: {failed.map(([n]) => n).join(', ')}.
                </p>
              )}
            </>
          )}
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['Users', stats.data?.total_users],
            ['Active BD users', stats.data?.active_bd_users],
            ['Organizations', stats.data?.active_organizations],
            ['Open opportunities', stats.data?.active_opportunities],
            ['Active partnerships', stats.data?.active_partnerships],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">{label}</div>
              <div className="text-xl font-semibold text-white mt-1 tabular-nums">{stats.error ? '—' : value ?? '…'}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Integrations</h2>
            </div>
            <p className="text-[11px] text-slate-500">
              Gmail is connected per person (profile menu → Gmail connection). The inbound connectors below are interfaces for
              lead ingestion; ELLY doesn’t track live connection health for them.
            </p>
            {integrations.error ? (
              <p className="text-xs text-rose-300">{integrations.error}</p>
            ) : !integrations.data ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : (
              <ul className="divide-y divide-slate-800/70 text-xs">
                {integrations.data.map((i) => (
                  <li key={i.system_name} className="flex items-center justify-between py-2">
                    <span className="text-slate-200">{i.system_name}</span>
                    <span className="text-slate-400">{i.total_ingested_leads} leads received</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Recent activity log</h2>
              <Link to="/admin/audit-logs" className="text-xs text-violet-300 hover:text-violet-200">
                Open Audit Logs
              </Link>
            </div>
            {stats.error ? (
              <p className="text-xs text-rose-300">{stats.error}</p>
            ) : !stats.data ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : stats.data.recent_system_activity.length === 0 ? (
              <p className="text-xs text-slate-400">No recorded actions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800/70 text-xs">
                {stats.data.recent_system_activity.slice(0, 8).map((a) => (
                  <li key={a.id} className="py-1.5">
                    <div className="text-slate-200">{a.action.replace(/_/g, ' ').toLowerCase()}</div>
                    <div className="text-[11px] text-slate-500">
                      {a.user_email || 'system'} · {a.resource_type}
                      {a.resource_id ? ` #${a.resource_id}` : ''} · {a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
export default AdminDashboardPage
