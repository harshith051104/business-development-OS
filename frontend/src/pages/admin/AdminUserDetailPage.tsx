import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import type { AdminUserDetail } from '../../types/admin'
import {
  Users,
  ArrowLeft,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Target,
  Handshake,
  Calendar,
  History,
  Shield,
  Briefcase,
  Lock,
  Key,
} from 'lucide-react'

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false)
  const [newPassword, setNewPassword] = useState<string>('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false)

  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false)
  const [newRole, setNewRole] = useState<string>('')
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false)

  const fetchUser = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.getUserDetail(Number(id))
      setUser(data)
      setNewRole(data.role)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load user details.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const handleToggleStatus = async () => {
    if (!user) return
    try {
      await adminService.updateUserStatus(user.id, !user.is_active)
      fetchUser()
    } catch (err: any) {
      alert(err.detail || 'Failed to change user status.')
    }
  }

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsUpdatingRole(true)
    try {
      await adminService.updateUserRole(user.id, newRole)
      setIsRoleModalOpen(false)
      fetchUser()
    } catch (err: any) {
      alert(err.detail || 'Failed to update user role.')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newPassword.trim()) return
    setIsUpdatingPassword(true)
    try {
      await adminService.updateUser(user.id, { password: newPassword.trim() })
      setIsPasswordModalOpen(false)
      setNewPassword('')
      alert('Password updated successfully.')
    } catch (err: any) {
      alert(err.detail || 'Failed to reset password.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col">
        <AdminNavbar />
        <div className="flex-1 flex items-center justify-center">
          <RotateCw className="w-8 h-8 animate-spin text-rose-400" />
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col">
        <AdminNavbar />
        <div className="flex-1 p-8 max-w-4xl mx-auto text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-base font-bold text-white">User Not Found</h2>
          <p className="text-xs text-slate-400">{error || 'Unable to retrieve the requested user.'}</p>
          <Link
            to="/admin/users"
            className="inline-block px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
          >
            Back to Directory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link to="/admin/users" className="hover:text-white flex items-center gap-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>User Directory</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium truncate">{user.name}</span>
        </div>

        {/* User Profile Header */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-rose-600/30">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">{user.name}</h1>
                <span
                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    user.role === 'ADMIN'
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {user.role === 'ADMIN' ? <Shield className="w-3 h-3 text-rose-400" /> : <Briefcase className="w-3 h-3 text-amber-400" />}
                  <span>{user.role}</span>
                </span>
                <span
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    user.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {user.is_active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                  <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {user.email} · Created: {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Change Role
            </button>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Password</span>
            </button>
            <button
              onClick={handleToggleStatus}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition border ${
                user.is_active
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {user.is_active ? 'Deactivate Account' : 'Activate Account'}
            </button>
          </div>
        </div>

        {/* Activity Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Organizations</span>
            <div className="text-lg font-bold text-white font-mono">{user.activity.organizations_count}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacts Added</span>
            <div className="text-lg font-bold text-white font-mono">{user.activity.contacts_count}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Meetings</span>
            <div className="text-lg font-bold text-white font-mono">{user.activity.meetings_count}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Opportunities</span>
            <div className="text-lg font-bold text-white font-mono">{user.activity.opportunities_count}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Partnerships</span>
            <div className="text-lg font-bold text-white font-mono">{user.activity.partnerships_count}</div>
          </div>
        </div>

        {/* 3-Column Portfolio / Owned Resources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Owned Organizations */}
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-violet-400" />
              <span>Assigned Organizations</span>
            </h3>
            {user.owned_organizations.length === 0 ? (
              <p className="text-slate-500 italic text-xs">No organizations assigned.</p>
            ) : (
              <div className="space-y-2">
                {user.owned_organizations.map((org) => (
                  <Link
                    key={org.id}
                    to={`/business-development/organizations/${org.id}`}
                    className="p-2.5 rounded-xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 block text-xs transition space-y-0.5"
                  >
                    <div className="font-semibold text-white truncate">{org.name}</div>
                    <div className="text-[10px] text-slate-400">{org.organization_type} · {org.status}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Owned Opportunities */}
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Target className="w-4 h-4 text-indigo-400" />
              <span>Assigned Opportunities</span>
            </h3>
            {user.owned_opportunities.length === 0 ? (
              <p className="text-slate-500 italic text-xs">No opportunities assigned.</p>
            ) : (
              <div className="space-y-2">
                {user.owned_opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    to={`/business-development/opportunities/${opp.id}`}
                    className="p-2.5 rounded-xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 block text-xs transition space-y-0.5"
                  >
                    <div className="font-semibold text-white truncate">{opp.name}</div>
                    <div className="text-[10px] text-slate-400">{opp.stage} · {opp.priority}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Owned Partnerships */}
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Handshake className="w-4 h-4 text-emerald-400" />
              <span>Assigned Partnerships</span>
            </h3>
            {user.owned_partnerships.length === 0 ? (
              <p className="text-slate-500 italic text-xs">No partnerships assigned.</p>
            ) : (
              <div className="space-y-2">
                {user.owned_partnerships.map((part) => (
                  <Link
                    key={part.id}
                    to={`/business-development/partnerships/${part.id}`}
                    className="p-2.5 rounded-xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 block text-xs transition space-y-0.5"
                  >
                    <div className="font-semibold text-white truncate">{part.name}</div>
                    <div className="text-[10px] text-slate-400">{part.partnership_type} · {part.status}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Recent Actions */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <History className="w-4 h-4 text-rose-400" />
            <span>Recent Activity Stream</span>
          </h3>
          {user.recent_actions.length === 0 ? (
            <p className="text-slate-500 italic text-xs">No recent actions recorded.</p>
          ) : (
            <div className="space-y-2">
              {user.recent_actions.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-[#1A1040] border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white">{act.action}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {act.resource_type} {act.resource_id ? `#${act.resource_id}` : ''}
                    </span>
                  </div>
                  {act.timestamp && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Role Change Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Update Role for {user.name}</h3>
            <form onSubmit={handleRoleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                >
                  <option value="BUSINESS_DEVELOPMENT">BUSINESS_DEVELOPMENT</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="HEALTHCARE">HEALTHCARE</option>
                  <option value="USER">USER</option>
                </select>
              </div>
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                >
                  {isUpdatingRole ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Reset Password for {user.name}</h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">New Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                >
                  {isUpdatingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminUserDetailPage
