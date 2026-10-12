import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { notificationService } from '../../services/notifications'
import type { NotificationItem } from '../../types/notification'
import {
  LayoutDashboard,
  Building2,
  Users,
  Compass,
  Sparkles,
  Mail,
  Calendar,
  Tv,
  FileText,
  Scale,
  Clock3,
  CheckSquare,
  Handshake,
  UserCheck,
  BarChart3,
  Target,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  Settings,
  Map,
  MessageSquare,
  Network,
  DollarSign,
  Send,
  UploadCloud,
  Activity,
  ClipboardList,
  Bell,
} from 'lucide-react'

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const refreshUnreadCount = useCallback(() => {
    notificationService
      .unreadCount()
      .then((r) => setUnreadCount(r.unread_count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshUnreadCount()
    const interval = setInterval(refreshUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [refreshUnreadCount])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const openNotifications = () => {
    setNotifOpen((prev) => {
      const next = !prev
      if (next) {
        setNotifLoading(true)
        notificationService
          .list(false, 20)
          .then(setNotifs)
          .catch(() => {})
          .finally(() => setNotifLoading(false))
      }
      return next
    })
  }

  const handleNotifClick = (n: NotificationItem) => {
    if (!n.is_read) {
      notificationService
        .markRead(n.id)
        .then(() => {
          setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
          refreshUnreadCount()
        })
        .catch(() => {})
    }
    setNotifOpen(false)
    if (n.link) navigate(n.link)
  }

  const handleMarkAllRead = () => {
    notificationService
      .markAllRead()
      .then(() => {
        setNotifs((prev) => prev.map((x) => ({ ...x, is_read: true })))
        setUnreadCount(0)
      })
      .catch(() => {})
  }

  // Complete 17-item ELLY Commercial Navigation
  const navSections = [
    {
      title: 'Target Discovery & CRM',
      items: [
        { label: 'Dashboard', path: '/business-development', icon: LayoutDashboard },
        { label: 'Find Organizations', path: '/business-development/discover', icon: Compass },
        { label: 'Organizations', path: '/business-development/organizations', icon: Building2 },
        { label: 'Contacts', path: '/business-development/contacts', icon: Users },
        { label: 'Opportunities', path: '/business-development/opportunities', icon: Target },
        { label: 'Import Lead List', path: '/business-development/leads/import', icon: UploadCloud },
        { label: 'Lead Tracker', path: '/business-development/leads/tracker', icon: ClipboardList },
      ],
    },
    {
      title: 'Outreach & Presentations',
      items: [
        { label: 'Campaigns', path: '/business-development/campaigns', icon: Target },
        { label: 'ELLY Showcase', path: '/business-development/showcase', icon: Sparkles },
        { label: 'Outreach', path: '/business-development/outreach', icon: Mail },
        { label: 'Outreach Tracker', path: '/business-development/outreach/tracker', icon: Activity },
        { label: 'Meetings', path: '/business-development/meetings', icon: Calendar },
        { label: 'Demos', path: '/business-development/demos', icon: Tv },
      ],
    },
    {
      title: 'Funding',
      items: [
        { label: 'Find Investors', path: '/business-development/funding', icon: DollarSign },
        { label: 'Funding Campaigns', path: '/business-development/funding/campaigns', icon: Send },
      ],
    },
    {
      title: 'Commercial Deals & Accounts',
      items: [
        { label: 'Proposals', path: '/business-development/proposals', icon: FileText },
        { label: 'Negotiations', path: '/business-development/negotiations', icon: Scale },
        { label: 'Follow-ups', path: '/business-development/followups', icon: Clock3 },
        { label: 'Tasks', path: '/business-development/tasks', icon: CheckSquare },
        { label: 'Partnerships', path: '/business-development/partnerships', icon: Handshake },
        { label: 'Customers', path: '/business-development/customers', icon: UserCheck },
        { label: 'Reports', path: '/business-development/reports', icon: BarChart3 },
        { label: 'Analytics', path: '/business-development/analytics', icon: BarChart3 },
        { label: 'Calendar', path: '/business-development/calendar', icon: Calendar },
        { label: 'Map View', path: '/business-development/map', icon: Map },
        { label: 'Connections', path: '/business-development/connections', icon: Network },
        { label: 'Communications', path: '/business-development/communications', icon: MessageSquare },
      ],
    },
  ]

  const isActive = (path: string) => {
    if (path === '/business-development') {
      return location.pathname === '/business-development'
    }
    return location.pathname.startsWith(path)
  }

  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="shrink-0 p-4 border-b border-violet-900/50 flex items-center justify-between">
        <Link
          to="/business-development"
          onClick={() => setMobileOpen(false)}
          className="flex items-center space-x-3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-violet-500/25 group-hover:scale-105 transition">
            E
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm text-white tracking-tight">ELLY</span>
              <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded border border-violet-500/25 uppercase tracking-wide">
                BD OS
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block font-medium">Commercial Lifecycle</span>
          </div>
        </Link>
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="relative p-2 text-slate-400 hover:text-violet-300 hover:bg-slate-800/60 rounded-lg transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-fuchsia-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-[#130D2A] border border-violet-900/50 rounded-xl shadow-2xl z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-violet-900/40 sticky top-0 bg-[#130D2A]">
                <span className="text-xs font-bold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-violet-300 hover:text-violet-200"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifLoading ? (
                <div className="p-4 text-center text-xs text-slate-500">Loading…</div>
              ) : notifs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No notifications yet.</div>
              ) : (
                notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-3 py-2.5 border-b border-violet-900/20 hover:bg-slate-800/60 transition ${
                      n.is_read ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{n.title}</div>
                        {n.body && <div className="text-[11px] text-slate-500 truncate">{n.body}</div>}
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-0.5">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {sec.title}
            </div>
            {sec.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-violet-500/15 text-violet-200 border-l-4 border-violet-400 font-semibold shadow-inner pl-2'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-violet-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-3 h-3 text-violet-400" />}
                </Link>
              )
            })}
          </div>
        ))}

        {/* Admin Console Switcher (if admin user) */}
        {user?.role === 'ADMIN' && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-fuchsia-400/80 mb-1">
              Governance
            </div>
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/25 transition"
            >
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Admin Console</span>
              </div>
              <ChevronRight className="w-3 h-3 text-fuchsia-400" />
            </Link>
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="shrink-0 p-3 border-t border-violet-900/40 bg-[#0B0520]/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-violet-900/60 border border-violet-700/40 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-semibold text-white block truncate">{user?.name || 'BD Leader'}</span>
              <span className="text-[10px] text-violet-400 font-medium block truncate capitalize">
                {user?.role?.toLowerCase() || 'Business Dev'}
              </span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#0F0A24]/95 backdrop-blur-xl border-r border-violet-900/40 z-30 shadow-2xl">
        {renderNavContent()}
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0F0A24]/95 backdrop-blur-xl border-b border-violet-900/40">
        <Link to="/business-development" className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-black text-sm">
            E
          </div>
          <span className="font-extrabold text-sm text-white">ELLY BD OS</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={openNotifications}
            className="relative p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-fuchsia-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex">
          <div className="w-72 h-full bg-[#0F0A24] border-r border-violet-900/40">
            {renderNavContent()}
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}

export default Navbar

