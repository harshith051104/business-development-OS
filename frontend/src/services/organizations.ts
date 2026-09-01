import { api } from './api'
import type {
  Organization,
  OrganizationCreateInput,
  OrganizationUpdateInput,
  PaginatedOrganizations,
  OrganizationFilterParams,
  DuplicateCheckResult,
} from '../types/organization'

export const organizationsService = {
  async getOrganizations(params?: OrganizationFilterParams): Promise<PaginatedOrganizations> {
    return api.get<PaginatedOrganizations>('/api/business-development/organizations', params)
  },

  async getOrganization(id: number | string): Promise<Organization> {
    return api.get<Organization>(`/api/business-development/organizations/${id}`)
  },

  async checkDuplicate(name: string): Promise<DuplicateCheckResult> {
    return api.get<DuplicateCheckResult>('/api/business-development/organizations/check-duplicate', {
      name,
    })
  },

  async createOrganization(data: OrganizationCreateInput): Promise<Organization> {
    return api.post<Organization>('/api/business-development/organizations', data)
  },

  async updateOrganization(id: number | string, data: OrganizationUpdateInput): Promise<Organization> {
    return api.put<Organization>(`/api/business-development/organizations/${id}`, data)
  },

  async updateStatus(id: number | string, status: string, note?: string): Promise<Organization> {
    return api.patch<Organization>(
      `/api/business-development/organizations/${id}/status`,
      { status, note }
    )
  },

  async updatePriority(id: number | string, priority: string): Promise<Organization> {
    return api.patch<Organization>(
      `/api/business-development/organizations/${id}/priority`,
      { priority }
    )
  },

  async addNote(id: number | string, note: string): Promise<Organization> {
    return api.post<Organization>(
      `/api/business-development/organizations/${id}/notes`,
      { note }
    )
  },

  async deleteOrganization(id: number | string): Promise<{ status: string; message: string }> {
    return api.delete<{ status: string; message: string }>(
      `/api/business-development/organizations/${id}`
    )
  },
}
