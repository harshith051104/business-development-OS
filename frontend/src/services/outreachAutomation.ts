import { api } from './api'

export interface WhatsappSettings {
  campaign_id: number
  template: string
  merge_fields: string[]
}

export interface LinkedinSettings {
  campaign_id: number
  connection_note: string
  first_message: string
  merge_fields: string[]
}

export const outreachAutomationService = {
  getWhatsappSettings: (campaignId: number): Promise<WhatsappSettings> =>
    api.get<WhatsappSettings>(`/api/business-development/whatsapp-automation/settings/${campaignId}`),

  updateWhatsappSettings: (campaignId: number, template: string): Promise<WhatsappSettings> =>
    api.patch<WhatsappSettings>(`/api/business-development/whatsapp-automation/settings/${campaignId}`, { template }),

  getWhatsappQueueCount: (campaignId: number): Promise<number> =>
    api
      .get<{ count: number }>(`/api/business-development/whatsapp-automation/queue?campaign_id=${campaignId}&limit=1`)
      .then((r) => r.count),

  getLinkedinSettings: (campaignId: number): Promise<LinkedinSettings> =>
    api.get<LinkedinSettings>(`/api/business-development/linkedin-automation/settings/${campaignId}`),

  updateLinkedinSettings: (
    campaignId: number,
    connection_note: string,
    first_message: string
  ): Promise<LinkedinSettings> =>
    api.patch<LinkedinSettings>(`/api/business-development/linkedin-automation/settings/${campaignId}`, {
      connection_note,
      first_message,
    }),

  getLinkedinQueueCount: (campaignId: number): Promise<number> =>
    api
      .get<{ count: number }>(`/api/business-development/linkedin-automation/queue?campaign_id=${campaignId}&limit=1`)
      .then((r) => r.count),
}
