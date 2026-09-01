import React from 'react'
import type { PipelineStageCount } from '../../types/analytics'
import { GitFork } from 'lucide-react'

interface PipelineFunnelChartProps {
  pipeline: PipelineStageCount[]
}

const STAGE_COLORS: Record<string, string> = {
  Potential: 'bg-slate-500 from-slate-600 to-slate-500',
  Contacted: 'bg-blue-500 from-blue-600 to-blue-500',
  Connected: 'bg-teal-500 from-teal-600 to-teal-500',
  Interested: 'bg-amber-500 from-amber-600 to-amber-500',
  Meeting: 'bg-purple-500 from-purple-600 to-purple-500',
  Discussion: 'bg-indigo-500 from-indigo-600 to-indigo-500',
  Partnership: 'bg-emerald-500 from-emerald-600 to-emerald-500',
}

export const PipelineFunnelChart: React.FC<PipelineFunnelChartProps> = ({ pipeline }) => {
  const maxCount = Math.max(...pipeline.map((p) => p.count), 1)

  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
              Connection Pipeline Funnel
            </h2>
            <p className="text-xs text-slate-400">
              Account distribution across all 7 stages of business relationship
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {pipeline.map((item) => {
          const barWidthPercent = Math.max(8, (item.count / maxCount) * 100)
          const gradient = STAGE_COLORS[item.stage] || 'from-violet-600 to-indigo-600'

          return (
            <div key={item.stage} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{item.stage}</span>
                <div className="flex items-center space-x-2 font-mono">
                  <span className="text-white font-bold">{item.count}</span>
                  <span className="text-slate-500 text-[11px]">({item.percentage}%)</span>
                </div>
              </div>

              <div className="h-3 w-full bg-[#1A1040] rounded-full overflow-hidden border border-slate-800/80 relative">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                  style={{ width: `${barWidthPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default PipelineFunnelChart
