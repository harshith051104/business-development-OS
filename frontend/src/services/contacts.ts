import { api } from './api'
import type {
  Contact,
  ContactCreateInput,
  ContactUpdateInput,
  PaginatedContacts,
  ContactFilterParams,
  DuplicateContactCheckResult,
} from '../types/contact'

export const contactsService = {
  async getContacts(params?: ContactFilterParams): Promise<PaginatedContacts> {
    return api.get<PaginatedContacts>('/api/business-development/contacts', params)
  },

  async getContact(id: number | string): Promise<Contact> {
    return api.get<Contact>(`/api/business-development/contacts/${id}`)
  },

  async checkDuplicate(params: {
    email?: string
    phone?: string
    organization_id?: number
    first_name?: string
    last_name?: string
  }): Promise<DuplicateContactCheckResult> {
    return api.get<DuplicateContactCheckResult>('/api/business-development/contacts/check-duplicate', params)
  },

  async createContact(data: ContactCreateInput): Promise<Contact> {
    return api.post<Contact>('/api/business-development/contacts', data)
  },

  async updateContact(id: number | string, data: ContactUpdateInput): Promise<Contact> {
    return api.put<Contact>(`/api/business-development/contacts/${id}`, data)
  },

  async updateStatus(id: number | string, connection_status: string, note?: string): Promise<Contact> {
    return api.patch<Contact>(
      `/api/business-development/contacts/${id}/status`,
      { connection_status, note }
    )
  },

  async setPrimary(id: number | string): Promise<Contact> {
    return api.patch<Contact>(`/api/business-development/contacts/${id}/primary`)
  },

  async toggleDecisionMaker(id: number | string, is_decision_maker: boolean): Promise<Contact> {
    return api.patch<Contact>(
      `/api/business-development/contacts/${id}/decision-maker`,
      undefined
    )
  },

  async addNote(id: number | string, note: string): Promise<Contact> {
    return api.post<Contact>(
      `/api/business-development/contacts/${id}/notes`,
      { note }
    )
  },

  async deleteContact(id: number | string): Promise<{ status: string; message: string }> {
    return api.delete<{ status: string; message: string }>(
      `/api/business-development/contacts/${id}`
    )
  },

  async getOrganizationContacts(organizationId: number | string): Promise<Contact[]> {
    return api.get<Contact[]>(`/api/business-development/organizations/${organizationId}/contacts`)
  },
}
