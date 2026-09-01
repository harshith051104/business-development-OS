import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { outreachService } from '../../services/outreach'
import type { OutreachDraft, OutreachChannelType, DraftStatusType } from '../../types/outreach'
import {
  Bookmark,
  Send,
  Building2,
  Users,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  Trash2,
  ArrowRight,
  RotateCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

export const OutreachDraftsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<OutreachDraft[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)

  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [channelFilter, setChannelFilter] = useState<string>('All')
  const [loading, setLoading] = useState<boolean>(false)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await outreachService.listDrafts({
        page,
        page_size: pageSize,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        channel: channelFilter !== 'All' ? channelFilter : undefined,
      })
      setDrafts(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (err) {
      console.error('Failed to load drafts:', err)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, channelFilter])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) return
    try {
      await outreachService.deleteDraft(id)
      setDrafts((prev) => prev.filter((d) => d.id !== id))
      setTotal((prev) => prev - 1)
    } catch (err) {
      alert('Failed to delete draft.')
    }
  }

  const getChannelIcon = (ch: OutreachChannelType) => {
    switch (ch) {
      case 'Email':
        return <Mail className="w-3.5 h-3.5 text-sky-400" />
      case 'Phone':
        return <Phone className="w-3.5 h-3.5 text-emerald-400" />
      case 'LinkedIn':
        return <Globe className="w-3.5 h-3.5 text-blue-400" />
      case 'WhatsApp':
        return <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
      default:
        return <Send className="w-3.5 h-3.5 text-violet-400" />
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Saved Outreach Drafts
            </h1>
            <p className="text-xs text-slate-400">
              Manage in-progress pitches, prepared messages, and call plans
            </p>
          </div>
        </div>

        <Link
          to="/business-development/outreach"
          className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>New Outreach Workspace</span>
        </Link>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* Filters Bar */}
        <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Ready">Ready</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <div className="flex items-center space-x-1.5 text-slate-400 pl-3">
              <span>Channel:</span>
            </div>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
            >
              <option value="All">All Channels</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Total drafts: <strong className="text-white">{total}</strong>
          </span>
        </div>

        {/* Drafts Listing */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading drafts...</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Bookmark className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Outreach Drafts Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Save message drafts or call discussion notes in the Outreach Workspace to access them here.
            </p>
            <Link
              to="/business-development/outreach"
              className="inline-block px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Open Outreach Workspace
            </Link>
          </div>
        ) : (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">Organization</th>
                    <th className="p-3.5 font-semibold">Contact</th>
                    <th className="p-3.5 font-semibold">Channel</th>
                    <th className="p-3.5 font-semibold">Subject / Purpose</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Updated</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {drafts.map((d) => (
                    <tr key={d.id} className="hover:bg-[#1A1040]/40 transition">
                      <td className="p-3.5 font-bold text-white">
                        <Link
                          to={`/business-development/organizations/${d.organization_id}`}
                          className="hover:text-violet-300 transition"
                        >
                          {d.organization_name || `Org #${d.organization_id}`}
                        </Link>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {d.contact_name || <span className="text-slate-500 italic">General Account</span>}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#1A1040] border border-slate-800 text-slate-300 text-[11px]">
                          {getChannelIcon(d.channel)}
                          <span>{d.channel}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-200 max-w-xs truncate">
                        {d.subject || d.call_purpose || <span className="text-slate-500 italic">No subject</span>}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            d.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : d.status === 'Ready'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : d.status === 'Cancelled'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(d.updated_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => navigate(`/business-development/outreach?draft_id=${d.id}`)}
                          className="py-1 px-2.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition"
                        >
                          Resume
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-1 rounded-lg bg-[#1A1040] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Page {page} of {totalPages}
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
export default OutreachDraftsListPage
