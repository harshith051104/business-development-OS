import React, { useState, useEffect, useCallback } from 'react'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import type { AuditLog } from '../../types/audit'
import {
  History,
  Search,
  RotateCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react'

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(20)
  const [totalPages, setTotalPages] = useState<number>(1)

  const [search, setSearch] = useState<string>('')
  const [resourceType, setResourceType] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetaLog, setSelectedMetaLog] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminService.getAuditLogs({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        resource_type: resourceType || undefined,
        user_email: userEmail.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setLogs(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, resourceType, userEmail, startDate, endDate])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Audit & Governance Logs
            </h1>
            <p className="text-xs text-slate-400">
              Immutable system record of user operations, permission changes, and security events
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSearch('')
            setResourceType('')
            setUserEmail('')
            setStartDate('')
            setEndDate('')
            setPage(1)
          }}
          className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          <span>Reset Filters</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search action or metadata..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={resourceType}
                onChange={(e) => {
                  setResourceType(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="">All Resource Types</option>
                <option value="USER">USER</option>
                <option value="ORGANIZATION">ORGANIZATION</option>
                <option value="OPPORTUNITY">OPPORTUNITY</option>
                <option value="PARTNERSHIP">PARTNERSHIP</option>
                <option value="PROJECT">PROJECT</option>
                <option value="MEETING">MEETING</option>
                <option value="SETTINGS">SETTINGS</option>
                <option value="ASSIGNMENTS">ASSIGNMENTS</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <input
                type="text"
                value={userEmail}
                onChange={(e) => {
                  setUserEmail(e.target.value)
                  setPage(1)
                }}
                placeholder="Filter by user email..."
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
            <History className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No audit logs found matching criteria.</h3>
            <p className="text-xs text-slate-400">Clear filters or try searching for another term.</p>
          </div>
        ) : (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">Timestamp</th>
                    <th className="p-3.5 font-semibold">Action</th>
                    <th className="p-3.5 font-semibold">Resource</th>
                    <th className="p-3.5 font-semibold">Initiating User</th>
                    <th className="p-3.5 font-semibold">Metadata Summary</th>
                    <th className="p-3.5 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1A1040]/40 transition">
                      <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-white tracking-wide">
                          {log.action}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-cyan-300 font-bold border border-slate-700">
                          {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ''}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-300 text-[11px]">
                        {log.user_email || 'System'}
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px] max-w-xs truncate">
                        {log.metadata_json || '—'}
                      </td>

                      <td className="p-3.5 text-right font-sans">
                        <button
                          onClick={() => setSelectedMetaLog(log)}
                          className="py-1 px-2 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] transition"
                        >
                          Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Page {page} of {totalPages} (Total: {total})
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Metadata Detail Modal */}
      {selectedMetaLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
              <h3 className="text-sm font-bold text-white">
                Audit Record #{selectedMetaLog.id}
              </h3>
              <span className="text-[10px] text-cyan-300 font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded">
                {selectedMetaLog.action}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-slate-400">User: <span className="text-white">{selectedMetaLog.user_email || 'System'}</span></div>
              <div className="text-slate-400">Resource: <span className="text-white">{selectedMetaLog.resource_type} (ID: {selectedMetaLog.resource_id || 'N/A'})</span></div>
              <div className="text-slate-400">Timestamp: <span className="text-white">{selectedMetaLog.timestamp}</span></div>
            </div>

            <div className="space-y-1">
              <div className="font-sans font-semibold text-slate-300">Payload Metadata</div>
              <pre className="p-3 rounded-xl bg-[#0B091D] border border-slate-800 text-cyan-300 text-[11px] overflow-x-auto max-h-60">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedMetaLog.metadata_json || '{}'), null, 2)
                  } catch {
                    return selectedMetaLog.metadata_json || 'No payload'
                  }
                })()}
              </pre>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end font-sans">
              <button
                type="button"
                onClick={() => setSelectedMetaLog(null)}
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminAuditLogsPage
