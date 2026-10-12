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

  sendOutreach: async (payload: {
    organization_ids: number[]
    template?: string
    use_ai_template?: boolean
    campaign_name?: string
  }): Promise<SendFundingOutreachResult> => {
    return api.post<SendFundingOutreachResult>('/api/business-development/funding/send', payload)
  },
}
