import { api, ApiError } from './api'

const API_BASE = import.meta.env.VITE_API_URL || ''

export interface LeadUploadPreview {
  upload_id: string
  filename: string
  headers: string[]
  total_rows: number
  preview_rows: Record<string, string>[]
  suggested_mapping: Record<string, string | null>
  target_fields: string[]
}

export interface LeadImportResult {
  batch_id: number
  filename: string
  total_rows: number
  organizations_created: number
  organizations_matched: number
  contacts_created: number
  contacts_matched: number
  skipped_count: number
  errors: string[]
}

export interface LeadImportBatchSummary {
  id: number
  filename: string
  total_rows: number
  organizations_created: number
  organizations_matched: number
  contacts_created: number
  contacts_matched: number
  skipped_count: number
  status: string
  created_at: string
}

export const TARGET_FIELD_LABELS: Record<string, string> = {
  org_name: 'Organization Name (required)',
  org_website: 'Organization Website',
  org_industry: 'Organization Industry',
  org_country: 'Organization Country',
  org_state: 'Organization State',
  org_city: 'Organization City',
  org_phone: 'Organization Phone',
  org_email: 'Organization Email',
  contact_full_name: 'Contact Full Name',
  contact_first_name: 'Contact First Name',
  contact_last_name: 'Contact Last Name',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  contact_designation: 'Contact Title / Designation',
  contact_linkedin: 'Contact LinkedIn URL',
}

export const leadImportService = {
  upload: async (file: File): Promise<LeadUploadPreview> => {
    const token = localStorage.getItem('elly_bd_auth_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE}/api/business-development/leads/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(res.status, data.detail || 'Upload failed.')
    }
    return res.json()
  },

  confirmImport: async (
    uploadId: string,
    columnMapping: Record<string, string | null>
  ): Promise<LeadImportResult> => {
    return api.post<LeadImportResult>('/api/business-development/leads/import', {
      upload_id: uploadId,
      column_mapping: columnMapping,
    })
  },

  listImports: async (): Promise<LeadImportBatchSummary[]> => {
    return api.get<LeadImportBatchSummary[]>('/api/business-development/leads/imports')
  },
}
