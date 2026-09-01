export type ProjectCategory =
  | 'Healthcare'
  | 'Artificial Intelligence'
  | 'Data Science'
  | 'Automation'
  | 'Communication'
  | 'Business'
  | 'Web Platform'
  | 'Mobile Application'
  | 'Other'

export type ProjectStatus = 'Active' | 'Coming Soon' | 'Archived'

export interface ProjectImage {
  url: string
  caption?: string | null
}

export interface BusinessValue {
  problem_solved?: string | null
  target_audience?: string | null
  value_proposition?: string | null
  target_organizations?: string | null
}

export interface BusinessUseCase {
  title: string
  description: string
  target_outcome?: string | null
}

export interface Project {
  id: number
  name: string
  slug: string
  short_description: string
  description?: string
  category: ProjectCategory | string
  status: ProjectStatus | string
  thumbnail_url?: string | null
  images?: ProjectImage[]
  video_url?: string | null
  demo_url?: string | null
  website_url?: string | null
  repository_url?: string | null
  presentation_url?: string | null
  key_features?: string[]
  business_value?: BusinessValue
  business_use_cases?: BusinessUseCase[]
  tags?: string[]
  sort_order: number
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface PaginatedProjects {
  items: Project[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ProjectFilterParams {
  page?: number
  page_size?: number
  search?: string
  category?: string
  status?: string
  tag?: string
  is_featured?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ShowcaseCategoriesResponse {
  categories: string[]
  active_categories: string[]
  tags: string[]
}

export interface ProjectCreateInput {
  name: string
  slug?: string
  short_description: string
  description?: string
  category?: string
  status?: string
  thumbnail_url?: string
  video_url?: string
  demo_url?: string
  website_url?: string
  presentation_url?: string
  key_features?: string[]
  business_value?: BusinessValue
  business_use_cases?: BusinessUseCase[]
  tags?: string[]
  is_featured?: boolean
}

