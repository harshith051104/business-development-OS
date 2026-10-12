import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, LoginCredentials } from '../types/auth'
import { authService } from '../services/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isBDUser: boolean
  isAdmin: boolean
  login: (credentials: LoginCredentials) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'elly_bd_auth_token'
const USER_KEY = 'elly_bd_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Verify session validity on initial load
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        setIsLoading(false)
        return
      }

      try {
        const currentUser = await authService.getMe()
        setUser(currentUser)
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) {
          console.warn('Session verification failed, logging out:', err)
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setToken(null)
          setUser(null)
        } else {
          console.warn('Session verification request failed (keeping existing session):', err)
        }
      } finally {
        setIsLoading(false)
      }
    }

    verifySession()
  }, [])

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true)
    try {
      const response = await authService.login(credentials)
      setToken(response.access_token)
      setUser(response.user)
      localStorage.setItem(TOKEN_KEY, response.access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(response.user))
      return response.user
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout().catch(() => {})
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
    }
  }, [])

  const isAdmin = user?.role === 'ADMIN'
  const isBDUser = user?.role === 'BUSINESS_DEVELOPMENT' || isAdmin

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        isBDUser,
        isAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
