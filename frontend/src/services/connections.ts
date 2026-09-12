import { api } from './api'
import type { KanbanBoard } from '../types/opportunity'

export const connectionsService = {
  getKanbanPipeline: async (params?: {
    search?: string
    priority?: string
  }): Promise<KanbanBoard> => {
    return api.get<KanbanBoard>('/api/business-development/connections/pipeline', params)
  },

  moveStage: async (
    organizationId: number,
    newStage: string,
    note?: string
  ): Promise<{ status: string; message: string; organization_id: number; new_stage: string }> => {
    return api.post<{
      status: string
      message: string
      organization_id: number
      new_stage: string
    }>('/api/business-development/connections/move-stage', {
      organization_id: organizationId,
      new_stage: newStage,
      note,
    })
  },

  autoSync: async (): Promise<{ status: string; updated_count: number; message: string }> => {
    return api.post<{ status: string; updated_count: number; message: string }>(
      '/api/business-development/connections/auto-sync',
      {}
    )
  },
}
