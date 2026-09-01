import { api } from './api'
import type {
  LoginCredentials,
  TokenResponse,
  User,
  AccessResponse,
  LogoutResponse,
} from '../types/auth'

export const authService = {
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    return api.post<TokenResponse>('/auth/login', credentials)
  },

  async getMe(): Promise<User> {
    return api.get<User>('/auth/me')
  },

  async logout(): Promise<LogoutResponse> {
    return api.post<LogoutResponse>('/auth/logout')
  },

  async checkBDAccess(): Promise<AccessResponse> {
    return api.get<AccessResponse>('/api/business-development/access')
  },
}
