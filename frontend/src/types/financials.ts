export interface FinancialPoint {
  period_end: string
  fiscal_year: number | null
  value: number
  concept: string
  form: string
  filed: string
  accession: string
  source_url: string
}

export type FinancialHealthLabel = 'strong' | 'mixed' | 'weak' | 'stale' | 'insufficient_data'

export interface FinancialHealth {
  label: FinancialHealthLabel
  reasons: string[]
  revenue_growth?: number | null
  net_margin?: number | null
  period_end?: string
}

export interface OrganizationFinancials {
  linked: boolean
  source?: string
  cik?: string
  entity_name?: string | null
  fetched_at?: string | null
  fetch_status?: 'ok' | 'error'
  fetch_error?: string | null
  data?: {
    entity_name: string | null
    currency: string
    dataset_url: string
    company_url: string
    metrics: Record<'revenue' | 'net_income' | 'total_assets' | 'total_liabilities' | 'cash', FinancialPoint[]>
  } | null
  health: FinancialHealth
}
