import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, LogOut, Lock, AlertCircle } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading, isBDUser, logout } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400">Verifying session and authorization...</p>
      </div>
    )
  }

  // 1. Unauthenticated -> Redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 2. Authenticated but lacks BUSINESS_DEVELOPMENT role -> Access Denied (403)
  if (!isBDUser) {
    return (
      <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#110B2E] border border-red-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Access Denied</h1>
              <p className="text-xs text-red-400/90 font-medium">403 Forbidden — Insufficient Permissions</p>
            </div>
          </div>

          <div className="space-y-4 mb-6 text-sm text-slate-300">
            <p>
              This portal is strictly restricted to the internal <strong className="text-white">Business Development</strong> team.
            </p>
            <div className="p-4 bg-[#1A1040] border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Authenticated User:</span>
                <span className="font-semibold text-white">{user.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Email:</span>
                <span className="text-slate-300">{user.email}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Assigned Role:</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono font-bold">
                  {user.role}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Required Role:</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono font-bold">
                  BUSINESS_DEVELOPMENT
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2 text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                This portal is restricted to authorized business development personnel only.
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition font-medium text-sm border border-slate-700"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>
      </div>
    )
  }

  // 3. Authorized BUSINESS_DEVELOPMENT user -> Render protected content
  return <>{children}</>
}
