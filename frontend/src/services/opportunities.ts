import { api } from './api'
import type {
  Opportunity,
  OpportunityCreateInput,
  OpportunityUpdateInput,
  PaginatedOpportunities,
  OpportunityFilters,
} from '../types/opportunity'

export const opportunitiesService = {
  getOpportunities: async (
    filters: OpportunityFilters = {}
  ): Promise<PaginatedOpportunities> => {
    return api.get<PaginatedOpportunities>(
      '/api/business-development/opportunities',
      filters
    )
  },

  getOpportunity: async (id: number | string): Promise<Opportunity> => {
    return api.get<Opportunity>(`/api/business-development/opportunities/${id}`)
  },

  createOpportunity: async (data: OpportunityCreateInput): Promise<Opportunity> => {
    return api.post<Opportunity>('/api/business-development/opportunities', data)
  },

  updateOpportunity: async (
    id: number | string,
    data: OpportunityUpdateInput
  ): Promise<Opportunity> => {
    return api.patch<Opportunity>(
      `/api/business-development/opportunities/${id}`,
      data
    )
  },

  updateStage: async (
    id: number | string,
    stage: string,
    note?: string
  ): Promise<Opportunity> => {
    return api.patch<Opportunity>(
      `/api/business-development/opportunities/${id}/stage`,
      { stage, note }
    )
  },

  updateOwner: async (
    id: number | string,
    owner_id: number,
    note?: string
  ): Promise<Opportunity> => {
    return api.patch<Opportunity>(
      `/api/business-development/opportunities/${id}/owner`,
      { owner_id, note }
    )
  },

  addNote: async (id: number | string, note: string): Promise<Opportunity> => {
    return api.post<Opportunity>(
      `/api/business-development/opportunities/${id}/notes`,
      { note }
    )
  },

  deleteOpportunity: async (
    id: number | string
  ): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(
      `/api/business-development/opportunities/${id}`
    )
  },
}
