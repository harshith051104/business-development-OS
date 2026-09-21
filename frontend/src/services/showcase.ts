import { api } from './api'
import type {
  Project,
  PaginatedProjects,
  ProjectFilterParams,
  ShowcaseCategoriesResponse,
} from '../types/project'

const API_BASE = import.meta.env.VITE_API_URL || ''

function getAuthToken(): string {
  return (
    localStorage.getItem('elly_bd_auth_token') ||
    localStorage.getItem('elly_token') ||
    sessionStorage.getItem('elly_token') ||
    ''
  )
}

export const showcaseService = {
  async getProjects(params?: ProjectFilterParams): Promise<PaginatedProjects> {
    return api.get<PaginatedProjects>('/api/business-development/showcase', params)
  },

  async getProject(id: number | string): Promise<Project> {
    return api.get<Project>(`/api/business-development/showcase/${id}`)
  },

  async getCategoriesAndTags(): Promise<ShowcaseCategoriesResponse> {
    return api.get<ShowcaseCategoriesResponse>('/api/business-development/showcase/categories')
  },

  async createProject(payload: any): Promise<Project> {
    return api.post<Project>('/api/business-development/showcase', payload)
  },

  async updateProject(id: number | string, payload: any): Promise<Project> {
    return api.put<Project>(`/api/business-development/showcase/${id}`, payload)
  },

  async deleteProject(id: number | string): Promise<{ message: string; id: number }> {
    return api.delete<{ message: string; id: number }>(`/api/business-development/showcase/${id}`)
  },

  async uploadPresentation(projectId: number | string, file: File): Promise<Project> {
    const token = getAuthToken()
    const formData = new FormData()
    formData.append('file', file)

    const url = `${API_BASE}/api/business-development/showcase/${projectId}/upload-presentation`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to upload presentation deck.')
    }
    return res.json()
  },

  async uploadPresentationFile(file: File): Promise<{
    status: string
    filename: string
    presentation_url: string
    file_type: string
    file_size: number
  }> {
    const token = getAuthToken()
    const formData = new FormData()
    formData.append('file', file)

    const url = `${API_BASE}/api/business-development/showcase/upload-presentation-file`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to upload presentation deck.')
    }
    return res.json()
  },

  async getProjectSlides(projectId: number | string): Promise<{
    has_presentation: boolean
    file_type: string | null
    filename: string | null
    presentation_url: string | null
    exact_pdf_url?: string | null
    slide_count: number
    slides: Array<{
      slide_number: number
      title: string
      blocks: Array<{ type: string; lines: string[] }>
      tables: string[][][]
      images: string[]
    }>
  }> {
    const token = getAuthToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const url = `${API_BASE}/api/business-development/showcase/${projectId}/slides`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to fetch presentation slides.')
    }
    return res.json()
  },
}
