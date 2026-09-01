import { api } from './api'
import type { DashboardResponse } from '../types/dashboard'

export const dashboardService = {
  async getDashboardData(): Promise<DashboardResponse> {
    return api.get<DashboardResponse>('/api/business-development/dashboard')
  },
}
