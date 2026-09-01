import React from 'react'

interface OrganizationTypeBadgeProps {
  type: string
  size?: 'sm' | 'md'
}

const TYPE_STYLES: Record<string, string> = {
  'Company': 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  'Company Group': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  'Startup': 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  'SaaS Company': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  'Technology Company': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  'Enterprise': 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  'Consulting Firm': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  'Financial Services': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  'Insurance Company': 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  'Manufacturing': 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  'Retail': 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  'Education': 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  'NGO': 'bg-lime-500/10 text-lime-300 border-lime-500/30',
}

export const OrganizationTypeBadge: React.FC<OrganizationTypeBadgeProps> = ({
  type,
  size = 'md',
}) => {
  const style = TYPE_STYLES[type] || 'bg-slate-800 text-slate-300 border-slate-700'
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wider rounded-md border ${style} ${sizeClasses}`}
    >
      {type}
    </span>
  )
}
export default OrganizationTypeBadge
