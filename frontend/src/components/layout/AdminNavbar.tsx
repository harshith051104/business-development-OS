import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { roleLabel } from '../../lib/navigation'
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  UserCheck,
  Sparkles,
  History,
  Sliders,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  BookOpen,
} from 'lucide-react'

export const AdminNavbar: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const groups = [
    {
      title: 'Overview',
      items: [{ label: 'Admin overview', path: '/admin', icon: LayoutDashboard }],
    },
    {
      title: 'People & knowledge',
      items: [
        { label: 'Users & Roles', path: '/admin/users', icon: Users },
        { label: 'Knowledge Base', path: '/admin/knowledge-base', icon: BookOpen },
        { label: 'BD Team Oversight', path: '/admin/team', icon: UserCheck },
      ],
    },
    {
      title: 'Content & platform',
      items: [
        { label: 'Showcase Management', path: '/admin/showcase', icon: Sparkles },
        { label: 'System Configuration', path: '/admin/settings', icon: Sliders },
        { label: 'Audit Logs', path: '/admin/audit-logs', icon: History },
      ],
    },
  ]

  const isActive = (path: string) => (path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path))

  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 space-y-3">
        <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <span className="block font-bold text-sm text-white">Admin console</span>
            <span className="block text-[11px] text-slate-500">Platform administration</span>
          </div>
        </Link>
        <Link
          to="/business-development"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-200 hover:border-slate-500 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to BD workspace
        </Link>
      </div>

      <nav aria-label="Admin" className="flex-1 min-h-0 overflow-y-auto px-3 space-y-4">
        {groups.map((g) => (
          <div key={g.title} className="space-y-0.5">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{g.title}</div>
            {g.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] ${
                    active ? 'bg-violet-600/20 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-violet-300' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate">{user?.name || 'Administrator'}</div>
            <div className="text-[11px] text-slate-500 truncate">{roleLabel(user?.role)}</div>
          </div>
        </div>
        <button onClick={() => logout()} aria-label="Sign out" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 w-64 bg-[#0E0B1D] border-r border-slate-800 z-40 hidden md:block">{renderNavContent()}</aside>

      <header className="sticky top-0 z-40 md:hidden bg-[#0E0B1D] border-b border-slate-800 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg text-slate-300 hover:text-white" aria-label="Toggle menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-sm text-white">Admin console</span>
        </div>
        <Link to="/business-development" className="text-xs text-slate-300 hover:text-white">
          BD workspace
        </Link>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0E0B1D] border-r border-slate-800 z-50">{renderNavContent()}</div>
        </div>
      )}
    </>
  )
}
export default AdminNavbar
