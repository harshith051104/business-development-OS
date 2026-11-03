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
  warning?: string | null
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
  contacts_enrolled?: number
  campaign_id?: number | null
  errors: string[]
}

export interface LeadImportBatchOrganization {
  id: number
  name: string
  website?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  status: string
}

export interface LeadImportBatchContact {
  id: number
  full_name: string
  email?: string | null
  phone?: string | null
  designation?: string | null
  location?: string | null
  organization_id: number
  organization_name?: string | null
}

export interface LeadImportBatchRecords {
  batch_id: number
  filename: string
  organizations: LeadImportBatchOrganization[]
  contacts: LeadImportBatchContact[]
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

export interface GoogleSheetTab {
  title: string
  row_count: number
  col_count: number
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
  contact_location: 'Contact Location (City/Area)',
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
    columnMapping: Record<string, string | null>,
    campaignId?: number | null
  ): Promise<LeadImportResult> => {
    return api.post<LeadImportResult>('/api/business-development/leads/import', {
      upload_id: uploadId,
      column_mapping: columnMapping,
      campaign_id: campaignId ?? null,
    })
  },

  listImports: async (): Promise<LeadImportBatchSummary[]> => {
    return api.get<LeadImportBatchSummary[]>('/api/business-development/leads/imports')
  },

  getBatchRecords: async (batchId: number): Promise<LeadImportBatchRecords> => {
    return api.get<LeadImportBatchRecords>(`/api/business-development/leads/imports/${batchId}/records`)
  },

  listGoogleSheetTabs: async (spreadsheetUrl: string): Promise<{ spreadsheet_id: string; tabs: GoogleSheetTab[] }> => {
    return api.post('/api/business-development/leads/google-sheets/list-tabs', {
      spreadsheet_url: spreadsheetUrl,
    })
  },

  loadGoogleSheetRows: async (spreadsheetUrl: string, sheetNames: string[]): Promise<LeadUploadPreview> => {
    return api.post<LeadUploadPreview>('/api/business-development/leads/google-sheets/load', {
      spreadsheet_url: spreadsheetUrl,
      sheet_names: sheetNames,
    })
  },
}
