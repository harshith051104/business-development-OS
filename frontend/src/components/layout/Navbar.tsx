import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { notificationService } from '../../services/notifications'
import type { NotificationItem } from '../../types/notification'
import { NAV_SECTIONS, resolveNav, roleLabel } from '../../lib/navigation'
import GmailConnectionPanel from '../settings/GmailConnectionPanel'
import { LogOut, ShieldCheck, Menu, X, Mail, Bell, ChevronUp, UploadCloud } from 'lucide-react'

/** Sidebar (desktop), top bar + drawer (mobile), and the in-page section tabs for the current section. */
export const Navbar: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [gmailOpen, setGmailOpen] = useState(false)

  // ?gmail=manage (from "Gmail not connected" links) or Google's return opens the Gmail panel on any page.
  useEffect(() => {
    const g = searchParams.get('gmail')
    if (!g) return
    setGmailOpen(true)
    if (g === 'manage') {
      searchParams.delete('gmail')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const current = resolveNav(location.pathname)
  const isAdmin = user?.role === 'ADMIN'

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
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false)
        setProfileOpen(false)
        setMobileOpen(false)
        setGmailOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const openNotifications = () => {
    setNotifOpen((prev) => {
      const next = !prev
      if (next) {
        setNotifLoading(true)
        setNotifError(false)
        notificationService
          .list(false, 20)
          .then(setNotifs)
          .catch(() => setNotifError(true))
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

  const navItemClass = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
      active ? 'bg-violet-600/20 text-white font-semibold' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
    }`

  const notificationsPanel = notifOpen && (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute left-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-[#130D2A] border border-slate-700/70 rounded-xl shadow-2xl z-50"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 sticky top-0 bg-[#130D2A]">
        <span className="text-xs font-semibold text-white">Notifications</span>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="text-[11px] text-violet-300 hover:text-violet-200">
            Mark all read
          </button>
        )}
      </div>
      {notifLoading ? (
        <div className="p-4 text-center text-xs text-slate-500">Loading…</div>
      ) : notifError ? (
        <div className="p-4 text-center text-xs text-rose-300">Couldn’t load notifications.</div>
      ) : notifs.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500">No notifications.</div>
      ) : (
        notifs.map((n) => (
          <button
            key={n.id}
            onClick={() => handleNotifClick(n)}
            className={`w-full text-left px-3 py-2.5 border-b border-slate-800/60 hover:bg-white/5 ${n.is_read ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-2">
              {!n.is_read && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{n.title}</div>
                {n.body && <div className="text-[11px] text-slate-500 truncate">{n.body}</div>}
                <div className="text-[10px] text-slate-600 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  )

  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-4 flex items-center justify-between">
        <Link to="/business-development" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-black text-sm">E</div>
          <div className="leading-tight">
            <span className="block font-bold text-sm text-white tracking-tight">ELLY</span>
            <span className="block text-[11px] text-slate-500">Business Development</span>
          </div>
        </Link>
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notificationsPanel}
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5">
        {NAV_SECTIONS.map((sec) => {
          const Icon = sec.icon
          const active = current.section?.key === sec.key
          return (
            <Link
              key={sec.key}
              to={sec.path}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={navItemClass(active)}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-violet-300' : ''}`} />
              <span>{sec.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-slate-800/80 space-y-0.5">
        {isAdmin && (
          <Link to="/admin" onClick={() => setMobileOpen(false)} className={navItemClass(false)}>
            <ShieldCheck className="w-4 h-4" />
            <span>Admin console</span>
          </Link>
        )}

        <div className="relative pt-1" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 text-left"
          >
            <span className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-white truncate">{user?.name || 'Signed in'}</span>
              <span className="block text-[11px] text-slate-500 truncate">{roleLabel(user?.role)}</span>
            </span>
            <ChevronUp className={`w-3.5 h-3.5 text-slate-500 transition-transform ${profileOpen ? '' : 'rotate-180'}`} />
          </button>
          {profileOpen && (
            <div role="menu" className="absolute bottom-full left-0 right-0 mb-2 bg-[#130D2A] border border-slate-700/70 rounded-xl shadow-2xl p-1.5 z-50">
              <div className="px-2.5 py-2 border-b border-slate-800 mb-1">
                <div className="text-xs font-medium text-white truncate">{user?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Role: {roleLabel(user?.role)}</div>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false)
                  setMobileOpen(false)
                  setGmailOpen(true)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-white/5"
              >
                <Mail className="w-3.5 h-3.5" /> Gmail connection
              </button>
              {isAdmin && (
                <Link role="menuitem" to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-white/5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Switch to Admin console
                </Link>
              )}
              <button role="menuitem" onClick={() => logout()} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-rose-300 hover:bg-rose-500/10">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const section = current.section
  const tab = current.tab
  const showTabs = section && (section.tabs.length > 1 || section.action)

  return (
    <>
      {gmailOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={() => setGmailOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Gmail connection" className="w-full max-w-lg relative" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setGmailOpen(false)} aria-label="Close" className="absolute right-3 top-3 text-slate-400 hover:text-white z-10">
              <X className="w-4 h-4" />
            </button>
            <GmailConnectionPanel />
          </div>
        </div>
      )}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#0D0820] border-r border-slate-800/80 z-30">
        {renderNavContent()}
      </aside>

      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0D0820] border-b border-slate-800/80">
        <Link to="/business-development" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-black text-sm">E</div>
          <span className="font-bold text-sm text-white">ELLY</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="p-2 text-slate-300 hover:text-white rounded-lg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 flex">
          <div className="w-72 h-full bg-[#0D0820] border-r border-slate-800">{renderNavContent()}</div>
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {showTabs && (
        <div className="border-b border-slate-800/80 bg-[#0D0820]/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 pt-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">{section!.label}</span>
              <nav aria-label={`${section!.label} sections`} className="flex items-center gap-1 overflow-x-auto -mb-px">
                {section!.tabs.map((t) => {
                  const active = !current.isAction && tab?.path === t.path
                  return (
                    <Link
                      key={t.path}
                      to={t.path}
                      aria-current={active ? 'page' : undefined}
                      className={`px-3 py-2 text-[13px] whitespace-nowrap border-b-2 transition-colors ${
                        active ? 'border-violet-400 text-white font-semibold' : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </Link>
                  )
                })}
              </nav>
              {section!.action && (
                <Link
                  to={section!.action.path}
                  aria-current={current.isAction ? 'page' : undefined}
                  className={`ml-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 ${
                    current.isAction ? 'border-violet-400 text-white bg-violet-600/20' : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {section!.action.label}
                </Link>
              )}
            </div>
            {tab?.subtabs && !current.isAction && (
              <div className="flex flex-wrap items-center gap-1.5 py-2.5">
                {tab.subtabs.map((s) => {
                  const active = current.subtab?.path === s.path
                  return (
                    <Link
                      key={s.path}
                      to={s.path}
                      aria-current={active ? 'page' : undefined}
                      className={`px-2.5 py-1 rounded-md text-xs ${
                        active ? 'bg-slate-700/70 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {s.label}
                    </Link>
                  )
                })}
                {(current.subtab?.description || tab.description) && (
                  <span className="text-[11px] text-slate-500 ml-2">{current.subtab?.description || tab.description}</span>
                )}
              </div>
            )}
            {!tab?.subtabs && section!.description && (
              <p className="text-[11px] text-slate-500 py-2">{section!.description}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Navbar
