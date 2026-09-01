import React, { useEffect, useState } from 'react';
import { reportService } from '../services/reports';
import type { FunnelReport } from '../types/reports';
import Navbar from '../components/layout/Navbar';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  DollarSign, 
  Tv, 
  FileText, 
  Scale, 
  Handshake, 
  Award,
  RefreshCw,
  Layers
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [report, setReport] = useState<FunnelReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await reportService.getFunnelReport();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-teal-400" />
            10-Stage Commercial Funnel Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            End-to-end commercial pipeline conversion rates, stage velocity, lead source attribution, and deal values.
          </p>
        </div>

        <button
          onClick={loadReport}
          className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium rounded-xl transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Report</span>
        </button>
      </div>

      {loading || !report ? (
        <div className="text-center py-20 text-slate-400">Loading commercial reports...</div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block">Total Pipeline</span>
              <span className="text-lg font-bold text-teal-300 mt-1 block">
                ₹{report.total_pipeline_value?.toLocaleString('en-IN') || 0}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block">Organizations</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {report.total_organizations}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block">Demos Completed</span>
              <span className="text-lg font-bold text-sky-400 mt-1 block">
                {report.total_demos_completed}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block">Proposals Active</span>
              <span className="text-lg font-bold text-indigo-400 mt-1 block">
                {report.total_proposals_active}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block">Negotiations</span>
              <span className="text-lg font-bold text-violet-400 mt-1 block">
                {report.total_negotiations_active}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block">Active Customers</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                {report.total_customers_active}
              </span>
            </div>
          </div>

          {/* 10-Stage Funnel Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-teal-400" />
              <span>10-Stage Commercial Funnel Breakdown</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Deal Count</th>
                    <th className="py-3 px-4">Total Value (₹)</th>
                    <th className="py-3 px-4">Avg Days in Stage</th>
                    <th className="py-3 px-4">Conversion to Next</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report.stages.map((st, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span>{st.stage}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{st.count}</td>
                      <td className="py-3.5 px-4 font-mono font-medium text-teal-300">
                        ₹{st.total_value?.toLocaleString('en-IN') || 0}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{st.avg_days_in_stage} days</td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-400">
                        {st.conversion_rate_to_next}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lead Source Breakdown & Rep Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4">Lead Source Ingestion Distribution</h3>
              <div className="space-y-3">
                {Object.entries(report.lead_source_breakdown).map(([source, count], idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="text-sm font-medium text-slate-300">{source}</span>
                    <span className="text-sm font-bold text-teal-400">{count} leads</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4">BD Team Execution</h3>
              <div className="space-y-3">
                {report.rep_performance.map((rep, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                    <div>
                      <span className="text-sm font-bold text-white block">{rep.rep_name}</span>
                      <span className="text-xs text-slate-400">{rep.role}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-teal-300 block">
                        ₹{rep.pipeline_value?.toLocaleString('en-IN') || 0}
                      </span>
                      <span className="text-xs text-slate-400">{rep.active_deals} active deals</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      </main>
    </div>
  );
};
