import { api } from './api';

export interface IntegrationStatus {
  system_name: string;
  available: boolean;
  mode: string;
  total_ingested_leads: number;
  last_sync_at?: string | null;
  supported_channels: string[];
}

export const integrationService = {
  getStatus: () =>
    api.get<IntegrationStatus[]>('/api/business-development/integrations/status'),
};
