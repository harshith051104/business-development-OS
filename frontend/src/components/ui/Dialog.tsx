import React, { useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

interface DialogProps {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}

/** Modal dialog with Escape-to-close and focus moved inside on open. */
export const Dialog: React.FC<DialogProps> = ({ title, open, onClose, children, footer }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-[#110B2E] border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-slate-300 space-y-3">{children}</div>
        <div className="flex items-center justify-end gap-2 pt-1">{footer}</div>
      </div>
    </div>
  )
}

export const buttonClass = {
  primary: 'px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50',
  secondary: 'px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 text-xs',
  danger: 'px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50',
}

export interface NoticeState {
  kind: 'success' | 'error'
  text: string
}

/** Inline result message for an action (instead of a browser alert). */
export const Notice: React.FC<{ notice: NoticeState | null; onDismiss: () => void }> = ({ notice, onDismiss }) => {
  if (!notice) return null
  const ok = notice.kind === 'success'
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
        ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
      }`}
    >
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{notice.text}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
