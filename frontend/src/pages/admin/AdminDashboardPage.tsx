import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import type { AdminDashboardStats } from '../../types/admin'
import {
  ShieldCheck,
  Users,
  UserCheck,
  Building2,
  Target,
  Handshake,
  Sparkles,
  History,
  Sliders,
  UserPlus,
  ArrowRight,
  RotateCw,
  Clock,
  Activity,
  Layers,
} from 'lucide-react'

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      try {
        const data = await adminService.getDashboardStats()
        setStats(data)
      } catch (err: any) {
        setError(err.detail || err.message || 'Failed to load admin stats.')
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      {/* Subheader */}
      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-600 text-white shadow-lg shadow-rose-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Administrative Command Center
            </h1>
            <p className="text-xs text-slate-400">
              System governance, user administration, BD team allocation, and audit monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            to="/admin/users/new"
            className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-rose-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading system metrics...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        ) : (
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Link
                to="/admin/users"
                className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-rose-500/40 transition shadow-xl space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold group-hover:text-rose-300 transition">Total Users</span>
                  <Users className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-extrabold text-white font-mono">
                  {stats?.total_users ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">System accounts</div>
              </Link>

              <Link
                to="/admin/team"
                className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 hover:border-rose-500/40 transition shadow-xl space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold group-hover:text-rose-300 transition">BD Team</span>
                  <UserCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono">
                  {stats?.active_bd_users ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">Active BD representatives</div>
              </Link>

              <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold">Organizations</span>
                  <Building2 className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-2xl font-extrabold text-violet-400 font-mono">
                  {stats?.active_organizations ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">Target accounts</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold">Opportunities</span>
                  <Target className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-extrabold text-indigo-400 font-mono">
                  {stats?.active_opportunities ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">Commercial pipeline</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold">Partnerships</span>
                  <Handshake className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {stats?.active_partnerships ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">Active formal alliances</div>
              </div>
            </div>

            {/* Middle Section: Quick Operations & Recent Audit Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Quick Operation Cards (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-rose-400" />
                    <span>Administrative Quick Links</span>
                  </h2>

                  <div className="space-y-2 text-xs">
                    <Link
                      to="/admin/users"
                      className="p-3 rounded-2xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-rose-300 transition">
                            Manage Users & Roles
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Create, deactivate, and assign user permissions
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                    </Link>

                    <Link
                      to="/admin/team"
                      className="p-3 rounded-2xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-amber-300 transition">
                            BD Team Workload
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Portfolio allocations and bulk ownership reassignment
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                    </Link>

                    <Link
                      to="/admin/showcase"
                      className="p-3 rounded-2xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-indigo-300 transition">
                            Project Showcase Governance
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Approve, publish, or archive showcase projects
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                    </Link>

                    <Link
                      to="/admin/audit-logs"
                      className="p-3 rounded-2xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                          <History className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-cyan-300 transition">
                            Audit & Security Logs
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Review system transitions, edits, and access history
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                    </Link>

                    <Link
                      to="/admin/settings"
                      className="p-3 rounded-2xl bg-[#1A1040] hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-violet-300 transition">
                            System Configuration
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Customize safe parameters and taxonomy
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Recent System Activity (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                      <History className="w-4 h-4 text-rose-400" />
                      <span>Recent System Activity</span>
                    </h2>
                    <Link
                      to="/admin/audit-logs"
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition"
                    >
                      View All Logs →
                    </Link>
                  </div>

                  {!stats?.recent_system_activity || stats.recent_system_activity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 italic">
                      No audit activity found.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {stats.recent_system_activity.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-2xl bg-[#1A1040] border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white">{act.action}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                                {act.resource_type} {act.resource_id ? `#${act.resource_id}` : ''}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              By: {act.user_email || 'System'}
                            </div>
                          </div>
                          {act.timestamp && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(act.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
export default AdminDashboardPage
