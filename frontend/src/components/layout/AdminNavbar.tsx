import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  UserCheck,
  Sparkles,
  History,
  Sliders,
  LogOut,
  ArrowRightLeft,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

export const AdminNavbar: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { label: 'Admin Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Users & Roles', path: '/admin/users', icon: Users },
    { label: 'BD Team Oversight', path: '/admin/team', icon: UserCheck },
    { label: 'Showcase Management', path: '/admin/showcase', icon: Sparkles },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: History },
    { label: 'System Configuration', path: '/admin/settings', icon: Sliders },
  ]

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  const renderNavContent = () => (
    <div className="flex flex-col h-full justify-between">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-rose-500/20 flex items-center justify-between">
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center space-x-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm text-white tracking-tight">ADMIN</span>
                <span className="text-[10px] font-extrabold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-wide">
                  Console
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">Enterprise Governance</span>
            </div>
          </Link>
        </div>

        {/* Navigation Section */}
        <nav className="p-3.5 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)] custom-scrollbar">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Administration
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-rose-500/20 text-rose-200 border-l-4 border-rose-500 font-semibold shadow-inner pl-2.5'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${active ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {active && <ChevronRight className="w-3.5 h-3.5 text-rose-400" />}
              </Link>
            )
          })}

          {/* Switch to BD Portal Link */}
          <div className="pt-4 border-t border-slate-800/80 mt-4">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-violet-400/80 mb-1.5">
              Portal Switch
            </div>
            <Link
              to="/business-development"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 border border-violet-500/30 transition"
            >
              <div className="flex items-center space-x-2.5">
                <ArrowRightLeft className="w-4 h-4 text-violet-400" />
                <span>Switch to BD Portal</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
            </Link>
          </div>
        </nav>
      </div>

      {/* Admin Profile & Logout Footer */}
      <div className="p-3.5 border-t border-slate-800/80 bg-[#070514]/60">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#180E1E] border border-rose-500/20">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-300 font-bold text-xs shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-200 truncate">{user?.name || 'Administrator'}</div>
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span className="text-[10px] text-rose-300 font-mono font-bold">ADMIN</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop Left Sidebar (Fixed) ── */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-[#0D0715] border-r border-rose-500/20 z-40 hidden md:block shadow-2xl">
        {renderNavContent()}
      </aside>

      {/* ── Mobile Top Header Bar ── */}
      <header className="sticky top-0 z-40 md:hidden bg-[#0D0715]/95 backdrop-blur-xl border-b border-rose-500/20 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/60 border border-slate-700/60"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/admin" className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-white">ADMIN CONSOLE</span>
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/business-development"
            className="px-2 py-1 rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 text-[11px] font-bold"
          >
            BD Portal
          </Link>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile Slide-out Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0D0715] border-r border-rose-500/20 z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  )
}
export default AdminNavbar
