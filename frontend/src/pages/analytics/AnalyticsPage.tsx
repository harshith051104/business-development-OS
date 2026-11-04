import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import FinancialBarChart from '../../components/charts/FinancialBarChart'
import PriorityBadge from '../../components/organizations/PriorityBadge'
import { useAuth } from '../../context/AuthContext'
import { PRIORITY_COLORS, PRIORITY_ORDER, normalizePriority } from '../../lib/priority'
import {
  availableMetrics,
  availableYears,
  formatMoney,
  insightsService,
  known,
  locationOf,
  metricLabel,
  pointFor,
  FINANCIAL_METRICS,
  HEALTH_LABELS,
  yearOf,
  type FinancialMetricKey,
  type InsightOrganization,
} from '../../lib/financials'
import { AlertCircle, Download, ExternalLink, Loader2, RotateCw, X } from 'lucide-react'

const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
] as const
type DateRange = (typeof DATE_RANGES)[number]['value']

function rangeStart(range: DateRange): Date | null {
  const now = new Date()
  if (range === '30d') return new Date(now.getTime() - 30 * 864e5)
  if (range === '90d') return new Date(now.getTime() - 90 * 864e5)
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1)
  if (range === '12m') return new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return null
}

const parseDate = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

type Dimension = 'priority' | 'industry' | 'location' | 'month'
interface Selection {
  dimension: Dimension
  value: string
}

const dimensionValue = (o: InsightOrganization, d: Dimension): string => {
  if (d === 'priority') return normalizePriority(o.priority) || 'Not set'
  if (d === 'industry') return o.industry && o.industry !== 'Unknown' ? o.industry : 'Not recorded'
  if (d === 'location') return known(o.country) || known(o.state) || known(o.city) || 'Not recorded'
  return monthKey(parseDate(o.created_at))
}
const DIMENSION_LABELS: Record<Dimension, string> = { priority: 'Priority', industry: 'Industry', location: 'Location', month: 'Added in' }

function csvCell(v: unknown): string {
  if (typeof v === 'number') return String(v)
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // keep spreadsheet formulas from running
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const Tag: React.FC<{ kind: 'snapshot' | 'period' }> = ({ kind }) => (
  <span className="text-[10px] uppercase tracking-wider text-slate-500">{kind === 'snapshot' ? 'Current snapshot' : 'In selected period'}</span>
)

interface BreakdownProps {
  title: string
  dimension: Dimension
  rows: InsightOrganization[]
  selection: Selection | null
  onSelect: (s: Selection | null) => void
  limit?: number
}

/** Count of organizations per value; each bar is a button that filters the details table. */
const Breakdown: React.FC<BreakdownProps> = ({ title, dimension, rows, selection, onSelect, limit = 8 }) => {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((o) => m.set(dimensionValue(o, dimension), (m.get(dimensionValue(o, dimension)) || 0) + 1))
    let entries = [...m.entries()]
    if (dimension === 'priority') {
      const order = [...PRIORITY_ORDER, 'Not set']
      entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    } else {
      entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    }
    const hidden = entries.length > limit ? entries.slice(limit) : []
    entries = entries.slice(0, limit)
    return { entries, hiddenCount: hidden.reduce((s, e) => s + e[1], 0), hiddenValues: hidden.length }
  }, [rows, dimension, limit])
  const max = Math.max(1, ...counts.entries.map((e) => e[1]))

  return (
    <div className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <Tag kind="snapshot" />
      </div>
      {counts.entries.length === 0 ? (
        <p className="text-xs text-slate-500">No organizations.</p>
      ) : (
        <ul className="space-y-1.5">
          {counts.entries.map(([value, count]) => {
            const active = selection?.dimension === dimension && selection.value === value
            const color = dimension === 'priority' ? PRIORITY_COLORS[value as keyof typeof PRIORITY_COLORS] || '#6b6787' : '#8b7cc7'
            const share = Math.round((count / rows.length) * 100)
            return (
              <li key={value}>
                <button
                  type="button"
                  aria-pressed={active}
                  title={`${value}: ${count} organization${count === 1 ? '' : 's'} (${share}%). Click to filter the table.`}
                  onClick={() => onSelect(active ? null : { dimension, value })}
                  className={`w-full grid grid-cols-[minmax(90px,40%)_1fr_auto] items-center gap-2 text-left text-xs rounded px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{value}</span>
                  <span className="h-3 bg-slate-800/60 rounded-r">
                    <span className="block h-3 rounded-r" style={{ width: `${(count / max) * 100}%`, backgroundColor: color }} />
                  </span>
                  <span className="tabular-nums text-slate-400">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {counts.hiddenValues > 0 && (
        <p className="text-[11px] text-slate-500 mt-2">
          +{counts.hiddenValues} more values ({counts.hiddenCount} organizations) not shown.
        </p>
      )}
    </div>
  )
}

export const AnalyticsPage: React.FC = () => {
  const location = useLocation()
  const tab: 'overview' | 'financials' = location.pathname.endsWith('/financials') ? 'financials' : 'overview'
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [scope, setScope] = useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine')
  const [ownerId, setOwnerId] = useState<string>('')
  const [orgType, setOrgType] = useState('')
  const [range, setRange] = useState<DateRange>('all')
  const [rows, setRows] = useState<InsightOrganization[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null)
  const [metric, setMetric] = useState<FinancialMetricKey>('revenue')
  const [year, setYear] = useState<number | 'latest'>('latest')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await insightsService.list({ owner_scope: scope })
      setRows(res.items)
      setTruncated(res.truncated)
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Analytics data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    load()
  }, [load])

  const types = useMemo(() => [...new Set(rows.map((r) => r.organization_type))].sort(), [rows])
  const owners = useMemo(() => {
    const m = new Map<number, string>()
    rows.forEach((r) => r.owner_id && m.set(r.owner_id, r.owner_name || `User ${r.owner_id}`))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  // Shared filters (owner + type) define the population; the date range only drives period metrics.
  const population = useMemo(
    () =>
      rows.filter(
        (r) => (!orgType || r.organization_type === orgType) && (!ownerId || String(r.owner_id ?? '') === ownerId),
      ),
    [rows, orgType, ownerId],
  )
  const start = rangeStart(range)
  const addedInPeriod = useMemo(
    () => population.filter((r) => !start || parseDate(r.created_at) >= start),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [population, range],
  )

  const growth = useMemo(() => {
    if (!population.length) return []
    const dates = population.map((r) => parseDate(r.created_at))
    const first = start || new Date(Math.min(...dates.map((d) => d.getTime())))
    const now = new Date()
    const keys: string[] = []
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      keys.push(monthKey(d))
    }
    const counts = new Map(keys.map((k) => [k, 0]))
    addedInPeriod.forEach((r) => {
      const k = monthKey(parseDate(r.created_at))
      if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1)
    })
    return keys.slice(-24).map((k) => ({ key: k, count: counts.get(k) || 0 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [population, addedInPeriod, range])

  const detailRows = useMemo(
    () => (selection ? population.filter((o) => dimensionValue(o, selection.dimension) === selection.value) : population),
    [population, selection],
  )

  const metrics = useMemo(() => availableMetrics(population), [population])
  const years = useMemo(() => availableYears(population, metric), [population, metric])
  useEffect(() => {
    if (metrics.length && !metrics.includes(metric)) setMetric(metrics[0])
  }, [metrics, metric])
  useEffect(() => {
    if (year !== 'latest' && !years.includes(year)) setYear('latest')
  }, [years, year])

  const linked = population.filter((r) => r.financials)
  const highPriority = population.filter((r) => normalizePriority(r.priority) === 'High').length
  const hasActiveFilters = !!(orgType || ownerId || range !== 'all' || selection || selectedOrg)

  const clearAll = () => {
    setOrgType('')
    setOwnerId('')
    setRange('all')
    setSelection(null)
    setSelectedOrg(null)
  }

  const exportTable = () => {
    if (tab === 'financials') {
      const list = selectedOrg ? population.filter((o) => o.id === selectedOrg) : population
      downloadCsv(
        `elly-financials-${metric}-${year}.csv`,
        ['Organization', 'Type', 'Priority', 'Location', `${metricLabel(metric)} (USD)`, 'Fiscal year', 'Period end', 'Filing', 'Filed', 'Source'],
        list.map((o) => {
          const p = pointFor(o, metric, year)
          return [o.name, o.organization_type, normalizePriority(o.priority) || '', locationOf(o), p ? p.value : 'N/A', p ? yearOf(p) : '', p?.period_end ?? '', p?.form ?? '', p?.filed ?? '', p?.source_url ?? '']
        }),
      )
    } else {
      downloadCsv(
        'elly-organizations.csv',
        ['Organization', 'Type', 'Industry', 'Priority', 'Stage', 'Location', 'Owner', 'Added', 'SEC financials linked'],
        detailRows.map((o) => [o.name, o.organization_type, o.industry || '', normalizePriority(o.priority) || '', o.status, locationOf(o), o.owner_name || '', parseDate(o.created_at).toISOString().slice(0, 10), o.financials ? 'Yes' : 'No']),
      )
    }
  }

  const select = 'px-2.5 py-1.5 bg-[#2A1E4D] border border-slate-700 rounded-lg text-slate-200 text-xs'
  const maxGrowth = Math.max(1, ...growth.map((g) => g.count))
  const financialRows = selectedOrg ? population.filter((o) => o.id === selectedOrg) : population

  return (
    <div className="min-h-screen bg-[#0E0B1D] text-[#C9C2E3] pb-24 md:pl-64">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">{tab === 'overview' ? 'Organization overview' : 'Financial comparison'}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'overview'
                ? 'What your organization records show. Edit records in CRM; names here link to them.'
                : 'Annual figures from US SEC filings, compared one metric at a time. Only organizations linked to SEC filings have values.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white disabled:opacity-50" aria-label="Refresh">
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportTable}
              disabled={loading || !population.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Export table (CSV)
            </button>
          </div>
        </div>

        {/* Shared filters */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0E0B1D] border border-slate-800 rounded-xl px-3 py-2.5">
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Owner
            <select
              className={select}
              value={ownerId ? `owner:${ownerId}` : scope}
              onChange={(e) => {
                const v = e.target.value
                if (v.startsWith('owner:')) {
                  setScope('all')
                  setOwnerId(v.slice(6))
                } else {
                  setScope(v as 'mine' | 'all')
                  setOwnerId('')
                }
              }}
            >
              <option value="mine">My organizations</option>
              <option value="all">All organizations I can access</option>
              {scope === 'all' &&
                owners.map(([id, name]) => (
                  <option key={id} value={`owner:${id}`}>
                    Owner: {name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Type
            <select className={select} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {tab === 'overview' && (
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Added to ELLY
              <select className={select} value={range} onChange={(e) => setRange(e.target.value as DateRange)}>
                {DATE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tab === 'financials' && metrics.length > 0 && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Metric
                <select className={select} value={metric} onChange={(e) => setMetric(e.target.value as FinancialMetricKey)}>
                  {FINANCIAL_METRICS.filter((m) => metrics.includes(m.key)).map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} (USD)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Fiscal year
                <select className={select} value={String(year)} onChange={(e) => setYear(e.target.value === 'latest' ? 'latest' : Number(e.target.value))}>
                  <option value="latest">Latest filed</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      FY{y}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {hasActiveFilters && (
            <button onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2 py-1">
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>

        {(selection || selectedOrg) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Active selection:</span>
            {selection && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 text-white">
                {DIMENSION_LABELS[selection.dimension]}: {selection.dimension === 'month' ? monthLabel(selection.value) : selection.value}
              </span>
            )}
            {selectedOrg && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 text-white">
                {population.find((o) => o.id === selectedOrg)?.name}
              </span>
            )}
            <button
              onClick={() => {
                setSelection(null)
                setSelectedOrg(null)
              }}
              className="text-violet-300 hover:text-violet-200"
            >
              Clear selection
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading organization data…
          </div>
        ) : error ? (
          <div className="bg-[#0E0B1D] border border-rose-500/30 rounded-xl p-6 text-sm text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
            <button onClick={load} className="ml-auto text-xs underline">
              Retry
            </button>
          </div>
        ) : population.length === 0 ? (
          <div className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
            No organizations match these filters{scope === 'mine' ? ' among the organizations you own' : ''}.
          </div>
        ) : tab === 'overview' ? (
          <>
            {truncated && <p className="text-xs text-amber-300">Showing the first 2,000 organizations alphabetically; totals cover those only.</p>}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total organizations', value: population.length, kind: 'snapshot' as const },
                {
                  label: `Added ${DATE_RANGES.find((r) => r.value === range)!.label.toLowerCase()}`,
                  value: addedInPeriod.length,
                  kind: 'period' as const,
                },
                { label: 'High priority', value: highPriority, kind: 'snapshot' as const },
                {
                  label: 'Financial data coverage',
                  value: `${linked.length} of ${population.length}`,
                  kind: 'snapshot' as const,
                  note: 'linked to SEC filings',
                },
              ].map((k) => (
                <div key={k.label} className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400">{k.label}</div>
                  <div className="text-2xl font-semibold text-white mt-1 tabular-nums">{k.value}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Tag kind={k.kind} />
                    {'note' in k && k.note && <span className="text-[10px] text-slate-500">{k.note}</span>}
                  </div>
                </div>
              ))}
            </section>

            <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">Organizations added per month</h3>
                <Tag kind="period" />
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                By the date each organization was added to ELLY (deleted organizations are not counted). Click a month to list them.
                {growth.length === 24 ? ' Showing the latest 24 months.' : ''}
              </p>
              <div className="flex items-end gap-1 h-36" role="list">
                {growth.map((g) => {
                  const active = selection?.dimension === 'month' && selection.value === g.key
                  return (
                    <button
                      key={g.key}
                      role="listitem"
                      type="button"
                      aria-pressed={active}
                      title={`${monthLabel(g.key)}: ${g.count} added`}
                      onClick={() => setSelection(active ? null : { dimension: 'month', value: g.key })}
                      className="flex-1 min-w-[10px] h-full flex flex-col justify-end items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
                    >
                      <span className="text-[10px] text-slate-400 tabular-nums mb-0.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100">{g.count}</span>
                      <span
                        className={`w-full rounded-t ${active ? 'bg-violet-300' : 'bg-violet-500/80 group-hover:bg-violet-400'}`}
                        style={{ height: g.count ? `${(g.count / maxGrowth) * 85}%` : '2px', opacity: g.count ? 1 : 0.35 }}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{growth[0] && monthLabel(growth[0].key)}</span>
                <span>{growth.length > 1 && monthLabel(growth[growth.length - 1].key)}</span>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Breakdown title="By priority" dimension="priority" rows={population} selection={selection} onSelect={setSelection} />
              <Breakdown title="By industry" dimension="industry" rows={population} selection={selection} onSelect={setSelection} />
              <Breakdown title="By location (country or state)" dimension="location" rows={population} selection={selection} onSelect={setSelection} />
            </section>

            <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Organizations <span className="text-slate-400 font-normal">({detailRows.length})</span>
                </h3>
                <Tag kind="snapshot" />
              </div>
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2A1E4D] text-slate-400 sticky top-0">
                    <tr>
                      {['Organization', 'Type', 'Industry', 'Priority', 'Stage', 'Location', 'Owner', 'Added', 'Financials'].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {detailRows.map((o) => (
                      <tr key={o.id} className="hover:bg-white/5">
                        <td className="px-3 py-2">
                          <Link to={`/business-development/organizations/${o.id}`} className="text-white hover:text-violet-300 font-medium">
                            {o.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{o.organization_type}</td>
                        <td className="px-3 py-2 text-slate-300">{o.industry && o.industry !== 'Unknown' ? o.industry : '—'}</td>
                        <td className="px-3 py-2">
                          <PriorityBadge priority={o.priority} />
                        </td>
                        <td className="px-3 py-2 text-slate-300">{o.status}</td>
                        <td className="px-3 py-2 text-slate-300">{locationOf(o)}</td>
                        <td className="px-3 py-2 text-slate-300">{o.owner_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{parseDate(o.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-slate-400">{o.financials ? 'SEC linked' : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold text-white">
                  {metricLabel(metric)} by organization{year === 'latest' ? ' (latest annual filing)' : ` (FY${year})`}
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 ml-auto">
                  {PRIORITY_ORDER.map((p) => (
                    <span key={p} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} /> {p}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {linked.length} of {population.length} organizations are linked to SEC filings. Funding raised, assets under management
                and private-company revenue aren’t stored in ELLY, so they can’t be compared here. Click a bar to focus the table.
              </p>
              {linked.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No organizations in this view have SEC financial figures. Link a company’s SEC CIK on its organization page to
                  include it. Nothing is fetched automatically.
                </p>
              ) : (
                <FinancialBarChart
                  rows={population}
                  metric={metric}
                  year={year}
                  selectedId={selectedOrg}
                  onSelect={(id) => setSelectedOrg(id === selectedOrg ? null : id)}
                  maxHeight={440}
                />
              )}
              <p className="text-[10px] text-slate-500">Source: SEC EDGAR company filings (10-K), as linked on each organization.</p>
            </section>

            <section className="bg-[#0E0B1D] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Details <span className="text-slate-400 font-normal">({financialRows.length})</span>
                </h3>
              </div>
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2A1E4D] text-slate-400 sticky top-0">
                    <tr>
                      {['Organization', 'Priority', 'Location', `${metricLabel(metric)} (USD)`, 'Period', 'Financial summary', 'Source'].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {[...financialRows]
                      .sort((a, b) => (pointFor(b, metric, year)?.value ?? -Infinity) - (pointFor(a, metric, year)?.value ?? -Infinity))
                      .map((o) => {
                        const p = pointFor(o, metric, year)
                        const health = o.financials?.health?.label
                        return (
                          <tr key={o.id} className={selectedOrg === o.id ? 'bg-violet-600/15' : 'hover:bg-white/5'}>
                            <td className="px-3 py-2">
                              <Link to={`/business-development/organizations/${o.id}`} className="text-white hover:text-violet-300 font-medium">
                                {o.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2">
                              <PriorityBadge priority={o.priority} />
                            </td>
                            <td className="px-3 py-2 text-slate-300">{locationOf(o)}</td>
                            <td className="px-3 py-2 text-white tabular-nums">{formatMoney(p?.value ?? null, o.financials?.currency)}</td>
                            <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{p ? `FY${yearOf(p)} · ends ${p.period_end}` : 'N/A'}</td>
                            <td className="px-3 py-2 text-slate-300">{health ? HEALTH_LABELS[health] || health : 'N/A'}</td>
                            <td className="px-3 py-2">
                              {p?.source_url ? (
                                <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
                                  {p.form} <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default AnalyticsPage
