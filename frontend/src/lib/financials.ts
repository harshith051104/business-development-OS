import { api } from '../services/api'

/** Figures stored from SEC 10-K filings. All are USD amounts from annual reports. */
export const FINANCIAL_METRICS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net income' },
  { key: 'total_assets', label: 'Total assets' },
  { key: 'total_liabilities', label: 'Total liabilities' },
  { key: 'cash', label: 'Cash & equivalents' },
] as const
export type FinancialMetricKey = (typeof FINANCIAL_METRICS)[number]['key']

export interface InsightPoint {
  fiscal_year: number | null
  period_end: string
  value: number
  form: string
  filed: string
  source_url: string
}

export interface InsightFinancials {
  entity_name: string | null
  cik: string
  currency: string
  company_url?: string | null
  fetched_at?: string | null
  fetch_status?: string | null
  health: { label: string; reasons: string[] }
  metrics: Partial<Record<FinancialMetricKey, InsightPoint[]>>
}

export interface InsightOrganization {
  id: number
  name: string
  organization_type: string
  industry?: string | null
  priority: string
  status: string
  city?: string | null
  state?: string | null
  country?: string | null
  owner_id?: number | null
  owner_name?: string | null
  created_at: string
  financials: InsightFinancials | null
}

export interface InsightsResponse {
  items: InsightOrganization[]
  truncated: boolean
  limit: number
  owner_scope: string
}

export const insightsService = {
  list: (params: { owner_scope?: 'mine' | 'all'; ids?: number[]; organization_type?: string }) =>
    api.get<InsightsResponse>('/api/business-development/insights/organizations', {
      owner_scope: params.owner_scope || 'mine',
      ids: params.ids && params.ids.length ? params.ids.join(',') : undefined,
      organization_type: params.organization_type || undefined,
    }),
}

export const metricLabel = (key: FinancialMetricKey) => FINANCIAL_METRICS.find((m) => m.key === key)?.label || key

/**
 * The year a figure covers, taken from its period end (FY2026 = period ending in 2026), as the
 * organization's Financial Summary card does. SEC's own fiscal_year field is the year of the filing
 * the figure appeared in, so prior-year comparatives in a 10-K all carry the newer year.
 */
export const yearOf = (p: InsightPoint) => Number(p.period_end.slice(0, 4))

/** The figure for a metric: a specific fiscal year, or the latest one when year is 'latest'. */
export function pointFor(org: InsightOrganization, metric: FinancialMetricKey, year: number | 'latest'): InsightPoint | null {
  const points = org.financials?.metrics?.[metric] || []
  if (!points.length) return null
  if (year === 'latest') {
    return [...points].sort((a, b) => (a.period_end < b.period_end ? 1 : -1))[0]
  }
  return points.filter((p) => yearOf(p) === year).sort((a, b) => (a.period_end < b.period_end ? 1 : -1))[0] || null
}

/** Fiscal years for which at least one organization has the metric. */
export function availableYears(orgs: InsightOrganization[], metric: FinancialMetricKey): number[] {
  const years = new Set<number>()
  orgs.forEach((o) => (o.financials?.metrics?.[metric] || []).forEach((p) => p.period_end && years.add(yearOf(p))))
  return [...years].sort((a, b) => b - a)
}

/** Metrics that at least one organization actually has. */
export function availableMetrics(orgs: InsightOrganization[]): FinancialMetricKey[] {
  return FINANCIAL_METRICS.map((m) => m.key).filter((k) => orgs.some((o) => (o.financials?.metrics?.[k] || []).length > 0))
}

export function formatMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const sym = currency === 'USD' ? '$' : `${currency} `
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${sym}${abs.toFixed(0)}`
}

export const HEALTH_LABELS: Record<string, string> = {
  strong: 'Strong',
  mixed: 'Mixed',
  weak: 'Weak',
  stale: 'Out of date',
  insufficient_data: 'Not enough data',
}

/** A stored location part, ignoring placeholder values like "Unknown". */
export const known = (v?: string | null) => (v && v.trim() && v.trim().toLowerCase() !== 'unknown' ? v.trim() : null)

export const locationOf = (o: { city?: string | null; state?: string | null; country?: string | null }) =>
  [known(o.city), known(o.state), known(o.country)].filter(Boolean).join(', ') || 'Location not recorded'
