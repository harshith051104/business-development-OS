import React from 'react'
import type { ConnectionPipeline } from '../../types/dashboard'
import {
  GitFork,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from 'lucide-react'

interface ConnectionPipelineViewProps {
  pipeline: ConnectionPipeline
  compact?: boolean
}

const stages = [
  { key: 'potential', label: 'Potential', color: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30' },
  { key: 'contacted', label: 'Contacted', color: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/30' },
  { key: 'connected', label: 'Connected', color: 'from-teal-500/20 to-teal-500/5 text-teal-400 border-teal-500/30' },
  { key: 'interested', label: 'Interested', color: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30' },
  { key: 'meeting', label: 'Meeting', color: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/30' },
  { key: 'discussion', label: 'Discussion', color: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/30' },
  { key: 'partnership', label: 'Partnership', color: 'from-violet-500/30 to-violet-500/10 text-violet-300 border-violet-500/50' },
]

export const ConnectionPipelineView: React.FC<ConnectionPipelineViewProps> = ({
  pipeline,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="bg-[#110B2E]/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <GitFork className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Connection Pipeline</span>
                <span className="text-[11px] font-normal text-slate-400">· 7 stages</span>
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-mono text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
            Active Funnel
          </span>
        </div>

        {/* Compact Pipeline Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {stages.map((stg, idx) => {
            const count = (pipeline as any)[stg.key] || 0
            const isLast = idx === stages.length - 1

            return (
              <div
                key={stg.key}
                className={`p-2.5 rounded-xl bg-gradient-to-b ${stg.color} border transition-all duration-200 hover:-translate-y-0.5 relative flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {stg.label}
                  </span>
                  {!isLast && (
                    <ChevronRight className="w-3 h-3 text-slate-600 hidden lg:block shrink-0" />
                  )}
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-white font-mono">
                  {count}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#110B2E] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Connection Pipeline</h2>
            <p className="text-xs text-slate-400">Progression from discovery to established partnerships</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 text-[11px] font-medium border border-violet-500/20">
          <Sparkles className="w-3 h-3" />
          <span>7 Active Stages</span>
        </span>
      </div>

      {/* Responsive Pipeline Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
        {stages.map((stg, idx) => {
          const count = (pipeline as any)[stg.key] || 0
          const isLast = idx === stages.length - 1

          return (
            <div
              key={stg.key}
              className={`p-3.5 rounded-xl bg-gradient-to-b ${stg.color} border transition-all duration-300 hover:-translate-y-0.5 relative flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {stg.label}
                </span>
                {!isLast && (
                  <ChevronRight className="w-3 h-3 text-slate-600 hidden lg:block" />
                )}
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {count}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {idx === 0
                  ? 'Identified'
                  : idx === 1
                  ? 'Outreach initiated'
                  : idx === 2
                  ? 'Engaged'
                  : idx === 3
                  ? 'Active interest'
                  : idx === 4
                  ? 'Scheduled'
                  : idx === 5
                  ? 'In negotiation'
                  : 'Partnership won'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default ConnectionPipelineView
