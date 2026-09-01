import { api } from './api';
import type {
  Campaign,
  CampaignCreate,
  CampaignPreviewRequest,
  CampaignPreviewResponse,
  CampaignRoiFunnel,
} from '../types/campaign';

export const campaignService = {
  list: (params?: { status?: string; industry?: string }) =>
    api.get<Campaign[]>('/api/business-development/campaigns', params),

  get: (id: number) =>
    api.get<Campaign>(`/api/business-development/campaigns/${id}`),

  create: (data: CampaignCreate) =>
    api.post<Campaign>('/api/business-development/campaigns', data),

  update: (id: number, data: Partial<CampaignCreate>) =>
    api.put<Campaign>(`/api/business-development/campaigns/${id}`, data),

  delete: (id: number) =>
    api.delete(`/api/business-development/campaigns/${id}`),

  start: (id: number) =>
    api.post(`/api/business-development/campaigns/${id}/start`),

  pause: (id: number) =>
    api.post(`/api/business-development/campaigns/${id}/pause`),

  addContacts: (id: number, contact_ids: number[]) =>
    api.post(`/api/business-development/campaigns/${id}/contacts`, { contact_ids }),

  removeContact: (campaign_id: number, contact_id: number) =>
    api.delete(`/api/business-development/campaigns/${campaign_id}/contacts/${contact_id}`),

  preview: (campaign_id: number, contact_id: number, data: CampaignPreviewRequest) =>
    api.post<CampaignPreviewResponse>(`/api/business-development/campaigns/${campaign_id}/contacts/${contact_id}/preview`, data),

  sendStepEmail: (campaign_id: number, contact_id: number, payload: { subject: string; body_html: string }) =>
    api.post(`/api/business-development/campaigns/${campaign_id}/contacts/${contact_id}/send`, payload),

  pauseContact: (campaign_id: number, contact_id: number) =>
    api.post(`/api/business-development/campaigns/${campaign_id}/contacts/${contact_id}/pause`),

  resumeContact: (campaign_id: number, contact_id: number) =>
    api.post(`/api/business-development/campaigns/${campaign_id}/contacts/${contact_id}/resume`),

  simulateReply: (contact_id: number, payload?: { reply_subject?: string; reply_snippet?: string; campaign_id?: number }) =>
    api.post('/api/business-development/campaigns/simulate-reply', payload),

  getRoiFunnel: (campaignId: number) =>
    api.get<CampaignRoiFunnel>(`/api/business-development/campaigns/${campaignId}/roi`),

  createOpportunity: (campaignContactId: number, data?: { estimated_value?: number; custom_name?: string }) =>
    api.post<{ success: boolean; opportunity_id: number; opportunity_name: string; stage: string; is_new: boolean }>(
      `/api/business-development/campaigns/contacts/${campaignContactId}/create-opportunity`,
      data
    ),
};
