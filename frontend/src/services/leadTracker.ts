import { api } from './api';
import type {
  LeadTrackerBoardResponse,
  LeadTrackerFieldsResponse,
  LeadTrackerTeamProgress,
  LeadTrackerRow,
  LeadTrackerTimelineEvent,
} from '../types/leadTracker';

const BASE = '/api/business-development/lead-tracker';

export const leadTrackerService = {
  getFields: () => api.get<LeadTrackerFieldsResponse>(`${BASE}/fields`),

  getTeamProgress: (campaign_id?: number) =>
    api.get<LeadTrackerTeamProgress>(`${BASE}/team-progress`, { campaign_id }),

  getBoard: (params?: {
    campaign_id?: number;
    assigned_user_id?: number;
    search?: string;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_dir?: number;
  }) => api.get<LeadTrackerBoardResponse>(BASE, params),

  getRow: (id: number) => api.get<LeadTrackerRow>(`${BASE}/${id}`),

  updateCheckboxes: (id: number, updates: Record<string, any>) =>
    api.patch<LeadTrackerRow>(`${BASE}/${id}/checkboxes`, { updates }),

  getTimeline: (id: number, limit?: number) =>
    api.get<LeadTrackerTimelineEvent[]>(`${BASE}/${id}/timeline`, { limit }),

  addTimelineEvent: (id: number, event_type: string, description: string, metadata?: Record<string, any>) =>
    api.post<LeadTrackerTimelineEvent>(`${BASE}/${id}/timeline`, { event_type, description, metadata: metadata || {} }),

  syncSheet: () =>
    api.post<{ success: boolean; reason?: string; checked: number; updated: number; skipped_newer: number }>(
      `${BASE}/sync/pull`,
      {}
    ),
};
