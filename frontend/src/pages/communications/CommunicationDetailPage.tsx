import React, { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { communicationsService } from '../../services/communications'
import type { Communication } from '../../types/communication'
import CommunicationChannelBadge from '../../components/communications/CommunicationChannelBadge'
import CommunicationDirectionBadge from '../../components/communications/CommunicationDirectionBadge'
import {
  MessageSquare,
  ArrowLeft,
  Edit,
  Trash2,
  Building2,
  User,
  Target,
  Calendar,
  Clock,
  RotateCw,
  AlertCircle,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react'

export const CommunicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  const fetchDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await communicationsService.getCommunication(id)
      setCommunication(data)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load communication record.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  const handleDelete = async () => {
    if (!communication) return
    setIsDeleting(true)
    try {
      await communicationsService.deleteCommunication(communication.id)
      navigate('/business-development/communications')
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to delete communication.')
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <RotateCw className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      </div>
    )
  }

  if (error || !communication) {
    return (
      <div className="min-h-screen bg-[#0A071B] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3 max-w-md">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Record Not Found</h3>
            <p className="text-xs text-slate-400">{error || 'This communication record does not exist.'}</p>
            <Link
              to="/business-development/communications"
              className="inline-flex px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Back to Communications
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/business-development/communications"
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {communication.subject}
              </h1>
              <CommunicationChannelBadge channel={communication.channel} size="sm" />
              <CommunicationDirectionBadge direction={communication.direction} size="sm" />
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{communication.organization_name}</span>
              {communication.contact_name && (
                <>
                  <span>·</span>
                  <span className="text-teal-400">{communication.contact_name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            to={`/business-development/communications/${communication.id}/edit`}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 transition border border-slate-800"
            title="Edit Record"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 rounded-xl bg-[#1A1040] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition border border-slate-800 hover:border-rose-500/30"
            title="Delete Record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Content & Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Executive Summary */}
            {communication.summary && (
              <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                  Executive Summary
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {communication.summary}
                </p>
              </div>
            )}

            {/* Content / Discussion Notes */}
            <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Communication Notes / Body Content
              </h3>
              {communication.content ? (
                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {communication.content}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-500 italic">
                  No additional notes recorded for this communication.
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Metadata & References */}
          <div className="space-y-6">
            {/* Meta Card */}
            <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-3.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Interaction Details
              </span>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Date & Time:</span>
                <span className="font-mono font-bold text-white">
                  {new Date(communication.communication_date).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Status:</span>
                <span className="font-semibold text-emerald-400">{communication.status}</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Recorded By:</span>
                <span>{communication.created_by || 'BD Team'}</span>
              </div>
            </div>

            {/* Target Organization */}
            <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-violet-400" />
                <span>Target Organization</span>
              </span>
              <Link
                to={`/business-development/organizations/${communication.organization_id}`}
                className="text-sm font-bold text-white hover:text-violet-300 transition flex items-center justify-between group"
              >
                <span>{communication.organization_name}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
              </Link>
            </div>

            {/* Key Contact */}
            {communication.contact_name && (
              <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  <span>Key Stakeholder</span>
                </span>
                <Link
                  to={`/business-development/contacts/${communication.contact_id}`}
                  className="text-sm font-bold text-white hover:text-teal-300 transition flex items-center justify-between group"
                >
                  <span>{communication.contact_name}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                </Link>
                {communication.contact_designation && (
                  <div className="text-xs text-slate-400">{communication.contact_designation}</div>
                )}
              </div>
            )}

            {/* Opportunity Reference */}
            {communication.opportunity_name && (
              <div className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2">
                <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-violet-400" />
                  <span>Associated Opportunity</span>
                </span>
                <Link
                  to={`/business-development/opportunities/${communication.opportunity_id}`}
                  className="text-sm font-bold text-white hover:text-violet-300 transition flex items-center justify-between group"
                >
                  <span>{communication.opportunity_name}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-sm font-bold text-white">Delete Communication Log</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove this communication record?
            </p>
            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CommunicationDetailPage
