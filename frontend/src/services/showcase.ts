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
}
