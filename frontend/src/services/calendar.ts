import { api } from './api'

export interface CalendarEvent {
  id: number
  title: string
  start: string
  end?: string
  description?: string
  location?: string
  meeting_type?: string
  status: string
  organization_name?: string
  contact_names: string[]
  meeting_url?: string
}

export interface TimeSlot {
  time: string
  hour: number
  available: boolean
}

export const calendarService = {
  async getEvents(params?: { start_date?: string; end_date?: string; status?: string }): Promise<CalendarEvent[]> {
    return api.get<CalendarEvent[]>('/api/calendar/events', params)
  },

  async getTodayEvents(): Promise<CalendarEvent[]> {
    return api.get<CalendarEvent[]>('/api/calendar/today')
  },

  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    return api.get<CalendarEvent[]>('/api/calendar/upcoming', { days })
  },

  async syncToGoogle(meetingId: number): Promise<any> {
    return api.post<any>(`/api/calendar/sync-to-google/${meetingId}`)
  },

  async checkAvailability(date: string): Promise<{ date: string; slots: TimeSlot[] }> {
    return api.get<{ date: string; slots: TimeSlot[] }>('/api/calendar/availability', { date })
  },
}
