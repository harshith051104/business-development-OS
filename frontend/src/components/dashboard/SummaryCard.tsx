import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface SummaryCardProps {
  title: string
  count: number
  description: string
  icon: LucideIcon
  colorTheme: 'blue' | 'emerald' | 'amber' | 'purple' | 'indigo' | 'violet'
  compact?: boolean
}

const themeStyles = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/20 text-blue-400',
    glow: 'group-hover:bg-blue-500/5',
    pill: 'text-blue-300 bg-blue-500/10',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
    glow: 'group-hover:bg-emerald-500/5',
    pill: 'text-emerald-300 bg-emerald-500/10',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconBg: 'bg-amber-500/20 text-amber-400',
    glow: 'group-hover:bg-amber-500/5',
    pill: 'text-amber-300 bg-amber-500/10',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    iconBg: 'bg-purple-500/20 text-purple-400',
    glow: 'group-hover:bg-purple-500/5',
    pill: 'text-purple-300 bg-purple-500/10',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    iconBg: 'bg-indigo-500/20 text-indigo-400',
    glow: 'group-hover:bg-indigo-500/5',
    pill: 'text-indigo-300 bg-indigo-500/10',
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    iconBg: 'bg-violet-500/20 text-violet-400',
    glow: 'group-hover:bg-violet-500/5',
    pill: 'text-violet-300 bg-violet-500/10',
  },
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  count,
  description,
  icon: Icon,
  colorTheme,
  compact = false,
}) => {
  const styles = themeStyles[colorTheme]

  if (compact) {
    return (
      <div
        className={`group relative bg-[#110B2E]/90 border ${styles.border} rounded-xl p-3 shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden flex items-center justify-between gap-2.5`}
      >
        <div className="min-w-0 flex-1">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
            {title}
          </span>
          <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight font-mono mt-0.5">
            {count.toLocaleString()}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${styles.iconBg} shrink-0 transition-transform group-hover:scale-105`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative bg-[#110B2E] border ${styles.border} rounded-2xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}
    >
      {/* Ambient background hover glow */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl transition-all duration-300 pointer-events-none ${styles.glow}`}
      />

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${styles.iconBg} transition-transform group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
          {count.toLocaleString()}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">
        {description}
      </p>
    </div>
  )
}
export default SummaryCard
