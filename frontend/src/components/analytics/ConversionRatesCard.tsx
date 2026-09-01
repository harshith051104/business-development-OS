import React from 'react'
import type { ConversionRates } from '../../types/analytics'
import { TrendingUp, ArrowRight, CheckCircle2 } from 'lucide-react'

interface ConversionRatesCardProps {
  conversions: ConversionRates
}

export const ConversionRatesCard: React.FC<ConversionRatesCardProps> = ({ conversions }) => {
  const steps = [
    conversions.contacted_to_connected,
    conversions.connected_to_interested,
    conversions.interested_to_meeting,
    conversions.meeting_to_discussion,
    conversions.discussion_to_partnership,
  ]

  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
              Stage Conversion Efficiency
            </h2>
            <p className="text-xs text-slate-400">
              Step-by-step transition conversion rates between stages
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {steps.map((step, idx) => {
          return (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-1.5 font-medium">
                  <span className="text-slate-300">{step.from_stage}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-violet-300 font-semibold">{step.to_stage}</span>
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {step.rate !== null ? `${step.rate}%` : 'Not enough data'}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {step.to_count} / {step.from_count}
                </span>
              </div>
            </div>
          )
        })}

        {/* Overall Funnel */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-950/40 to-indigo-950/30 border border-violet-500/30 flex flex-col justify-between space-y-3">
          <div className="flex items-center space-x-1.5 text-xs text-violet-300 font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Overall Conversion</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {conversions.overall_funnel.rate !== null
                ? `${conversions.overall_funnel.rate}%`
                : 'Not enough data'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {conversions.overall_funnel.to_count} / {conversions.overall_funnel.from_count} orgs
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
export default ConversionRatesCard
