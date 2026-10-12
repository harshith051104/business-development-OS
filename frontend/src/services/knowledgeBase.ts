import { api } from './api'
import type { KBDocument, KBSearchResult } from '../types/knowledgeBase'

const API_BASE = import.meta.env.VITE_API_URL || ''

function getAuthToken(): string {
  return localStorage.getItem('elly_bd_auth_token') || ''
}

export const knowledgeBaseService = {
  list: () => api.get<KBDocument[]>('/api/business-development/knowledge-base'),

  search: (q: string, limit = 5) =>
    api.get<KBSearchResult[]>('/api/business-development/knowledge-base/search', { q, limit }),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/api/business-development/knowledge-base/${id}`),

  async upload(title: string, file: File): Promise<KBDocument> {
    const token = getAuthToken()
    const formData = new FormData()
    formData.append('title', title)
    formData.append('file', file)

    const url = `${API_BASE}/api/business-development/knowledge-base`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to upload document.')
    }
    return res.json()
  },
}
