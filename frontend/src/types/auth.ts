export interface User {
  id: number
  name: string
  email: string
  role: 'BUSINESS_DEVELOPMENT' | 'ADMIN' | 'HEALTHCARE' | 'USER' | string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface AccessResponse {
  status: string
  message: string
  phase: string
  user: User
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LogoutResponse {
  status: string
  message: string
}
