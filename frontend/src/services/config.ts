import { api } from './api'

export interface DropdownConfig {
  organization_types: string[]
  connection_statuses: string[]
  partnership_types: string[]
  partnership_statuses: string[]
  meeting_types: string[]
  meeting_statuses: string[]
  priority_levels: string[]
  channels: string[]
  project_categories: string[]
  showcase_categories: string[]
  directions: string[]
  communication_statuses: string[]
  outreach_stages: string[]
  followup_durations: string[]
  roles: string[]
  industry_types: string[]
}

let cachedConfig: DropdownConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const configService = {
  async getDropdowns(): Promise<DropdownConfig> {
    const now = Date.now()
    if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
      return cachedConfig
    }
    const data = await api.get<DropdownConfig>('/api/config/dropdowns')
    cachedConfig = data
    cacheTimestamp = now
    return data
  },

  invalidateCache() {
    cachedConfig = null
    cacheTimestamp = 0
  },
}
