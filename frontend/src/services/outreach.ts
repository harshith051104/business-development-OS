import { api } from './api'
import type {
  OutreachDraft,
  PaginatedOutreachDrafts,
  OutreachTemplate,
  OutreachRecordPayload,
  OutreachRecordResult,
} from '../types/outreach'

export const outreachService = {
  // ── Drafts ──
  listDrafts: async (params: {
    page?: number
    page_size?: number
    status?: string
    channel?: string
    organization_id?: number
  } = {}): Promise<PaginatedOutreachDrafts> => {
    return api.get<PaginatedOutreachDrafts>('/api/business-development/outreach/drafts', params)
  },

  getDraft: async (id: number): Promise<OutreachDraft> => {
    return api.get<OutreachDraft>(`/api/business-development/outreach/drafts/${id}`)
  },

  createDraft: async (payload: Partial<OutreachDraft>): Promise<OutreachDraft> => {
    return api.post<OutreachDraft>('/api/business-development/outreach/drafts', payload)
  },

  updateDraft: async (id: number, payload: Partial<OutreachDraft>): Promise<OutreachDraft> => {
    return api.patch<OutreachDraft>(`/api/business-development/outreach/drafts/${id}`, payload)
  },

  deleteDraft: async (id: number): Promise<void> => {
    return api.delete<void>(`/api/business-development/outreach/drafts/${id}`)
  },

  // ── Templates ──
  listTemplates: async (params: {
    category?: string
    channel?: string
    active_only?: boolean
  } = {}): Promise<OutreachTemplate[]> => {
    return api.get<OutreachTemplate[]>('/api/business-development/outreach/templates', params)
  },

  createTemplate: async (payload: Partial<OutreachTemplate>): Promise<OutreachTemplate> => {
    return api.post<OutreachTemplate>('/api/business-development/outreach/templates', payload)
  },

  updateTemplate: async (id: number, payload: Partial<OutreachTemplate>): Promise<OutreachTemplate> => {
    return api.patch<OutreachTemplate>(`/api/business-development/outreach/templates/${id}`, payload)
  },

  deleteTemplate: async (id: number): Promise<void> => {
    return api.delete<void>(`/api/business-development/outreach/templates/${id}`)
  },

  // ── Record Outreach ──
  recordAction: async (payload: OutreachRecordPayload): Promise<OutreachRecordResult> => {
    return api.post<OutreachRecordResult>('/api/business-development/outreach/record', payload)
  },
}
