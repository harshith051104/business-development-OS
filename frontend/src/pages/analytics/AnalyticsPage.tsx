import React, { useState, useEffect, useCallback } from 'react'
import Navbar from '../../components/layout/Navbar'
import { analyticsService } from '../../services/analytics'
import type { ComprehensiveAnalytics } from '../../types/analytics'
import PipelineFunnelChart from '../../components/analytics/PipelineFunnelChart'
import ConversionRatesCard from '../../components/analytics/ConversionRatesCard'
import AttentionRequiredWidget from '../../components/analytics/AttentionRequiredWidget'
import TeamPerformanceTable from '../../components/analytics/TeamPerformanceTable'
import TopOpportunitiesTable from '../../components/analytics/TopOpportunitiesTable'
import CommunicationChannelBadge from '../../components/communications/CommunicationChannelBadge'
import {
  BarChart3,
  Download,
  Building2,
  Users,
  GitFork,
  Star,
  Calendar,
  MessageSquare,
  Target,
  Award,
  Clock,
  RotateCw,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  DollarSign,
} from 'lucide-react'

const DATE_RANGES = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3_months' },
  { label: 'This Year', value: 'this_year' },
  { label: 'All Time', value: 'all_time' },
]

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<ComprehensiveAnalytics | null>(null)
  const [dateRange, setDateRange] = useState<string>('this_month')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<boolean>(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsService.getAnalytics({ date_range: dateRange })
      setData(res)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load analytics data.')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      await analyticsService.downloadCsvExport({ date_range: dateRange })
    } catch (err) {
      alert('Failed to export CSV report.')
    } finally {
      setIsExporting(false)
    }
  };

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-5 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Business Development Analytics & Performance
            </h1>
            <p className="text-xs text-slate-400">
              Pipeline conversion ratios, activity metrics, and partnership insights
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Period:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value} className="bg-[#110B2E] text-white">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting || loading}
            className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold transition disabled:opacity-50"
          >
            {isExporting ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="py-32 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Calculating business analytics...</p>
          </div>
        ) : error || !data ? (
          <div className="p-12 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Generating Analytics</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* 1. Top-Level Metric Summary Cards (8 metrics) */}
            <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  <span>Organizations</span>
                </div>
                <div className="text-xl font-mono font-bold text-white">
                  {data.overview.total_organizations}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <Users className="w-3 h-3 text-teal-400" />
                  <span>Contacts</span>
                </div>
                <div className="text-xl font-mono font-bold text-white">
                  {data.overview.total_contacts}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <GitFork className="w-3 h-3 text-emerald-400" />
                  <span>Connections</span>
                </div>
                <div className="text-xl font-mono font-bold text-white">
                  {data.overview.total_connections}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <Star className="w-3 h-3 text-amber-400" />
                  <span>Interested</span>
                </div>
                <div className="text-xl font-mono font-bold text-amber-300">
                  {data.overview.interested_organizations}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <Calendar className="w-3 h-3 text-purple-400" />
                  <span>Meetings</span>
                </div>
                <div className="text-xl font-mono font-bold text-white">
                  {data.overview.total_meetings}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <MessageSquare className="w-3 h-3 text-indigo-400" />
                  <span>Discussions</span>
                </div>
                <div className="text-xl font-mono font-bold text-white">
                  {data.overview.active_discussions}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                  <Target className="w-3 h-3 text-violet-400" />
                  <span>Opportunities</span>
                </div>
                <div className="text-xl font-mono font-bold text-violet-300">
                  {data.overview.active_opportunities}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#110B2E] border border-emerald-500/30 bg-emerald-950/10 shadow-xl space-y-1">
                <div className="flex items-center space-x-1 text-emerald-400 text-[11px] font-semibold">
                  <Award className="w-3 h-3 text-emerald-400" />
                  <span>Partnerships</span>
                </div>
                <div className="text-xl font-mono font-bold text-emerald-400">
                  {data.overview.partnerships_established}
                </div>
              </div>
            </section>

            {/* 2. Attention Required & Action Bottlenecks */}
            <section>
              <AttentionRequiredWidget attention={data.attention_required} />
            </section>

            {/* 3. Pipeline Funnel & Stage Conversion Rates */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PipelineFunnelChart pipeline={data.pipeline} />
              <ConversionRatesCard conversions={data.conversion_rates} />
            </section>

            {/* 4. Meetings, Follow-ups, and Financial Value Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Meeting Completion Metrics */}
              <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>Meeting Velocity</span>
                  </span>
                  <span className="font-mono text-xs text-purple-400 font-bold">
                    {data.meetings.completion_rate !== null
                      ? `${data.meetings.completion_rate}% Completed`
                      : 'No data'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Completed:</span>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      {data.meetings.completed}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Scheduled:</span>
                    <div className="text-base font-bold font-mono text-blue-400 mt-0.5">
                      {data.meetings.scheduled}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Rescheduled:</span>
                    <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                      {data.meetings.rescheduled}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Cancelled:</span>
                    <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                      {data.meetings.cancelled}
                    </div>
                  </div>
                </div>
              </div>

              {/* Follow-up Discipline Metrics */}
              <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Follow-up Discipline</span>
                  </span>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {data.followups.completion_rate !== null
                      ? `${data.followups.completion_rate}% Resolved`
                      : 'No data'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Completed:</span>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      {data.followups.completed}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Pending:</span>
                    <div className="text-base font-bold font-mono text-blue-400 mt-0.5">
                      {data.followups.pending}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Overdue:</span>
                    <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                      {data.followups.overdue}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
                    <span className="text-slate-400">Cancelled:</span>
                    <div className="text-base font-bold font-mono text-slate-400 mt-0.5">
                      {data.followups.cancelled}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Evaluation */}
              <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Pipeline Financial Value</span>
                  </span>
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    {data.opportunities.active} Active Deals
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400">Total Estimated Pipeline:</span>
                  <div className="text-2xl font-mono font-extrabold text-emerald-400">
                    {data.opportunities.has_financial_data && data.opportunities.total_estimated_value
                      ? `${data.opportunities.currency} ${data.opportunities.total_estimated_value.toLocaleString()}`
                      : 'Value data unavailable'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Calculated only across opportunities with declared valuation figures.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. Communication Channel Activity */}
            <section className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                      Recorded Communication Activity ({data.communications.total} Total)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Engagement channel audit volume recorded by Business Development
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {Object.entries(data.communications.channel_counts).map(([ch, cnt]) => (
                  <div
                    key={ch}
                    className="p-3 rounded-xl bg-[#1A1040] border border-slate-800 flex flex-col justify-between space-y-2"
                  >
                    <CommunicationChannelBadge channel={ch} size="sm" />
                    <div className="text-base font-mono font-bold text-white">{cnt}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Top High-Priority Active Opportunities */}
            <section>
              <TopOpportunitiesTable opportunities={data.top_opportunities} />
            </section>

            {/* 7. Team Operational Activity Table */}
            <section>
              <TeamPerformanceTable team={data.team_performance} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
export default AnalyticsPage
