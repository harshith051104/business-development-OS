export interface AuditLog {
  id: number
  user_id?: number | null
  user_email?: string | null
  action: string
  resource_type: string
  resource_id?: number | null
  ip_address?: string | null
  metadata_json?: string | null
  timestamp?: string | null
}

export interface PaginatedAuditLogs {
  items: AuditLog[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
