import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ExternalLink, Loader2, RotateCcw, AlertCircle } from 'lucide-react'
import FinancialBarChart from '../charts/FinancialBarChart'
import { PRIORITY_COLORS, PRIORITY_ORDER } from '../../lib/priority'
import {
  availableMetrics,
  availableYears,
  formatMoney,
  insightsService,
  metricLabel,
  pointFor,
  FINANCIAL_METRICS,
  yearOf,
  type FinancialMetricKey,
  type InsightOrganization,
} from '../../lib/financials'

const COLLAPSE_KEY = 'elly.orgs.financialPanel.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

interface Props {
  /** IDs of the organizations currently shown in the table (same search, filters and page). */
  organizationIds: number[]
  page: number
  totalPages: number
  priorityFilter: string
  onPriorityFilter: (p: string) => void
  selectedId: number | null
  onSelect: (id: number | null) => void
}

export const OrganizationFinancialPanel: React.FC<Props> = ({
  organizationIds,
  page,
  totalPages,
  priorityFilter,
  onPriorityFilter,
  selectedId,
  onSelect,
}) => {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [rows, setRows] = useState<InsightOrganization[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<FinancialMetricKey>('revenue')
  const [year, setYear] = useState<number | 'latest'>('latest')
  const idsKey = organizationIds.join(',')

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* per-viewer convenience only */
    }
  }, [collapsed])

  useEffect(() => {
    if (collapsed || !organizationIds.length) {
      if (!organizationIds.length) setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    insightsService
      .list({ ids: organizationIds })
      .then((res) => {
        if (cancelled) return
        // Keep the table's order so both views list the same organizations.
        const byId = new Map(res.items.map((o) => [o.id, o]))
        setRows(organizationIds.map((id) => byId.get(id)).filter(Boolean) as InsightOrganization[])
      })
      .catch((err) => !cancelled && setError(err?.detail || err?.message || 'Financial data could not be loaded.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, collapsed])

  const metrics = useMemo(() => availableMetrics(rows), [rows])
  const years = useMemo(() => availableYears(rows, metric), [rows, metric])

  useEffect(() => {
    if (metrics.length && !metrics.includes(metric)) setMetric(metrics[0])
  }, [metrics, metric])
  useEffect(() => {
    if (year !== 'latest' && !years.includes(year)) setYear('latest')
  }, [years, year])

  const selected = rows.find((r) => r.id === selectedId) || null
  const selectedPoint = selected ? pointFor(selected, metric, year) : null
  const linkedCount = rows.filter((r) => r.financials).length

  return (
    <section aria-label="Financial comparison" className="bg-[#110B2E] border border-slate-800/90 rounded-xl">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-sm font-semibold text-white"
        >
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          Financial comparison
        </button>
        {!collapsed && metrics.length > 0 && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Metric
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as FinancialMetricKey)}
                className="px-2 py-1 bg-[#1A1040] border border-slate-700 rounded-md text-slate-200 text-xs"
              >
                {FINANCIAL_METRICS.filter((m) => metrics.includes(m.key)).map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} (USD)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Fiscal year
              <select
                value={String(year)}
                onChange={(e) => setYear(e.target.value === 'latest' ? 'latest' : Number(e.target.value))}
                className="px-2 py-1 bg-[#1A1040] border border-slate-700 rounded-md text-slate-200 text-xs"
              >
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
        {!collapsed && (
          <div className="flex items-center gap-1 ml-auto" role="group" aria-label="Filter by priority">
            {PRIORITY_ORDER.map((p) => {
              const on = priorityFilter === p
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPriorityFilter(on ? '' : p)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${
                    on ? 'border-slate-400 text-white bg-white/5' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                  {p}
                </button>
              )
            })}
            {(selectedId || priorityFilter) && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null)
                  onPriorityFilter('')
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-300 hover:text-white"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading financial figures…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-xs text-rose-300 py-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No organizations match the current search and filters.</p>
          ) : linkedCount === 0 ? (
            <div className="text-xs text-slate-400 py-2 space-y-1">
              <p className="text-slate-300">No financial figures are available for the organizations shown.</p>
              <p>
                The chart uses annual figures from US SEC filings. To add them, open an organization and link its SEC CIK in
                the Financial Summary panel. Private companies, hospitals and NGOs usually don’t file with the SEC, so
                they show as N/A. Nothing is fetched or enriched automatically.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                {metricLabel(metric)} in USD, {year === 'latest' ? 'latest annual (10-K) figure for each organization' : `fiscal year ${year}`}.
                {' '}Showing the {rows.length} organization{rows.length === 1 ? '' : 's'} on this page
                {totalPages > 1 ? ` (page ${page} of ${totalPages})` : ''}; {linkedCount} linked to SEC filings. Click a bar to
                find it in the table.
              </p>
              <FinancialBarChart rows={rows} metric={metric} year={year} selectedId={selectedId} onSelect={(id) => onSelect(id === selectedId ? null : id)} />
              {selected && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 border-t border-slate-800 pt-3">
                  <span className="font-semibold text-white">{selected.name}</span>
                  <span>
                    {metricLabel(metric)}: {formatMoney(selectedPoint?.value ?? null, selected.financials?.currency)}
                    {selectedPoint ? ` (FY${yearOf(selectedPoint)}, period ending ${selectedPoint.period_end})` : ''}
                  </span>
                  {selectedPoint?.source_url && (
                    <a href={selectedPoint.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
                      SEC {selectedPoint.form} filing <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Link to={`/business-development/organizations/${selected.id}`} className="text-violet-300 hover:text-violet-200">
                    Open organization
                  </Link>
                  <button type="button" onClick={() => onSelect(null)} className="ml-auto text-slate-400 hover:text-white">
                    Clear selection
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-500">Source: SEC EDGAR company filings, as linked on each organization.</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default OrganizationFinancialPanel
