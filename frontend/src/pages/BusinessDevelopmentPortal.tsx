import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardService } from '../services/dashboard'
import type { DashboardResponse } from '../types/dashboard'
import SummaryCard from '../components/dashboard/SummaryCard'
import ConnectionPipelineView from '../components/dashboard/ConnectionPipelineView'
import TodayActivities from '../components/dashboard/TodayActivities'
import UpcomingMeetings from '../components/dashboard/UpcomingMeetings'
import FollowUpsSection from '../components/dashboard/FollowUpsSection'
import RecentCommunicationsSection from '../components/dashboard/RecentCommunicationsSection'
import RecentActivityFeed from '../components/dashboard/RecentActivityFeed'
import QuickActions from '../components/dashboard/QuickActions'
import Navbar from '../components/layout/Navbar'
import { DailyPrioritiesWidget } from '../components/dashboard/DailyPrioritiesWidget'
import {
  Building,
  UserCheck,
  Link2,
  Star,
  Calendar,
  MessageSquare,
  Award,
  LogOut,
  RotateCw,
  AlertCircle,
  Shield,
  Sparkles,
  Inbox,
  ArrowRight,
  Layers,
  BarChart3,
  Compass,
} from 'lucide-react'

export const BusinessDevelopmentPortal: React.FC = () => {
  const { user, logout } = useAuth()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await dashboardService.getDashboardData()
      setData(response)
    } catch (err: any) {
      setError(err.detail || err.message || 'Unable to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Check if data is completely empty
  const isDataEmpty =
    data &&
    data.summary.organizations === 0 &&
    data.summary.contacts === 0 &&
    data.summary.connections === 0 &&
    data.summary.interested === 0 &&
    data.summary.meetings === 0 &&
    data.summary.active_discussions === 0 &&
    data.summary.partnerships === 0 &&
    data.today.activities.length === 0 &&
    data.upcoming_meetings.length === 0 &&
    data.recent_activity.length === 0

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-20 md:pl-64">
      <Navbar />
      {/* Top Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        {/* ── Header ── */}
        <header className="bg-[#110B2E]/80 backdrop-blur-md border border-slate-800/90 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Internal Business Development Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Business Development
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Welcome, <span className="text-white font-semibold">{user?.name || 'BD Team'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-center">
            {/* User Role Pill */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-violet-500/20 text-xs">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-slate-400">Role:</span>
              <span className="font-mono font-bold text-violet-300">{user?.role}</span>
            </div>

            {/* Live Refresh */}
            <button
              onClick={fetchDashboard}
              disabled={loading}
              title="Refresh Dashboard"
              className="p-2.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            </button>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="flex items-center space-x-2 py-2 px-3.5 rounded-xl bg-[#1A1040] hover:bg-red-500/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 border border-slate-800 transition text-xs font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* ── Main Content Body ── */}
        {loading && !data ? (
          /* Loading State */
          <div className="space-y-8 animate-pulse">
            <div>
              <div className="h-6 w-40 bg-slate-800/60 rounded-md mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-32 bg-[#110B2E] border border-slate-800/80 rounded-2xl p-5" />
                ))}
              </div>
            </div>
            <div className="h-36 bg-[#110B2E] border border-slate-800/80 rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-[#110B2E] border border-slate-800/80 rounded-2xl" />
              <div className="h-64 bg-[#110B2E] border border-slate-800/80 rounded-2xl" />
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-[#110B2E] border border-red-500/20 rounded-2xl p-10 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white">Unable to load dashboard data</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchDashboard}
              className="inline-flex items-center space-x-2 py-2 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition shadow-lg shadow-violet-600/20"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : isDataEmpty ? (
          /* Empty State */
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h2 className="text-xl font-bold text-white">No business activity yet</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start by discovering your first target organization in the directory.
            </p>
            <QuickActions />
          </div>
        ) : (
          /* Full Active Dashboard */
          <>
            {/* Phase 17 Real-Time Operational Intelligence */}
            <DailyPrioritiesWidget />

            {/* 1. Seven Summary Cards */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Outreach Overview</span>
                  <span className="text-xs font-normal text-slate-400">· Business Development metrics</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  title="Organizations"
                  count={data!.summary.organizations}
                  description="Total target organizations tracked"
                  icon={Building}
                  colorTheme="blue"
                />
                <SummaryCard
                  title="Contacts"
                  count={data!.summary.contacts}
                  description="Individual contacts & stakeholder records"
                  icon={UserCheck}
                  colorTheme="indigo"
                />
                <SummaryCard
                  title="Connections"
                  count={data!.summary.connections}
                  description="Organizations with active connections established"
                  icon={Link2}
                  colorTheme="emerald"
                />
                <SummaryCard
                  title="Interested"
                  count={data!.summary.interested}
                  description="Organizations showing interest in company projects"
                  icon={Star}
                  colorTheme="amber"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <SummaryCard
                  title="Meetings"
                  count={data!.summary.meetings}
                  description="Upcoming & scheduled partner presentations"
                  icon={Calendar}
                  colorTheme="purple"
                />
                <SummaryCard
                  title="Active Discussions"
                  count={data!.summary.active_discussions}
                  description="Partnership terms and project evaluations"
                  icon={MessageSquare}
                  colorTheme="indigo"
                />
                <SummaryCard
                  title="Partnerships"
                  count={data!.summary.partnerships}
                  description="Established strategic partners & customer alliances"
                  icon={Award}
                  colorTheme="violet"
                />
              </div>
            </section>

            {/* 2. Connection Pipeline (7 stages) */}
            <section>
              <ConnectionPipelineView pipeline={data!.pipeline} />
            </section>

            {/* Analytics Performance Summary Banner */}
            <section className="bg-[#110B2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    Business Development Analytics & Conversion Funnel
                  </h4>
                  <p className="text-xs text-slate-400">
                    Track stage transition efficiency, follow-up discipline, and opportunity velocity
                  </p>
                </div>
              </div>
              <Link
                to="/business-development/analytics"
                className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition shrink-0 self-start sm:self-center"
              >
                <span>View Full Analytics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            {/* Organization Discovery & Lead Sourcing Banner */}
            <section className="bg-gradient-to-r from-teal-950/30 via-slate-900 to-indigo-950/30 border border-teal-500/30 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    Organization Discovery & Lead Sourcing
                  </h4>
                  <p className="text-xs text-slate-400">
                    Discover new hospital networks, specialty clinics, and healthtech partners across target regions
                  </p>
                </div>
              </div>
              <Link
                to="/business-development/discover"
                className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-lg shadow-teal-600/30 shrink-0 self-start sm:self-center"
              >
                <span>Discover Organizations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            {/* 3. Project Showcase Entry Point */}
            <section className="bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-indigo-900/40 border border-violet-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-violet-300 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span>Showcase Our Projects</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Present ELLY Platform & Company Solutions
                </h3>
                <p className="text-xs text-slate-300 max-w-xl">
                  Equip your outreach calls with interactive product demonstrations, architectural briefs, and intelligence module overviews.
                </p>
              </div>
              <Link
                to="/business-development/showcase"
                className="inline-flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition shadow-lg shadow-violet-600/30 shrink-0 self-start sm:self-center"
              >
                <span>View Projects</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            {/* 4. Today's Activities */}
            <section>
              <TodayActivities activities={data!.today.activities} />
            </section>

            {/* 5. Upcoming Meetings */}
            <section>
              <UpcomingMeetings meetings={data!.upcoming_meetings} />
            </section>

            {/* 6. Follow-ups (Grouped Overdue, Today, Upcoming) */}
            <section>
              <FollowUpsSection followups={data!.followups} />
            </section>

            {/* 7. Recent Communications Log (Phase 8) */}
            <section>
              <RecentCommunicationsSection />
            </section>

            {/* 8. Recent Activity Feed */}
            <section>
              <RecentActivityFeed activities={data!.recent_activity} />
            </section>

            {/* 9. Quick Actions */}
            <section>
              <QuickActions />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
export default BusinessDevelopmentPortal
