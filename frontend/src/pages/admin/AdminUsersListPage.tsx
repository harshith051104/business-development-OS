import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import type { AdminUser } from '../../types/admin'
import {
  Users,
  UserPlus,
  Search,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Briefcase,
  Sliders,
} from 'lucide-react'

export const AdminUsersListPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)

  const [search, setSearch] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Quick Role Edit Modal State
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [newRole, setNewRole] = useState<string>('BUSINESS_DEVELOPMENT')
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false)
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminService.listUsers({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        role: roleFilter !== 'All' ? roleFilter : undefined,
        is_active: statusFilter === 'Active' ? true : statusFilter === 'Inactive' ? false : undefined,
      })
      setUsers(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, roleFilter, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleToggleStatus = async (u: AdminUser) => {
    try {
      await adminService.updateUserStatus(u.id, !u.is_active)
      fetchUsers()
    } catch (err: any) {
      alert(err.detail || 'Failed to update user status.')
    }
  }

  const handleRoleUpdate = async () => {
    if (!selectedUser) return
    setIsUpdatingRole(true)
    try {
      await adminService.updateUserRole(selectedUser.id, newRole)
      setIsRoleModalOpen(false)
      fetchUsers()
    } catch (err: any) {
      alert(err.detail || 'Failed to update user role.')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              User Directory & Role Administration
            </h1>
            <p className="text-xs text-slate-400">
              Manage company accounts, roles, access statuses, and permissions
            </p>
          </div>
        </div>

        <Link
          to="/admin/users/new"
          className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create User</span>
        </Link>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search user name or email..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="All">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="BUSINESS_DEVELOPMENT">BUSINESS_DEVELOPMENT</option>
                <option value="HEALTHCARE">HEALTHCARE</option>
                <option value="USER">USER</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-rose-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading user accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No users found.</h3>
            <p className="text-xs text-slate-400">Adjust your search or create a new user account.</p>
          </div>
        ) : (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">User / Email</th>
                    <th className="p-3.5 font-semibold">Role</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Created Date</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#1A1040]/40 transition">
                      <td className="p-3.5">
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="font-bold text-white hover:text-rose-300 transition block truncate"
                        >
                          {u.name}
                        </Link>
                        <span className="text-[11px] text-slate-400 font-mono block truncate">
                          {u.email}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                            u.role === 'ADMIN'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : u.role === 'BUSINESS_DEVELOPMENT'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {u.role === 'ADMIN' ? (
                            <Shield className="w-3 h-3 text-rose-400" />
                          ) : (
                            <Briefcase className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{u.role}</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            u.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {u.is_active ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : (
                            <XCircle className="w-2.5 h-2.5" />
                          )}
                          <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u)
                            setNewRole(u.role)
                            setIsRoleModalOpen(true)
                          }}
                          className="py-1 px-2.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs transition"
                          title="Change Role"
                        >
                          Role
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition border ${
                            u.is_active
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        <Link
                          to={`/admin/users/${u.id}`}
                          className="py-1 px-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Page {page} of {totalPages} (Total: {total})
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Role Change Modal */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Change User Role</h3>
            <p className="text-xs text-slate-400">
              Updating role for <span className="font-bold text-white">{selectedUser.name}</span> ({selectedUser.email})
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-300">Select Role</label>
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
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleUpdate}
                disabled={isUpdatingRole}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isUpdatingRole && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Role</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminUsersListPage
