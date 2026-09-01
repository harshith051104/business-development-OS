import { api } from './api'
import type {
  AdminUser,
  AdminUserDetail,
  PaginatedAdminUsers,
  AdminTeamList,
  AdminDashboardStats,
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  BulkAssignmentPayload,
  BulkAssignmentResult,
  SystemSettings,
  SystemSettingsUpdatePayload,
} from '../types/admin'
import type { Project, PaginatedProjects, ProjectCreateInput } from '../types/project'
import type { PaginatedAuditLogs } from '../types/audit'

export const adminService = {
  getDashboardStats: async (): Promise<AdminDashboardStats> => {
    return api.get<AdminDashboardStats>('/api/admin/dashboard')
  },

  listUsers: async (params: {
    page?: number
    page_size?: number
    search?: string
    role?: string
    is_active?: boolean
  } = {}): Promise<PaginatedAdminUsers> => {
    return api.get<PaginatedAdminUsers>('/api/admin/users', params)
  },

  getUserDetail: async (id: number): Promise<AdminUserDetail> => {
    return api.get<AdminUserDetail>(`/api/admin/users/${id}`)
  },

  createUser: async (payload: AdminUserCreatePayload): Promise<AdminUser> => {
    return api.post<AdminUser>('/api/admin/users', payload)
  },

  updateUser: async (id: number, payload: AdminUserUpdatePayload): Promise<AdminUser> => {
    return api.patch<AdminUser>(`/api/admin/users/${id}`, payload)
  },

  updateUserStatus: async (id: number, isActive: boolean): Promise<AdminUser> => {
    return api.patch<AdminUser>(`/api/admin/users/${id}/status`, { is_active: isActive })
  },

  updateUserRole: async (id: number, role: string): Promise<AdminUser> => {
    return api.patch<AdminUser>(`/api/admin/users/${id}/role`, { role })
  },

  getTeam: async (): Promise<AdminTeamList> => {
    return api.get<AdminTeamList>('/api/admin/team')
  },

  assignOrganizationOwner: async (orgId: number, ownerId: number | null): Promise<any> => {
    return api.patch(`/api/admin/organizations/${orgId}/owner`, { owner_id: ownerId })
  },

  assignOpportunityOwner: async (oppId: number, ownerId: number | null): Promise<any> => {
    return api.patch(`/api/admin/opportunities/${oppId}/owner`, { owner_id: ownerId })
  },

  assignPartnershipOwner: async (partnershipId: number, ownerId: number | null): Promise<any> => {
    return api.patch(`/api/admin/partnerships/${partnershipId}/owner`, { owner_id: ownerId })
  },

  bulkAssign: async (payload: BulkAssignmentPayload): Promise<BulkAssignmentResult> => {
    return api.post<BulkAssignmentResult>('/api/admin/assignments/bulk', payload)
  },

  listShowcaseProjects: async (params: {
    page?: number
    page_size?: number
    search?: string
    status?: string
    category?: string
  } = {}): Promise<PaginatedProjects> => {
    return api.get<PaginatedProjects>('/api/admin/showcase', params)
  },

  createShowcaseProject: async (payload: ProjectCreateInput): Promise<Project> => {
    return api.post<Project>('/api/admin/showcase', payload)
  },

  updateShowcaseProject: async (id: number, payload: Partial<ProjectCreateInput>): Promise<Project> => {
    return api.patch<Project>(`/api/admin/showcase/${id}`, payload)
  },

  updateShowcaseProjectStatus: async (id: number, status: string): Promise<Project> => {
    return api.patch<Project>(`/api/admin/showcase/${id}/status`, { status })
  },

  deleteShowcaseProject: async (id: number): Promise<{ message: string; id: number }> => {
    return api.delete<{ message: string; id: number }>(`/api/admin/showcase/${id}`)
  },

  getAuditLogs: async (params: {
    page?: number
    page_size?: number
    action?: string
    resource_type?: string
    user_email?: string
    search?: string
    start_date?: string
    end_date?: string
  } = {}): Promise<PaginatedAuditLogs> => {
    return api.get<PaginatedAuditLogs>('/api/admin/audit-logs', params)
  },

  getSettings: async (): Promise<SystemSettings> => {
    return api.get<SystemSettings>('/api/admin/settings')
  },

  updateSettings: async (payload: SystemSettingsUpdatePayload): Promise<SystemSettings> => {
    return api.patch<SystemSettings>('/api/admin/settings', payload)
  },
}
