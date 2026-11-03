import React, { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ExternalLink, Landmark, RotateCw, AlertCircle, Unlink } from 'lucide-react'
import { organizationsService } from '../../services/organizations'
import type { FinancialHealthLabel, FinancialPoint, OrganizationFinancials } from '../../types/financials'

const GAIN = '#8B5CF6'
const LOSS = '#F43F5E'

const HEALTH_TEXT: Record<FinancialHealthLabel, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  mixed: { label: 'Mixed', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  weak: { label: 'Weak', className: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  stale: { label: 'Out of date', className: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  insufficient_data: { label: 'Not enough data', className: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
}

const METRICS: { key: keyof NonNullable<OrganizationFinancials['data']>['metrics']; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net income' },
  { key: 'total_assets', label: 'Total assets' },
  { key: 'total_liabilities', label: 'Total liabilities' },
  { key: 'cash', label: 'Cash & equivalents' },
]

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
  }).format(value)
}

function yearLabel(p: FinancialPoint): string {
  return `FY ${p.period_end.slice(0, 4)}`
}

function MiniBarChart({ title, points }: { title: string; points: FinancialPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800">
        <span className="text-[11px] text-slate-400 block font-medium mb-1">{title}</span>
        <p className="text-xs text-slate-500">Fewer than two annual figures reported; no trend to chart.</p>
      </div>
    )
  }
  const data = points.map((p) => ({ year: yearLabel(p), value: p.value, filed: p.filed, form: p.form }))
  return (
    <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800">
      <span className="text-[11px] text-slate-400 block font-medium mb-2">{title} by fiscal year (USD)</span>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2A2150" />
            <XAxis dataKey="year" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={money}
              width={56}
              tick={{ fill: '#94A3B8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="#475569" />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              contentStyle={{ background: '#0B0720', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#E2E8F0' }}
              itemStyle={{ color: '#CBD5E1' }}
              formatter={(value, _name, item) => [
                `${money(Number(value))} (${item.payload.form}, filed ${item.payload.filed})`,
                title,
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((d) => (
                <Cell key={d.year} fill={d.value < 0 ? LOSS : GAIN} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function FinancialSummaryCard({ organizationId }: { organizationId: number | string }) {
  const [fin, setFin] = useState<OrganizationFinancials | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cik, setCik] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setFin(await organizationsService.getFinancials(organizationId))
    } catch (e: any) {
      setError(e?.message || 'Could not load financial information.')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    load()
  }, [load])

  const run = async (action: () => Promise<OrganizationFinancials>) => {
    setBusy(true)
    setError(null)
    try {
      setFin(await action())
    } catch (e: any) {
      setError(e?.message || 'The request failed.')
    } finally {
      setBusy(false)
    }
  }

  const metrics = fin?.data?.metrics
  const newestEnd = metrics
    ? Object.values(metrics).flat().map((p) => p.period_end).sort().at(-1)
    : undefined
  const health = fin?.health && HEALTH_TEXT[fin.health.label]

  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400 flex items-center gap-2">
          <Landmark className="w-4 h-4" />
          <span>Financial Summary</span>
        </h2>
        {fin?.linked && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => run(() => organizationsService.refreshFinancials(organizationId))}
              disabled={busy}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={() => run(() => organizationsService.unlinkFinancials(organizationId))}
              disabled={busy}
              className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 disabled:opacity-50"
            >
              <Unlink className="w-3 h-3" /> Unlink
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading financial information…</p>
      ) : !fin ? null : !fin.linked ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            No public financial data is linked. Public filings are available only for companies that report to the
            US SEC; private companies, hospitals and NGOs usually have none. Missing data does not lower this
            organization's priority.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (cik.trim()) run(() => organizationsService.linkFinancials(organizationId, cik.trim()))
            }}
          >
            <input
              value={cik}
              onChange={(e) => setCik(e.target.value)}
              placeholder="SEC CIK, e.g. 320193"
              className="flex-1 bg-[#1A1040] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={busy || !cik.trim()}
              className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Fetching from SEC…' : 'Link SEC filings'}
            </button>
          </form>
          <a
            href="https://www.sec.gov/edgar/search/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
          >
            Look up a CIK on SEC EDGAR <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 space-y-1">
            <div>
              SEC registrant: <span className="text-slate-200 font-medium">{fin.entity_name || 'Unknown'}</span>{' '}
              (CIK {fin.cik}). Check this is the same organization.
            </div>
            <div>
              Source:{' '}
              <a href={fin.data?.company_url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">
                SEC EDGAR filings
              </a>{' '}
              · retrieved {fin.fetched_at ? new Date(fin.fetched_at).toLocaleDateString() : 'unknown'}
            </div>
            {fin.fetch_status === 'error' && (
              <div className="text-amber-300">Last refresh failed ({fin.fetch_error}); showing the previously retrieved figures.</div>
            )}
          </div>

          {health && (
            <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Financial health signal</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${health.className}`}>{health.label}</span>
              </div>
              <ul className="text-xs text-slate-300 list-disc pl-4 space-y-0.5">
                {fin.health.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <p className="text-[11px] text-slate-500">
                A fixed rule applied to the filed figures above, not an AI estimate. Funding news or share price are
                not considered.
              </p>
              <p className="text-[11px] text-slate-500">
                Used only as a tie-breaker in My Organization Queue; due dates and task priority always come first.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METRICS.map(({ key, label }) => {
              const latest = metrics?.[key]?.at(-1)
              // Companies sometimes stop tagging a line item; don't let an old figure pass as current.
              const outdated = latest && newestEnd && Date.parse(newestEnd) - Date.parse(latest.period_end) > 400 * 86400000
              return (
                <div key={key} className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">{label}</span>
                  {latest ? (
                    <>
                      <div className="text-sm text-slate-100 font-semibold">{money(latest.value)}</div>
                      <a
                        href={latest.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-400 hover:text-violet-300 inline-flex items-center gap-1"
                      >
                        Period ending {latest.period_end} · {latest.form} filed {latest.filed}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {outdated && (
                        <span className="text-[11px] text-amber-300 block">Older than the other figures; not reported since.</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Not reported in SEC filings</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MiniBarChart title="Revenue" points={metrics?.revenue || []} />
            <MiniBarChart title="Net income" points={metrics?.net_income || []} />
          </div>

          <details className="text-xs text-slate-300">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200">View all figures as a table</summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left">
                <thead className="text-slate-400">
                  <tr><th className="py-1 pr-3">Metric</th><th className="py-1 pr-3">Period end</th><th className="py-1 pr-3">Value (USD)</th><th className="py-1 pr-3">XBRL tag</th><th className="py-1">Filing</th></tr>
                </thead>
                <tbody>
                  {METRICS.flatMap(({ key, label }) =>
                    (metrics?.[key] || []).map((p) => (
                      <tr key={`${key}-${p.period_end}`} className="border-t border-slate-800">
                        <td className="py-1 pr-3">{label}</td>
                        <td className="py-1 pr-3">{p.period_end}</td>
                        <td className="py-1 pr-3">{money(p.value)}</td>
                        <td className="py-1 pr-3 text-slate-500">{p.concept}</td>
                        <td className="py-1">
                          <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">
                            {p.form} {p.filed}
                          </a>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
