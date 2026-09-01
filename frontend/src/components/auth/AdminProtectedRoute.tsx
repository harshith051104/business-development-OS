import React from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ShieldAlert, ArrowLeft, RotateCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

export const AdminProtectedRoute: React.FC<Props> = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A071B] flex items-center justify-center">
        <RotateCw className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex items-center justify-center p-6">
        <div className="bg-[#110B2E] border border-rose-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-400 w-fit mx-auto border border-rose-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied (403)</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Administrative privileges required. Your current account role does not have permission to view or manage the internal administration console.
          </p>
          <div className="pt-2">
            <Link
              to="/business-development"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to BD Portal</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
export default AdminProtectedRoute
