import React, { useState } from 'react'
import type { ContactRelationshipStatus } from '../../types/contact'
import { X, UserCheck, Loader2 } from 'lucide-react'

interface ContactStatusModalProps {
  isOpen: boolean
  contactName: string
  currentStatus: string
  onClose: () => void
  onConfirm: (newStatus: string, note?: string) => Promise<void>
}

const statusOptions: ContactRelationshipStatus[] = [
  'Not Contacted',
  'Contacted',
  'Connected',
  'Interested',
  'Inactive',
]

export const ContactStatusModal: React.FC<ContactStatusModalProps> = ({
  isOpen,
  contactName,
  currentStatus,
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
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Update Contact Status</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{contactName}</p>
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
              Relationship Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
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
              Interaction Details / Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Conducted 20-min introductory call; confirmed interest in platform intelligence modules."
              className="w-full px-3 py-2 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500 resize-none"
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
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Relationship</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default ContactStatusModal
