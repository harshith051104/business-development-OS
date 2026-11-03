import React, { useMemo, useState } from 'react'
import { priorityColor, normalizePriority } from '../../lib/priority'
import {
  formatMoney,
  HEALTH_LABELS,
  locationOf,
  metricLabel,
  pointFor,
  yearOf,
  type FinancialMetricKey,
  type InsightOrganization,
  type InsightPoint,
} from '../../lib/financials'

interface Props {
  rows: InsightOrganization[]
  metric: FinancialMetricKey
  year: number | 'latest'
  selectedId?: number | null
  onSelect?: (id: number) => void
  /** Height of the scrollable plot area. */
  maxHeight?: number
}

interface Bar {
  org: InsightOrganization
  point: InsightPoint | null
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v / step) * step)
  return ticks
}

/** Horizontal bars, one organization per row, one metric at a time, with a $0 baseline. */
export const FinancialBarChart: React.FC<Props> = ({ rows, metric, year, selectedId, onSelect, maxHeight = 360 }) => {
  const [hoverId, setHoverId] = useState<number | null>(null)

  const { withData, missing, domain, ticks, currency } = useMemo(() => {
    const bars: Bar[] = rows.map((org) => ({ org, point: pointFor(org, metric, year) }))
    const withData = bars.filter((b) => b.point).sort((a, b) => b.point!.value - a.point!.value)
    const missing = bars.filter((b) => !b.point)
    const values = withData.map((b) => b.point!.value)
    const lo = Math.min(0, ...values)
    const hi = Math.max(0, ...values)
    const ticks = values.length ? niceTicks(lo, hi) : [0]
    const domain: [number, number] = [Math.min(lo, ticks[0]), Math.max(hi, ticks[ticks.length - 1])]
    const currencies = new Set(withData.map((b) => b.org.financials?.currency || 'USD'))
    return { withData, missing, domain, ticks, currency: currencies.size === 1 ? [...currencies][0] : 'mixed' }
  }, [rows, metric, year])

  const pct = (v: number) => ((v - domain[0]) / (domain[1] - domain[0] || 1)) * 100
  const zero = pct(0)
  const activeId = hoverId ?? selectedId ?? null

  if (currency === 'mixed') {
    return (
      <p className="text-xs text-amber-300">
        These organizations report in different currencies, so they can’t share one axis. Narrow the filters to one currency.
      </p>
    )
  }

  const tooltipFor = (b: Bar) => {
    const f = b.org.financials
    const health = f?.health?.label ? HEALTH_LABELS[f.health.label] || f.health.label : null
    return (
      <div className="absolute z-20 left-0 top-full mt-1 w-80 max-w-[90vw] bg-[#1B1440] border border-slate-600 rounded-lg shadow-2xl p-3 text-[11px] text-slate-300 space-y-1 pointer-events-none">
        <div className="text-xs font-semibold text-white">{b.org.name}</div>
        <div>
          {metricLabel(metric)}: <span className="text-white font-medium">{formatMoney(b.point?.value ?? null, f?.currency)}</span>
          {b.point && (
            <span className="text-slate-400">
              {' '}· FY{yearOf(b.point)}, period ending {b.point.period_end}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityColor(b.org.priority) }} />
          Priority: {normalizePriority(b.org.priority) || 'Not set'}
        </div>
        <div>{locationOf(b.org)}</div>
        {health && (
          <div>
            Financial summary: {health}
            {f?.health?.reasons?.[0] ? ` — ${f.health.reasons[0]}` : ''}
          </div>
        )}
        {b.point && <div className="text-slate-500">Source: SEC {b.point.form} filed {b.point.filed}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {withData.length > 0 && (
        <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
          <div className="grid grid-cols-[minmax(110px,28%)_1fr] gap-x-3">
            {/* Axis header */}
            <div />
            <div className="relative h-5 text-[10px] text-slate-500">
              {ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(t)}%` }}>
                  {formatMoney(t, currency)}
                </span>
              ))}
            </div>

            {withData.map((b) => {
              const v = b.point!.value
              const left = Math.min(zero, pct(v))
              const width = Math.abs(pct(v) - zero)
              const isActive = activeId === b.org.id
              const isSelected = selectedId === b.org.id
              const label = `${b.org.name}: ${metricLabel(metric)} ${formatMoney(v, currency)}, priority ${normalizePriority(b.org.priority) || 'not set'}`
              return (
                <React.Fragment key={b.org.id}>
                  <div className={`text-[11px] truncate py-1 flex items-center gap-1.5 ${isSelected ? 'text-white font-semibold' : 'text-slate-300'}`} title={b.org.name}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: priorityColor(b.org.priority) }} aria-hidden />
                    <span className="truncate">{b.org.name}</span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={isSelected}
                      onMouseEnter={() => setHoverId(b.org.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(b.org.id)}
                      onBlur={() => setHoverId(null)}
                      onClick={() => onSelect?.(b.org.id)}
                      className="relative w-full h-7 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      {ticks.map((t) => (
                        <span key={t} className={`absolute top-0 bottom-0 w-px ${t === 0 ? 'bg-slate-500' : 'bg-slate-800'}`} style={{ left: `${pct(t)}%` }} />
                      ))}
                      <span
                        className={`absolute top-1 bottom-1 ${v < 0 ? 'rounded-l' : 'rounded-r'} transition-opacity`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.4)}%`,
                          backgroundColor: priorityColor(b.org.priority),
                          opacity: activeId && !isActive ? 0.45 : 1,
                          outline: isSelected ? '2px solid #ffffff' : undefined,
                        }}
                      />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 text-[10px] text-slate-200 whitespace-nowrap px-1"
                        style={v < 0 ? { right: `${100 - left}%` } : { left: `${left + width}%` }}
                      >
                        {formatMoney(v, currency)}
                      </span>
                    </button>
                    {hoverId === b.org.id && tooltipFor(b)}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <details className="text-[11px] text-slate-400">
          <summary className="cursor-pointer select-none">
            N/A for {missing.length} organization{missing.length === 1 ? '' : 's'} — no {metricLabel(metric).toLowerCase()} filed
            {year === 'latest' ? '' : ` for FY${year}`}
          </summary>
          <ul className="mt-1.5 grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {missing.map((b) => (
              <li key={b.org.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: priorityColor(b.org.priority) }} aria-hidden />
                <button type="button" onClick={() => onSelect?.(b.org.id)} className="truncate hover:text-white text-left">
                  {b.org.name}
                </button>
                <span className="text-slate-500">N/A</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default FinancialBarChart
