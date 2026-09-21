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
import Navbar from '../components/layout/Navbar'
import { DailyPrioritiesWidget } from '../components/dashboard/DailyPrioritiesWidget'
import {
  Building,
  UserCheck,
  Link2,
  Star,
  Calendar,
  Award,
  LogOut,
  RotateCw,
  AlertCircle,
  Shield,
  Sparkles,
  Inbox,
  ArrowRight,
  Plus,
  Compass,
  BarChart3,
  GitFork,
  MessageSquare,
  Clock,
  Activity,
  CheckCircle2,
  Users,
} from 'lucide-react'

export const BusinessDevelopmentPortal: React.FC = () => {
  const { user, logout } = useAuth()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Workspace tab states for compact navigation
  const [leftTab, setLeftTab] = useState<'meetings' | 'followups' | 'today'>('meetings')
  const [rightTab, setRightTab] = useState<'priorities' | 'activity' | 'communications'>('priorities')

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

  const totalFollowups =
    data?.followups
      ? (data.followups.overdue?.length || 0) +
        (data.followups.today?.length || 0) +
        (data.followups.upcoming?.length || 0)
      : 0

  const overdueCount = data?.followups?.overdue?.length || 0

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-12 md:pl-64">
      <Navbar />
      {/* Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5 relative z-10">
        {/* ── Compact Executive Header ── */}
        <header className="bg-[#110B2E]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Business Development
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-semibold uppercase tracking-wider">
                  Live Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Welcome back, <span className="text-slate-200 font-medium">{user?.name || 'BD Manager'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            {/* Quick Action Buttons */}
            <Link
              to="/business-development/organizations/add"
              className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition shadow-md shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </Link>

            <Link
              to="/business-development/showcase"
              className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-violet-300 hover:text-white text-xs font-semibold transition border border-violet-500/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Showcase</span>
            </Link>

            {/* Role Pill */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#1A1040] border border-violet-500/20 text-[11px]">
              <Shield className="w-3 h-3 text-violet-400" />
              <span className="font-mono text-violet-300 font-semibold">{user?.role}</span>
            </div>

            {/* Live Refresh */}
            <button
              onClick={fetchDashboard}
              disabled={loading}
              title="Refresh Dashboard"
              className="p-2 rounded-lg bg-[#1A1040] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            </button>

            {/* Logout */}
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-2 rounded-lg bg-[#1A1040] hover:bg-red-500/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 border border-slate-800 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* ── Main Content Body ── */}
        {loading && !data ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-[#110B2E] border border-slate-800/80 rounded-xl" />
              ))}
            </div>
            <div className="h-24 bg-[#110B2E] border border-slate-800/80 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-72 bg-[#110B2E] border border-slate-800/80 rounded-xl" />
              <div className="h-72 bg-[#110B2E] border border-slate-800/80 rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="bg-[#110B2E] border border-red-500/20 rounded-2xl p-8 text-center space-y-3 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white">Unable to load dashboard data</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchDashboard}
              className="inline-flex items-center space-x-1.5 py-1.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition"
            >
              <RotateCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : isDataEmpty ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h2 className="text-lg font-bold text-white">No business activity yet</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start by discovering your first target organization or adding a contact.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                to="/business-development/discover"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
              >
                Discover Organizations
              </Link>
            </div>
          </div>
        ) : (
          /* High-Efficiency Compact Executive View (~1.5 Viewport Total) */
          <>
            {/* 1. Vital Metrics Row (Compact 6 Stat Pills) */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <SummaryCard
                title="Target Orgs"
                count={data!.summary.organizations}
                description="Total target organizations"
                icon={Building}
                colorTheme="blue"
                compact={true}
              />
              <SummaryCard
                title="Contacts"
                count={data!.summary.contacts}
                description="Key decision makers"
                icon={UserCheck}
                colorTheme="indigo"
                compact={true}
              />
              <SummaryCard
                title="Connections"
                count={data!.summary.connections}
                description="Active outreach dialogues"
                icon={Link2}
                colorTheme="emerald"
                compact={true}
              />
              <SummaryCard
                title="Interested"
                count={data!.summary.interested}
                description="Qualified prospect interest"
                icon={Star}
                colorTheme="amber"
                compact={true}
              />
              <SummaryCard
                title="Meetings"
                count={data!.summary.meetings}
                description="Scheduled presentations"
                icon={Calendar}
                colorTheme="purple"
                compact={true}
              />
              <SummaryCard
                title="Partnerships"
                count={data!.summary.partnerships}
                description="Won partnerships & alliances"
                icon={Award}
                colorTheme="violet"
                compact={true}
              />
            </section>

            {/* 2. Compact Connection Pipeline Stepper */}
            <section>
              <ConnectionPipelineView pipeline={data!.pipeline} compact={true} />
            </section>

            {/* 3. Dual-Column Action Workspace (~380px tall) */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Commercial Operations & Schedule */}
              <div className="bg-[#110B2E]/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
                <div>
                  {/* Segmented Tab Switcher */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
                    <div className="flex items-center space-x-1.5 bg-[#1A1040] p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setLeftTab('meetings')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          leftTab === 'meetings'
                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Meetings</span>
                        <span className="ml-1 text-[10px] opacity-80">({data!.upcoming_meetings.length})</span>
                      </button>

                      <button
                        onClick={() => setLeftTab('followups')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          leftTab === 'followups'
                            ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Follow-ups</span>
                        <span className="ml-1 text-[10px] opacity-80">({totalFollowups})</span>
                        {overdueCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        )}
                      </button>

                      <button
                        onClick={() => setLeftTab('today')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          leftTab === 'today'
                            ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Today</span>
                        <span className="ml-1 text-[10px] opacity-80">({data!.today.activities.length})</span>
                      </button>
                    </div>

                    <Link
                      to={
                        leftTab === 'meetings'
                          ? '/business-development/meetings'
                          : leftTab === 'followups'
                          ? '/business-development/followups'
                          : '/business-development/connections'
                      }
                      className="text-[11px] text-slate-400 hover:text-violet-300 flex items-center space-x-0.5 transition"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Scroll-contained Tab Content */}
                  <div className="max-h-[340px] overflow-y-auto pr-1">
                    {leftTab === 'meetings' && (
                      <UpcomingMeetings meetings={data!.upcoming_meetings} hideContainer={true} />
                    )}
                    {leftTab === 'followups' && (
                      <FollowUpsSection followups={data!.followups} hideContainer={true} />
                    )}
                    {leftTab === 'today' && (
                      <TodayActivities activities={data!.today.activities} hideContainer={true} />
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Commercial Intelligence & Activity */}
              <div className="bg-[#110B2E]/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
                <div>
                  {/* Segmented Tab Switcher */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
                    <div className="flex items-center space-x-1.5 bg-[#1A1040] p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setRightTab('priorities')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          rightTab === 'priorities'
                            ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Priorities</span>
                      </button>

                      <button
                        onClick={() => setRightTab('activity')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          rightTab === 'activity'
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Activity</span>
                        <span className="ml-1 text-[10px] opacity-80">({data!.recent_activity.length})</span>
                      </button>

                      <button
                        onClick={() => setRightTab('communications')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          rightTab === 'communications'
                            ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Outreach</span>
                      </button>
                    </div>

                    <Link
                      to={
                        rightTab === 'communications'
                          ? '/business-development/communications'
                          : rightTab === 'activity'
                          ? '/business-development/connections'
                          : '/business-development/analytics'
                      }
                      className="text-[11px] text-slate-400 hover:text-teal-300 flex items-center space-x-0.5 transition"
                    >
                      <span>{rightTab === 'communications' ? '+ Record' : 'Explore'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Scroll-contained Tab Content */}
                  <div className="max-h-[340px] overflow-y-auto pr-1">
                    {rightTab === 'priorities' && (
                      <DailyPrioritiesWidget hideContainer={true} />
                    )}
                    {rightTab === 'activity' && (
                      <RecentActivityFeed activities={data!.recent_activity} hideContainer={true} />
                    )}
                    {rightTab === 'communications' && (
                      <RecentCommunicationsSection hideContainer={true} />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Single-Row Fast Navigation Toolbar */}
            <section className="bg-[#110B2E]/90 border border-slate-800/80 rounded-2xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                Quick Shortcuts:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/business-development/discover"
                  className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-teal-500/20 hover:border-teal-500/30 border border-slate-800 text-slate-300 hover:text-teal-300 text-xs font-medium transition"
                >
                  <Compass className="w-3.5 h-3.5 text-teal-400" />
                  <span>Discover Organizations</span>
                </Link>
                <Link
                  to="/business-development/showcase"
                  className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-violet-500/20 hover:border-violet-500/30 border border-slate-800 text-slate-300 hover:text-violet-300 text-xs font-medium transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>Showcase Projects</span>
                </Link>
                <Link
                  to="/business-development/connections"
                  className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-indigo-500/20 hover:border-indigo-500/30 border border-slate-800 text-slate-300 hover:text-indigo-300 text-xs font-medium transition"
                >
                  <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Pipeline Board</span>
                </Link>
                <Link
                  to="/business-development/analytics"
                  className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-purple-500/20 hover:border-purple-500/30 border border-slate-800 text-slate-300 hover:text-purple-300 text-xs font-medium transition"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Funnel Analytics</span>
                </Link>
                <Link
                  to="/business-development/campaigns"
                  className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-cyan-500/20 hover:border-cyan-500/30 border border-slate-800 text-slate-300 hover:text-cyan-300 text-xs font-medium transition"
                >
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Campaigns</span>
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
export default BusinessDevelopmentPortal
