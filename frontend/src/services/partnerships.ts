import { api } from './api'
import type {
  Partnership,
  PaginatedPartnerships,
  PartnershipStats,
  PartnershipCreatePayload,
  ConvertOpportunityPayload,
} from '../types/partnership'

export const partnershipsService = {
  listPartnerships: async (params: {
    page?: number
    page_size?: number
    search?: string
    status?: string
    partnership_type?: string
    priority?: string
    organization_id?: number
    owner_id?: number
    project_id?: number
    needs_attention?: boolean
    ending_soon?: boolean
  } = {}): Promise<PaginatedPartnerships> => {
    return api.get<PaginatedPartnerships>('/api/business-development/partnerships', params)
  },

  getStats: async (): Promise<PartnershipStats> => {
    return api.get<PartnershipStats>('/api/business-development/partnerships/stats')
  },

  getPartnership: async (id: number): Promise<Partnership> => {
    return api.get<Partnership>(`/api/business-development/partnerships/${id}`)
  },

  createPartnership: async (payload: PartnershipCreatePayload): Promise<Partnership> => {
    return api.post<Partnership>('/api/business-development/partnerships', payload)
  },

  updatePartnership: async (id: number, payload: Partial<PartnershipCreatePayload>): Promise<Partnership> => {
    return api.patch<Partnership>(`/api/business-development/partnerships/${id}`, payload)
  },

  updateStatus: async (id: number, statusVal: string, notes?: string): Promise<Partnership> => {
    return api.patch<Partnership>(`/api/business-development/partnerships/${id}/status`, {
      status: statusVal,
      notes,
    })
  },

  updateOwner: async (id: number, ownerId: number | null): Promise<Partnership> => {
    return api.patch<Partnership>(`/api/business-development/partnerships/${id}/owner`, {
      owner_id: ownerId,
    })
  },

  deletePartnership: async (id: number): Promise<{ message: string; id: number }> => {
    return api.delete<{ message: string; id: number }>(`/api/business-development/partnerships/${id}`)
  },

  convertFromOpportunity: async (
    opportunityId: number,
    payload: ConvertOpportunityPayload
  ): Promise<Partnership> => {
    return api.post<Partnership>(
      `/api/business-development/opportunities/${opportunityId}/convert-to-partnership`,
      payload
    )
  },
}
