import { api } from './api'
import type {
  FollowUp,
  FollowUpCreateInput,
  FollowUpUpdateInput,
  PaginatedFollowUps,
  GroupedFollowUps,
  FollowUpFilters,
} from '../types/followup'

export const followupsService = {
  getFollowUps: async (filters: FollowUpFilters = {}): Promise<PaginatedFollowUps> => {
    return api.get<PaginatedFollowUps>('/api/business-development/followups', filters)
  },

  getGroupedFollowUps: async (
    scope: { organization_id?: number; contact_id?: number } = {}
  ): Promise<GroupedFollowUps> => {
    return api.get<GroupedFollowUps>('/api/business-development/followups/grouped', scope)
  },

  getFollowUp: async (id: number | string): Promise<FollowUp> => {
    return api.get<FollowUp>(`/api/business-development/followups/${id}`)
  },

  createFollowUp: async (data: FollowUpCreateInput): Promise<FollowUp> => {
    return api.post<FollowUp>('/api/business-development/followups', data)
  },

  updateFollowUp: async (id: number | string, data: FollowUpUpdateInput): Promise<FollowUp> => {
    return api.patch<FollowUp>(`/api/business-development/followups/${id}`, data)
  },

  completeFollowUp: async (id: number | string): Promise<FollowUp> => {
    return api.post<FollowUp>(
      `/api/business-development/followups/${id}/complete`
    )
  },

  cancelFollowUp: async (id: number | string, reason?: string): Promise<FollowUp> => {
    return api.post<FollowUp>(`/api/business-development/followups/${id}/cancel`, {
      reason,
    })
  },

  deleteFollowUp: async (id: number | string): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(
      `/api/business-development/followups/${id}`
    )
  },
}
