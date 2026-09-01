import { api } from './api'
import type {
  Communication,
  CommunicationCreateInput,
  CommunicationUpdateInput,
  PaginatedCommunications,
  CommunicationFilters,
  RelationshipTimeline,
} from '../types/communication'

export const communicationsService = {
  getCommunications: async (
    filters: CommunicationFilters = {}
  ): Promise<PaginatedCommunications> => {
    return api.get<PaginatedCommunications>(
      '/api/business-development/communications',
      filters
    )
  },

  getCommunication: async (id: number | string): Promise<Communication> => {
    return api.get<Communication>(`/api/business-development/communications/${id}`)
  },

  createCommunication: async (
    data: CommunicationCreateInput
  ): Promise<Communication> => {
    return api.post<Communication>(
      '/api/business-development/communications',
      data
    )
  },

  updateCommunication: async (
    id: number | string,
    data: CommunicationUpdateInput
  ): Promise<Communication> => {
    return api.patch<Communication>(
      `/api/business-development/communications/${id}`,
      data
    )
  },

  deleteCommunication: async (
    id: number | string
  ): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(
      `/api/business-development/communications/${id}`
    )
  },

  getRelationshipTimeline: async (params: {
    organization_id?: number
    contact_id?: number
    opportunity_id?: number
    limit?: number
  }): Promise<RelationshipTimeline> => {
    return api.get<RelationshipTimeline>(
      '/api/business-development/communications/timeline',
      params
    )
  },
}
