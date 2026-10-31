import { api } from './api'

export interface InvestorSearchResult {
  name: string
  status: 'added' | 'already_discovered'
  discovered_org_id: number
  organization_id: number | null
  website?: string | null
  potential_fit?: string | null
}

export interface InvestorContact {
  id: number
  full_name: string
  job_title: string
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  fit_level?: string
  fit_reason?: string | null
}

export interface SendFundingOutreachResult {
  campaign_id: number
  sent: number
  failed: number
  results: Array<{
    organization_id: number
    contact_id?: number
    success: boolean
    error?: string
  }>
}

export const fundingService = {
  searchInvestors: async (payload: {
    sector?: string
    stage?: string
    location?: string
    limit?: number
  }): Promise<InvestorSearchResult[]> => {
    return api.post<InvestorSearchResult[]>('/api/business-development/funding/search', payload)
  },

  findContacts: async (discoveredOrgId: number, roles?: string): Promise<InvestorContact[]> => {
    return api.post<InvestorContact[]>('/api/business-development/funding/contacts/search', {
      discovered_org_id: discoveredOrgId,
      roles: roles || undefined,
    })
  },

  exportCsv: async (payload: {
    sector?: string
    stage?: string
    location?: string
    limit?: number
  }): Promise<Blob> => {
    const params = new URLSearchParams()
    if (payload.sector) params.set('sector', payload.sector)
    if (payload.stage) params.set('stage', payload.stage)
    if (payload.location) params.set('location', payload.location)
    if (payload.limit) params.set('limit', String(payload.limit))
    const token = localStorage.getItem('elly_bd_auth_token')
    const base = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${base}/api/business-development/funding/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Export failed. Please try again.')
    return res.blob()
  },

  sendOutreach: async (payload: {
    organization_ids: number[]
    template?: string
    use_ai_template?: boolean
    campaign_name?: string
  }): Promise<SendFundingOutreachResult> => {
    return api.post<SendFundingOutreachResult>('/api/business-development/funding/send', payload)
  },
}
