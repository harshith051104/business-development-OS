import React, { useState } from 'react'
import type { ConnectionStatus } from '../../types/organization'
import { X, GitFork, Loader2 } from 'lucide-react'

interface StatusChangeModalProps {
  isOpen: boolean
  currentStatus: string
  organizationName: string
  onClose: () => void
  onConfirm: (newStatus: string, note?: string) => Promise<void>
}

const statusOptions: ConnectionStatus[] = [
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  currentStatus,
  organizationName,
  onClose,
  onConfirm,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus)
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm(selectedStatus, note)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Update Connection Status</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{organizationName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Pipeline Stage
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
            >
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Transition Reason / Internal Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Completed initial presentation with decision-maker; agreed to review proposal."
              className="w-full px-3 py-2 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Status</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default StatusChangeModal
