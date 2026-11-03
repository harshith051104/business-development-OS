import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { Dialog, Notice, buttonClass, type NoticeState } from '../../components/ui/Dialog'
import { useAuth } from '../../context/AuthContext'
import { adminService } from '../../services/admin'
import { ASSIGNABLE_ROLES, ROLE_LABELS, roleLabel } from '../../lib/navigation'
import type { AdminUser } from '../../types/admin'
import { UserPlus, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const ROLE_HELP: Record<string, string> = {
  ADMIN: 'Full access, including this Admin console and team-wide records.',
  BUSINESS_DEVELOPMENT: 'BD workspace: organizations, outreach, meetings and deals.',
  HEALTHCARE: 'Healthcare portal only; no BD workspace access.',
  USER: 'Basic account with no BD or admin access.',
}

type Pending = { kind: 'role'; user: AdminUser } | { kind: 'status'; user: AdminUser } | null

export const AdminUsersListPage: React.FC = () => {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 15
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [newRole, setNewRole] = useState('BUSINESS_DEVELOPMENT')
  const [saving, setSaving] = useState(false)

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
      setError(err.detail || err.message || 'Users could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 250)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const closeDialog = useCallback(() => !saving && setPending(null), [saving])

  const confirm = async () => {
    if (!pending) return
    setSaving(true)
    const u = pending.user
    try {
      if (pending.kind === 'role') {
        await adminService.updateUserRole(u.id, newRole)
        setNotice({ kind: 'success', text: `${u.name} is now ${roleLabel(newRole)}.` })
      } else {
        await adminService.updateUserStatus(u.id, !u.is_active)
        setNotice({ kind: 'success', text: `${u.name} was ${u.is_active ? 'deactivated' : 'activated'}.` })
      }
      setPending(null)
      fetchUsers()
    } catch (err: any) {
      setNotice({ kind: 'error', text: err.detail || err.message || 'The change was not saved.' })
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  const select = 'px-3 py-2 rounded-lg bg-[#1A1040] border border-slate-700 text-white text-xs'

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] md:pl-64">
      <AdminNavbar />
      <main className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Users & Roles</h1>
            <p className="text-xs text-slate-400 mt-1">Enroll people, set their role, and turn access on or off. Changes are recorded in the Audit Log.</p>
          </div>
          <Link to="/admin/users/new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold">
            <UserPlus className="w-4 h-4" /> Create user
          </Link>
        </div>

        <Notice notice={notice} onDismiss={() => setNotice(null)} />
        {error && <Notice notice={{ kind: 'error', text: error }} onDismiss={() => setError(null)} />}

        <div className="flex flex-wrap items-center gap-2 bg-[#110B2E] border border-slate-800 rounded-xl p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search by name or email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by name or email"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500"
            />
          </div>
          <select aria-label="Role" className={select} value={roleFilter} onChange={(e) => (setRoleFilter(e.target.value), setPage(1))}>
            <option value="All">All roles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select aria-label="Account status" className={select} value={statusFilter} onChange={(e) => (setStatusFilter(e.target.value), setPage(1))}>
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="bg-[#110B2E] border border-slate-800 rounded-xl overflow-hidden">
          {loading && users.length === 0 ? (
            <p className="flex items-center justify-center gap-2 text-xs text-slate-400 py-12">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
            </p>
          ) : users.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-12">No users match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Created</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {users.map((u) => {
                    const isSelf = me?.id === u.id
                    return (
                      <tr key={u.id} className="hover:bg-white/5">
                        <td className="px-4 py-2.5">
                          <Link to={`/admin/users/${u.id}`} className="font-medium text-white hover:text-violet-300">
                            {u.name}
                          </Link>
                          {isSelf && <span className="ml-1.5 text-[10px] text-slate-500">(you)</span>}
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-200">{roleLabel(u.role)}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-slate-200">
                            <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1.5">
                          <Link to={`/admin/users/${u.id}`} className="inline-block px-2.5 py-1 rounded-md border border-slate-700 text-slate-200 hover:border-slate-500">
                            View
                          </Link>
                          <button
                            onClick={() => {
                              setNewRole(u.role)
                              setPending({ kind: 'role', user: u })
                            }}
                            disabled={isSelf}
                            title={isSelf ? 'You can’t change your own role' : undefined}
                            className="px-2.5 py-1 rounded-md border border-slate-700 text-slate-200 hover:border-slate-500 disabled:opacity-40"
                          >
                            Change role
                          </button>
                          <button
                            onClick={() => setPending({ kind: 'status', user: u })}
                            disabled={isSelf}
                            title={isSelf ? 'You can’t deactivate your own account' : undefined}
                            className={`px-2.5 py-1 rounded-md border disabled:opacity-40 ${
                              u.is_active ? 'border-rose-500/40 text-rose-200 hover:border-rose-400' : 'border-emerald-500/40 text-emerald-200 hover:border-emerald-400'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {page} of {totalPages} · {total} users
              </span>
              <div className="flex gap-1.5">
                <button aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md border border-slate-700 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button aria-label="Next page" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md border border-slate-700 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={pending?.kind === 'role'}
        title={`Change role for ${pending?.user.name ?? ''}`}
        onClose={closeDialog}
        footer={
          <>
            <button className={buttonClass.secondary} onClick={closeDialog} disabled={saving}>
              Cancel
            </button>
            <button className={buttonClass.primary} onClick={confirm} disabled={saving || newRole === pending?.user.role}>
              {saving ? 'Saving…' : 'Save role'}
            </button>
          </>
        }
      >
        <p>
          Current role: <span className="text-white">{roleLabel(pending?.user.role)}</span>
        </p>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">New role</legend>
          {ASSIGNABLE_ROLES.map((v) => (
            <label key={v} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${newRole === v ? 'border-violet-400 bg-violet-600/10' : 'border-slate-700'}`}>
              <input type="radio" name="role" value={v} checked={newRole === v} onChange={() => setNewRole(v)} className="mt-0.5" />
              <span>
                <span className="block text-white">{ROLE_LABELS[v]}</span>
                <span className="block text-[11px] text-slate-400">{ROLE_HELP[v]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-[11px] text-slate-500">Only these two roles can be assigned. Healthcare and Standard user exist on older accounts only.</p>
      </Dialog>

      <Dialog
        open={pending?.kind === 'status'}
        title={pending?.user.is_active ? `Deactivate ${pending?.user.name}?` : `Activate ${pending?.user.name ?? ''}?`}
        onClose={closeDialog}
        footer={
          <>
            <button className={buttonClass.secondary} onClick={closeDialog} disabled={saving}>
              Cancel
            </button>
            <button className={pending?.user.is_active ? buttonClass.danger : buttonClass.primary} onClick={confirm} disabled={saving}>
              {saving ? 'Saving…' : pending?.user.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </>
        }
      >
        <p>
          {pending?.user.is_active
            ? 'They will no longer be able to sign in. Their records stay in ELLY and you can reactivate them at any time.'
            : 'They will be able to sign in again with their existing role.'}
        </p>
      </Dialog>
    </div>
  )
}
export default AdminUsersListPage
