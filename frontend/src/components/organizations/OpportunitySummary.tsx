import React, { useEffect, useState } from 'react'
import { opportunitiesService } from '../../services/opportunities'
import type { Opportunity } from '../../types/opportunity'

const STAGE_ORDER = ['Potential', 'Contacted', 'Connected', 'Interested', 'Meeting', 'Discussion', 'Partnership']
const MAX_PAGES = 10 // 1,000 opportunities; beyond that the summary says it may be incomplete

export interface OpportunityLoad {
  byOrg: Map<number, Opportunity[]>
  loading: boolean
  error: string | null
  truncated: boolean
}

/** Loads the user's opportunities once and groups them by organization for the Organizations list. */
export function useOpportunitiesByOrg(): OpportunityLoad {
  const [state, setState] = useState<OpportunityLoad>({ byOrg: new Map(), loading: true, error: null, truncated: false })
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all: Opportunity[] = []
        let page = 1
        let totalPages = 1
        do {
          const res = await opportunitiesService.getOpportunities({ page, page_size: 100 })
          all.push(...res.items)
          totalPages = res.total_pages
          page += 1
        } while (page <= totalPages && page <= MAX_PAGES)
        const byOrg = new Map<number, Opportunity[]>()
        all.forEach((o) => byOrg.set(o.organization_id, [...(byOrg.get(o.organization_id) || []), o]))
        if (!cancelled) setState({ byOrg, loading: false, error: null, truncated: totalPages > MAX_PAGES })
      } catch (err: any) {
        if (!cancelled) setState({ byOrg: new Map(), loading: false, error: err?.detail || err?.message || 'Opportunities could not be loaded.', truncated: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value)
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`
  }
}

/** One compact line: count, furthest stage, total estimated value, next action date. */
export const OpportunitySummary: React.FC<{ opportunities?: Opportunity[]; loading?: boolean; error?: string | null }> = ({
  opportunities,
  loading,
  error,
}) => {
  if (loading) return <span className="text-slate-600">…</span>
  if (error) return <span className="text-slate-500" title={error}>Unavailable</span>
  if (!opportunities?.length) return <span className="text-slate-600">—</span>

  const furthest = opportunities.reduce((best, o) => (STAGE_ORDER.indexOf(o.stage) > STAGE_ORDER.indexOf(best.stage) ? o : best))
  const currencies = new Set(opportunities.filter((o) => o.estimated_value != null).map((o) => o.currency))
  const total = opportunities.reduce((s, o) => s + (o.estimated_value || 0), 0)
  const value = currencies.size === 1 && total > 0 ? money(total, [...currencies][0]) : currencies.size > 1 ? 'mixed currencies' : null
  const nextDates = opportunities.map((o) => o.next_action_date).filter(Boolean).sort() as string[]

  return (
    <span className="block leading-tight">
      <span className="text-slate-200">
        {opportunities.length} · {furthest.stage}
      </span>
      {(value || nextDates[0]) && (
        <span className="block text-[11px] text-slate-500">
          {value}
          {value && nextDates[0] ? ' · ' : ''}
          {nextDates[0] ? `next ${new Date(nextDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
        </span>
      )}
    </span>
  )
}

export default OpportunitySummary
