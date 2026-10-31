import { api } from './api';
import type {
  LeadTrackerBoardResponse,
  LeadTrackerFieldsResponse,
  LeadTrackerTeamProgress,
  LeadTrackerRow,
  LeadTrackerTimelineEvent,
  TrackerUser,
  CreateLeadPayload,
} from '../types/leadTracker';

const BASE = '/api/business-development/lead-tracker';

export const leadTrackerService = {
  getFields: () => api.get<LeadTrackerFieldsResponse>(`${BASE}/fields`),

  getTeamProgress: (campaign_id?: number) =>
    api.get<LeadTrackerTeamProgress>(`${BASE}/team-progress`, { campaign_id }),

  getBoard: (params?: {
    campaign_id?: number;
    assigned_user_id?: number;
    assigned_user?: string;
    status?: string;
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

  triggerPullSync: () =>
    api.post<{ success: boolean; reason?: string; checked: number; updated: number; message?: string }>(
      `${BASE}/sync/pull`,
      {}
    ),

  triggerPushSync: () =>
    api.post<{ success: boolean; message: string; pushed: number }>(
      `${BASE}/sync/push`,
      {}
    ),

  getUsers: () => api.get<TrackerUser[]>(`${BASE}/users`),

  createUser: (data: { name: string; display_name?: string; email: string; password?: string; role?: string }) =>
    api.post<TrackerUser>(`${BASE}/users`, data),

  updateUser: (userId: string | number, updates: { name?: string; display_name?: string; email?: string; role?: string }) =>
    api.patch<TrackerUser>(`${BASE}/users/${userId}`, updates),

  deleteUser: (userId: string | number) =>
    api.delete<{ message: string }>(`${BASE}/users/${userId}`),

  createLead: (data: CreateLeadPayload) =>
    api.post<LeadTrackerRow>(`${BASE}/leads`, data),

  deleteLead: (id: number) =>
    api.delete<{ message: string }>(`${BASE}/${id}`),
};

