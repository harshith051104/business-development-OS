import { api } from './api'
import type { ComprehensiveAnalytics } from '../types/analytics'

export const analyticsService = {
  getAnalytics: async (params: {
    date_range?: string
    start_date?: string
    end_date?: string
  } = {}): Promise<ComprehensiveAnalytics> => {
    return api.get<ComprehensiveAnalytics>(
      '/api/business-development/analytics/overview',
      params
    )
  },

  downloadCsvExport: async (params: {
    date_range?: string
    start_date?: string
    end_date?: string
  } = {}): Promise<void> => {
    const token = localStorage.getItem('elly_token') || sessionStorage.getItem('elly_token')
    const queryParams = new URLSearchParams()
    if (params.date_range) queryParams.append('date_range', params.date_range)
    if (params.start_date) queryParams.append('start_date', params.start_date)
    if (params.end_date) queryParams.append('end_date', params.end_date)

    const url = `http://127.0.0.1:8001/api/business-development/analytics/export?${queryParams.toString()}`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) {
      throw new Error('Failed to download CSV export.')
    }

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `bd_analytics_report_${new Date().toISOString().substring(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(downloadUrl)
  },
}
