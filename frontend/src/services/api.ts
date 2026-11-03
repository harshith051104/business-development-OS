const API_BASE = import.meta.env.VITE_API_URL || ''

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, options?: RequestInit, params?: Record<string, any>): Promise<T> {
  const token = localStorage.getItem('elly_bd_auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  }

  let finalUrl = API_BASE ? `${API_BASE}${path}` : path
  if (params) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v))
      }
    })
    const qs = query.toString()
    if (qs) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs
    }
  }

  try {
    const res = await fetch(finalUrl, {
      ...options,
      headers,
    })

    if (!res.ok) {
      let errorDetail = `Request failed with status ${res.status}`
      try {
        const data = await res.json()
        errorDetail = data.detail || data.message || errorDetail
      } catch {
        const text = await res.text().catch(() => '')
        if (text) errorDetail = text
      }
      throw new ApiError(res.status, errorDetail)
    }

    if (res.status === 204) {
      return undefined as T
    }

    return res.json()
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }
    // Network failure / server offline
    throw new ApiError(
      0,
      `Cannot connect to backend server. Make sure the backend is running on port 8001 (or proxy target). Original error: ${err.message}`
    )
  }
}

export const api = {
  get: <T>(path: string, params?: Record<string, any>) => request<T>(path, { method: 'GET' }, params),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
