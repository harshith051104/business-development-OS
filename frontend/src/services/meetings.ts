import { api } from './api'
import type {
  Meeting,
  MeetingCreateInput,
  MeetingUpdateInput,
  MeetingCompleteInput,
  MeetingRescheduleInput,
  PaginatedMeetings,
  MeetingFilters,
} from '../types/meeting'

export const meetingsService = {
  getMeetings: async (filters: MeetingFilters = {}): Promise<PaginatedMeetings> => {
    return api.get<PaginatedMeetings>('/api/business-development/meetings', filters)
  },

  getMeeting: async (id: number | string): Promise<Meeting> => {
    return api.get<Meeting>(`/api/business-development/meetings/${id}`)
  },

  createMeeting: async (data: MeetingCreateInput): Promise<Meeting> => {
    return api.post<Meeting>('/api/business-development/meetings', data)
  },

  updateMeeting: async (id: number | string, data: MeetingUpdateInput): Promise<Meeting> => {
    return api.put<Meeting>(`/api/business-development/meetings/${id}`, data)
  },

  completeMeeting: async (id: number | string, data: MeetingCompleteInput): Promise<Meeting> => {
    return api.post<Meeting>(
      `/api/business-development/meetings/${id}/complete`,
      data
    )
  },

  rescheduleMeeting: async (
    id: number | string,
    data: MeetingRescheduleInput
  ): Promise<Meeting> => {
    return api.post<Meeting>(
      `/api/business-development/meetings/${id}/reschedule`,
      data
    )
  },

  cancelMeeting: async (id: number | string, reason?: string): Promise<Meeting> => {
    return api.post<Meeting>(`/api/business-development/meetings/${id}/cancel`, {
      reason,
    })
  },

  deleteMeeting: async (id: number | string): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(
      `/api/business-development/meetings/${id}`
    )
  },
}
