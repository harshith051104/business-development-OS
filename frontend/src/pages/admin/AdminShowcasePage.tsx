import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import type { Project } from '../../types/project'
import {
  Sparkles,
  Plus,
  Search,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Archive,
  Edit2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileCheck,
  Eye,
} from 'lucide-react'

export const AdminShowcasePage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)

  const [search, setSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminService.listShowcaseProjects({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      })
      setProjects(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleStatusChange = async (projectId: number, newStatus: string) => {
    try {
      await adminService.updateShowcaseProjectStatus(projectId, newStatus)
      fetchProjects()
    } catch (err: any) {
      alert(err.detail || 'Failed to update project status.')
    }
  }

  const handleArchive = async (projectId: number) => {
    if (!window.confirm('Are you sure you want to archive this showcase project?')) return
    try {
      await adminService.deleteShowcaseProject(projectId)
      fetchProjects()
    } catch (err: any) {
      alert(err.detail || 'Failed to archive project.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Project Showcase Governance
            </h1>
            <p className="text-xs text-slate-400">
              Approve, publish, maintain, and archive approved initiatives presented by BD
            </p>
          </div>
        </div>

        <Link
          to="/admin/showcase/new"
          className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </Link>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search projects by name, description, tags..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
              >
                <option value="All">All Governance Statuses</option>
                <option value="Published">Published (Live in BD Portal)</option>
                <option value="Review">Review (Under Evaluation)</option>
                <option value="Draft">Draft (Work in Progress)</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects Listing Table */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading showcase initiatives...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No projects available.</h3>
            <p className="text-xs text-slate-400">Create and publish projects for Business Development presentations.</p>
          </div>
        ) : (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">Initiative</th>
                    <th className="p-3.5 font-semibold">Category</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Approved Links</th>
                    <th className="p-3.5 font-semibold">Updated</th>
                    <th className="p-3.5 font-semibold text-right">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {projects.map((proj) => (
                    <tr key={proj.id} className="hover:bg-[#1A1040]/40 transition">
                      <td className="p-3.5 max-w-xs">
                        <div className="font-bold text-white truncate block">{proj.name}</div>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {proj.short_description}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {proj.category}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            proj.status === 'Published' || proj.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : proj.status === 'Review'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : proj.status === 'Draft'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <span>{proj.status}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        <div className="flex items-center space-x-2">
                          {proj.demo_url && (
                            <a
                              href={proj.demo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-0.5"
                            >
                              <span>Demo</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          {proj.presentation_url && (
                            <a
                              href={proj.presentation_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-0.5"
                            >
                              <span>Deck</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(proj.updated_at).toLocaleDateString()}
                      </td>

                      <td className="p-3.5 text-right space-x-2">
                        {proj.status !== 'Published' && (
                          <button
                            onClick={() => handleStatusChange(proj.id, 'Published')}
                            className="py-1 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                          >
                            Publish
                          </button>
                        )}

                        {proj.status === 'Draft' && (
                          <button
                            onClick={() => handleStatusChange(proj.id, 'Review')}
                            className="py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                          >
                            Submit Review
                          </button>
                        )}

                        <Link
                          to={`/admin/showcase/${proj.id}/edit`}
                          className="py-1 px-2.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs transition inline-block"
                        >
                          Edit
                        </Link>

                        <button
                          onClick={() => handleArchive(proj.id)}
                          className="py-1 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs transition"
                        >
                          Archive
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
    </div>
  )
}
export default AdminShowcasePage
