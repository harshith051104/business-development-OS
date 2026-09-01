import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { partnershipsService } from '../../services/partnerships'
import type { Opportunity } from '../../types/opportunity'
import type { PartnershipType, PartnershipPriority } from '../../types/partnership'
import {
  Handshake,
  Building2,
  Users,
  Target,
  Sparkles,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react'

interface Props {
  opportunity: Opportunity
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const PARTNERSHIP_TYPES: PartnershipType[] = [
  'Technology Partnership',
  'Business Partnership',
  'Strategic Partnership',
  'Integration Partnership',
  'Service Partnership',
  'Distribution Partnership',
  'Referral Partnership',
  'Other',
]

export const ConvertToPartnershipModal: React.FC<Props> = ({
  opportunity,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate()
  const [name, setName] = useState<string>(`${opportunity.name} Partnership`)
  const [partnershipType, setPartnershipType] = useState<PartnershipType>('Technology Partnership')
  const [priority, setPriority] = useState<PartnershipPriority>(
    (opportunity.priority as PartnershipPriority) || 'Medium'
  )
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState<string>('')
  const [objectives, setObjectives] = useState<string>(opportunity.description || '')
  const [nextAction, setNextAction] = useState<string>(
    opportunity.next_action || 'Schedule partnership alignment meeting'
  )
  const [updateOrgStatus, setUpdateOrgStatus] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Partnership name is required.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const created = await partnershipsService.convertFromOpportunity(opportunity.id, {
        name: name.trim(),
        partnership_type: partnershipType,
        priority,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        objectives: objectives.trim() || undefined,
        next_action: nextAction.trim() || undefined,
        update_organization_status: updateOrgStatus,
      })

      onClose()
      if (onSuccess) onSuccess()
      navigate(`/business-development/partnerships/${created.id}`)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to convert opportunity to partnership.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Convert Opportunity to Partnership</h3>
              <p className="text-xs text-slate-400">
                Establish a formal business partnership relationship
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Opportunity Peek Context */}
        <div className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Organization</span>
            <span className="font-bold text-white truncate block">{opportunity.organization_name}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Contact</span>
            <span className="font-medium text-slate-300 truncate block">
              {opportunity.primary_contact_name || 'General Org'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Current Stage</span>
            <span className="font-medium text-violet-400 block">{opportunity.stage}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Project</span>
            <span className="font-medium text-slate-300 truncate block">
              {opportunity.project_title || 'N/A'}
            </span>
          </div>
        </div>

        {/* Conversion Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">
              Partnership Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white font-medium text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">
                Partnership Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={partnershipType}
                onChange={(e) => setPartnershipType(e.target.value as PartnershipType)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              >
                {PARTNERSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PartnershipPriority)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">End Date (Optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Agreed Objectives / Scope</label>
            <textarea
              rows={3}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="Outline key strategic goals and milestones..."
              className="w-full p-3 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Next Action</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Schedule executive steering committee..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Status Update Checkbox */}
          <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800">
            <label className="flex items-center space-x-2 text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={updateOrgStatus}
                onChange={(e) => setUpdateOrgStatus(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-0"
              />
              <span>Update Organization relationship status to "Partnership"</span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {loading ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Confirm & Establish Partnership</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default ConvertToPartnershipModal
