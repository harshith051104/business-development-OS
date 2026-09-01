import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import {
  UserPlus,
  ArrowLeft,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Shield,
} from 'lucide-react'

export const AdminUserNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [role, setRole] = useState<string>('BUSINESS_DEVELOPMENT')
  const [isActive, setIsActive] = useState<boolean>(true)

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const created = await adminService.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role,
        is_active: isActive,
      })

      navigate(`/admin/users/${created.id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to create user.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <main className="flex-1 p-6 max-w-2xl w-full mx-auto space-y-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link to="/admin/users" className="hover:text-white flex items-center gap-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>User Directory</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium">Create User</span>
        </div>

        <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-600 text-white shadow-lg shadow-rose-600/30">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Create User Account</h1>
            <p className="text-xs text-slate-400">
              Provision internal Business Development or Administrator account
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-rose-400" />
              <span>Full Name *</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rachel Adams"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5 text-rose-400" />
              <span>Email Address *</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rachel.adams@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Initial Password *</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>System Role *</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="BUSINESS_DEVELOPMENT">BUSINESS_DEVELOPMENT</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Account Status</label>
              <select
                value={isActive ? 'true' : 'false'}
                onChange={(e) => setIsActive(e.target.value === 'true')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <Link
              to="/admin/users"
              className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold transition flex items-center space-x-2 shadow-lg shadow-rose-600/30 disabled:opacity-50"
            >
              {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Provision User</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default AdminUserNewPage
