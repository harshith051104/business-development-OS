export interface DiscoveredContact {
  id: number
  discovered_org_id: number
  full_name: string
  job_title: string
  seniority_level?: string | null
  department?: string | null
  business_relevance?: string | null

  email?: string | null
  email_status: 'unverified' | 'enriched' | 'unavailable'
  phone?: string | null
  linkedin_url?: string | null

  fit_level: 'High' | 'Medium' | 'Low'
  fit_reason?: string | null
  status: 'discovered' | 'saved' | 'added' | 'skipped'

  matched_existing_contact_id?: number | null
  is_existing_duplicate?: boolean
  existing_contact_name?: string | null

  created_at: string
}

export interface DiscoveredOrganization {
  id: number
  name: string
  organization_type: string
  country?: string | null
  state?: string | null
  city?: string | null
  address?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  description?: string | null

  product_description?: string | null
  target_icp?: string | null
  discovery_objective?: string | null

  source_type: string
  source_name: string
  source_url?: string | null

  status: 'discovered' | 'saved' | 'skipped' | 'added'
  potential_fit?: 'High' | 'Medium' | 'Low' | null
  potential_fit_score?: number
  qualification_reason?: string | null

  organization_id?: number | null
  discovered_by_id?: number | null

  is_existing_duplicate?: boolean
  existing_org_id?: number | null
  existing_org_name?: string | null

  contacts?: DiscoveredContact[]

  created_at: string
  updated_at: string
}

export interface PaginatedDiscovery {
  items: DiscoveredOrganization[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DiscoverySearchQuery {
  keyword?: string
  location?: string
  organization_type?: string
  industry?: string
  product_description?: string
  target_icp?: string
  discovery_objective?: string
  provider?: string
  page?: number
  page_size?: number
}

export interface ContactDiscoveryQuery {
  target_roles?: string[]
  limit?: number
}

export interface ProviderList {
  organization_providers: Array<{ name: string; type: string }>
  contact_providers: Array<{ name: string }>
  enrichment_providers: Array<{ name: string }>
}

export interface DiscoveryAddPayload {
  priority?: string
  notes?: string
  allow_duplicate?: boolean
  selected_contact_ids?: number[]
}

export interface DiscoveryHistoryItem {
  id: number
  user_id?: number | null
  user_name?: string | null
  query_keyword?: string | null
  location?: string | null
  organization_type?: string | null
  product_description?: string | null
  target_icp?: string | null
  discovery_objective?: string | null
  provider_used: string
  results_count: number
  contacts_found?: number
  timestamp: string
}

export interface DiscoveryPromptParseOut {
  keyword?: string | null
  location?: string | null
  organization_type?: string | null
  product_description?: string | null
  target_icp?: string | null
  discovery_objective?: string | null
  extracted_summary?: string | null
}

export interface DiscoveryStats {
  total_discovered: number
  total_added: number
  total_saved: number
  total_skipped: number
  total_imported: number
  conversion_rate?: number | null
  is_sufficient_data: boolean
}

export interface CsvImportRowValidation {
  row_number: number
  name: string
  organization_type: string
  website?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  is_valid: boolean
  is_duplicate: boolean
  existing_org_name?: string | null
  errors?: string[]
  error_message?: string | null
}

export interface CsvImportPreview {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  duplicate_rows: number
  valid_rows_count?: number
  invalid_rows_count?: number
  duplicate_rows_count?: number
  rows: CsvImportRowValidation[]
  preview_rows?: CsvImportRowValidation[]
}

export interface CsvImportResult {
  imported_count: number
  imported_ids?: number[]
  skipped_count: number
  duplicate_count?: number
  invalid_count?: number
  errors: string[]
}

// Phase 19: Research & Intelligence types
export interface ResearchSignal {
  type: string
  description: string
  source_url?: string
  confidence: number
  category: string
}

export interface QualificationFactor {
  factor: string
  weight: number
  score: number
  reason: string
}

export interface QualificationResult {
  score: number
  tier: 'High' | 'Medium' | 'Low'
  confidence: number
  factors: QualificationFactor[]
  positive_signals: string[]
  negative_signals: string[]
  missing_information: string[]
}

export interface ResearchBrief {
  organization_name: string
  fit_score: number
  priority: string
  company_overview: string
  what_they_do: string
  why_contact: string
  potential_elly_opportunity: string
  best_contact_role: string
  recommended_approach: string
  business_signals: string[]
  technology_signals: string[]
  recommended_showcase_projects: string[]
  risks_and_unknowns: string[]
  sources: string[]
}

export interface ProjectMatch {
  project_name: string
  project_id: number
  relevance_score: number
  match_reason: string
  category: string
}

export interface ResearchResult {
  research?: Record<string, any>
  brief?: ResearchBrief
  matched_projects?: ProjectMatch[]
  research_status?: string
  error?: string
}

export interface DiscoveryIntelligenceAnalytics {
  leads_discovered: number
  leads_qualified: number
  high_fit_leads: number
  research_completed: number
  decision_makers_found: number
  verified_contacts: number
  leads_added_to_crm: number
  leads_rejected: number
  duplicate_rate: number
  source_performance: Record<string, { total: number; high_fit: number }>
  average_qualification_score: number
  conversion_rate: number
}

// Phase 20: Enrichment & Provider Health types
export interface EnrichedContact {
  name: string
  role: string
  organization: string
  email: string | null
  email_status: string
  phone: string | null
  linkedin_url: string | null
  confidence: number
  source: string
  verification_state: string
  provider_used: string
  error: string | null
}

export interface EnrichmentResult {
  contacts: EnrichedContact[]
  provider: string
  available: boolean
  error: string | null
  credits_remaining: number | null
}

export interface ProviderHealth {
  name: string
  status: string
  configured: boolean
  last_checked: number
  last_error: string | null
  latency_ms: number | null
}

export interface HybridQualificationResult {
  deterministic_score: number
  deterministic_tier: string
  deterministic_confidence: number
  deterministic_factors: QualificationFactor[]
  positive_signals: string[]
  negative_signals: string[]
  missing_information: string[]
  llm_score: number | null
  llm_confidence: number | null
  final_score: number
  final_tier: string
  confidence: number
  recommended_contact_roles: string[]
  recommended_ellly_capabilities: string[]
  reasons: string[]
  source: string
  error: string | null
}

export interface CachedResearch {
  organization: string
  domain: string
  research_status: string
  research_date: string
  research_version: string
  source_urls: string[]
  signals: Record<string, any>
  qualification: Record<string, any>
  decision_makers: any[]
  provider_used: string
  error: string | null
}
