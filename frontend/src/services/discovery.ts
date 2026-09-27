import { api } from './api'
import type {
  DiscoveredOrganization,
  DiscoveredContact,
  PaginatedDiscovery,
  DiscoverySearchQuery,
  ContactDiscoveryQuery,
  ProviderList,
  DiscoveryAddPayload,
  DiscoveryHistoryItem,
  DiscoveryPromptParseOut,
  DiscoveryStats,
  CsvImportPreview,
  CsvImportRowValidation,
  CsvImportResult,
  ResearchResult,
  QualificationResult,
  ResearchBrief,
  DiscoveryIntelligenceAnalytics,
  EnrichmentResult,
  ProviderHealth,
  CachedResearch,
} from '../types/discovery'
import type { Organization } from '../types/organization'

export const discoveryService = {
  search: async (payload: DiscoverySearchQuery): Promise<PaginatedDiscovery> => {
    return api.post<PaginatedDiscovery>('/api/business-development/discover/search', payload)
  },

  list: async (params: {
    status?: string
    organization_type?: string
    potential_fit?: string
    location?: string
    search?: string
    page?: number
    page_size?: number
  } = {}): Promise<PaginatedDiscovery> => {
    return api.get<PaginatedDiscovery>('/api/business-development/discover/list', params)
  },

  getById: async (id: number): Promise<DiscoveredOrganization> => {
    return api.get<DiscoveredOrganization>(`/api/business-development/discover/${id}`)
  },

  discoverContacts: async (
    id: number,
    payload: ContactDiscoveryQuery = {}
  ): Promise<DiscoveredContact[]> => {
    return api.post<DiscoveredContact[]>(`/api/business-development/discover/${id}/contacts/search`, payload)
  },

  enrichContact: async (
    id: number,
    contactId: number
  ): Promise<DiscoveredContact> => {
    return api.post<DiscoveredContact>(`/api/business-development/discover/${id}/contacts/${contactId}/enrich`, {})
  },

  save: async (id: number): Promise<DiscoveredOrganization> => {
    return api.post<DiscoveredOrganization>(`/api/business-development/discover/${id}/save`, {})
  },

  skip: async (id: number): Promise<DiscoveredOrganization> => {
    return api.post<DiscoveredOrganization>(`/api/business-development/discover/${id}/skip`, {})
  },

  qualify: async (
    id: number,
    payload: { potential_fit: string; qualification_reason?: string }
  ): Promise<DiscoveredOrganization> => {
    return api.post<DiscoveredOrganization>(`/api/business-development/discover/${id}/qualify`, payload)
  },

  addToOrganizations: async (
    id: number,
    payload: DiscoveryAddPayload = {}
  ): Promise<Organization> => {
    return api.post<Organization>(`/api/business-development/discover/${id}/add`, payload)
  },

  getSaved: async (params: { page?: number; page_size?: number } = {}): Promise<PaginatedDiscovery> => {
    return api.get<PaginatedDiscovery>('/api/business-development/discover/saved', params)
  },

  getProviders: async (): Promise<ProviderList> => {
    return api.get<ProviderList>('/api/business-development/discover/providers')
  },

  getHistory: async (limit: number = 10): Promise<DiscoveryHistoryItem[]> => {
    return api.get<DiscoveryHistoryItem[]>('/api/business-development/discover/history', { limit })
  },

  getHistoryResults: async (
    historyId: number,
    params: { page?: number; page_size?: number } = {}
  ): Promise<PaginatedDiscovery> => {
    return api.get<PaginatedDiscovery>(`/api/business-development/discover/history/${historyId}/results`, params)
  },

  parsePrompt: async (prompt: string): Promise<DiscoveryPromptParseOut> => {
    return api.post<DiscoveryPromptParseOut>('/api/business-development/discover/parse-prompt', { prompt })
  },

  getStats: async (): Promise<DiscoveryStats> => {
    return api.get<DiscoveryStats>('/api/business-development/discover/stats')
  },

  getExportUrl: (status?: string, potential_fit?: string): string => {
    const token = localStorage.getItem('elly_token') || sessionStorage.getItem('elly_token')
    const params = new URLSearchParams()
    if (status && status !== 'All') params.append('status', status)
    if (potential_fit && potential_fit !== 'All') params.append('potential_fit', potential_fit)
    return `/api/business-development/discover/export?${params.toString()}`
  },

  previewCsv: async (file: File): Promise<CsvImportPreview> => {
    const token = localStorage.getItem('elly_token') || sessionStorage.getItem('elly_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/business-development/discover/import/preview', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to preview CSV import file.')
    }
    return res.json()
  },

  executeCsvImport: async (payload: {
    rows: CsvImportRowValidation[]
    skip_duplicates?: boolean
  }): Promise<CsvImportResult> => {
    return api.post<CsvImportResult>('/api/business-development/discover/import/execute', payload)
  },

  // Phase 19: Research & Intelligence
  research: async (id: number, forceRefresh: boolean = false): Promise<ResearchResult> => {
    const params = forceRefresh ? '?force_refresh=true' : ''
    return api.post<ResearchResult>(
      `/api/business-development/discover/${id}/research${params}`,
      {}
    )
  },

  getBrief: async (id: number): Promise<ResearchBrief> => {
    return api.get<ResearchBrief>(`/api/business-development/discover/${id}/brief`)
  },

  reQualify: async (id: number): Promise<QualificationResult> => {
    return api.post<QualificationResult>(`/api/business-development/discover/${id}/qualify`, {})
  },

  getDecisionMakers: async (id: number, roles?: string[]): Promise<DiscoveredContact[]> => {
    const params = roles && roles.length > 0 ? `?roles=${roles.join(',')}` : ''
    return api.post<DiscoveredContact[]>(
      `/api/business-development/discover/${id}/decision-makers${params}`,
      {}
    )
  },

  getIntelligenceAnalytics: async (): Promise<DiscoveryIntelligenceAnalytics> => {
    return api.get<DiscoveryIntelligenceAnalytics>('/api/business-development/discover/analytics/intelligence')
  },

  // Phase 20: Enrichment & Provider Health
  enrichContacts: async (id: number, contacts: Array<{ name: string; role: string }>): Promise<EnrichmentResult> => {
    return api.post<EnrichmentResult>(
      `/api/business-development/discover/${id}/enrich`,
      contacts
    )
  },

  getProviderHealth: async (): Promise<Record<string, ProviderHealth>> => {
    return api.get<Record<string, ProviderHealth>>('/api/business-development/discover/providers/health')
  },

  getCachedResearch: async (id: number): Promise<CachedResearch> => {
    return api.get<CachedResearch>(`/api/business-development/discover/${id}/research/cache`)
  },

  invalidateResearchCache: async (id: number): Promise<{ invalidated: number; organization: string }> => {
    return api.delete<{ invalidated: number; organization: string }>(
      `/api/business-development/discover/${id}/research/cache`
    )
  },
}
