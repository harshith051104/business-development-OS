import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, Sparkles } from 'lucide-react'

interface PhasePlaceholderProps {
  title: string
  phaseNumber: number
  description: string
}

export const PhasePlaceholder: React.FC<PhasePlaceholderProps> = ({
  title,
  phaseNumber,
  description,
}) => {
  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[#110B2E] border border-violet-500/20 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wide uppercase mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Scheduled for Phase {phaseNumber}</span>
        </div>

        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 text-violet-400">
          <Clock className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
          {title}
        </h1>

        <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
          {description}
        </p>

        <div className="p-3.5 bg-[#1A1040] border border-slate-800 rounded-xl text-xs text-slate-400 mb-6">
          Phase 2 focuses strictly on the Business Development Dashboard layout and live data orchestration.
        </div>

        <Link
          to="/business-development"
          className="inline-flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition shadow-lg shadow-violet-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to BD Dashboard</span>
        </Link>
      </div>
    </div>
  )
}
export default PhasePlaceholder
