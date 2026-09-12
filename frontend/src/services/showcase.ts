import { api } from './api'
import type {
  Project,
  PaginatedProjects,
  ProjectFilterParams,
  ShowcaseCategoriesResponse,
} from '../types/project'

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

  async uploadPresentation(projectId: number | string, file: File): Promise<Project> {
    const token = localStorage.getItem('elly_token') || sessionStorage.getItem('elly_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`http://127.0.0.1:8001/api/business-development/showcase/${projectId}/upload-presentation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
    const token = localStorage.getItem('elly_token') || sessionStorage.getItem('elly_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('http://127.0.0.1:8001/api/business-development/showcase/upload-presentation-file', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to upload presentation deck.')
    }
    return res.json()
  },
}

