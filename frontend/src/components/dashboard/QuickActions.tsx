import React from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Building,
  UserPlus,
  Users,
  Sparkles,
  CalendarPlus,
  ArrowRight,
  Compass,
  MessageSquare,
} from 'lucide-react'

export const QuickActions: React.FC = () => {
  const actions = [
    {
      title: 'Find Organizations',
      description: 'Discover target companies & organizations',
      icon: Search,
      path: '/business-development/organizations',
      color: 'from-blue-600/20 to-blue-600/5 hover:border-blue-500/40 text-blue-400',
    },
    {
      title: 'Add Organization',
      description: 'Register a new target organization',
      icon: Building,
      path: '/business-development/organizations/new',
      color: 'from-cyan-600/20 to-cyan-600/5 hover:border-cyan-500/40 text-cyan-400',
    },
    {
      title: 'Add Contact',
      description: 'Add a new director or partner contact',
      icon: UserPlus,
      path: '/business-development/contacts/add',
      color: 'from-teal-600/20 to-teal-600/5 hover:border-teal-500/40 text-teal-400',
    },
    {
      title: 'View Connections',
      description: 'Review established outreach & active contacts',
      icon: Users,
      path: '/business-development/connections',
      color: 'from-emerald-600/20 to-emerald-600/5 hover:border-emerald-500/40 text-emerald-400',
    },
    {
      title: 'Showcase Our Projects',
      description: 'Present company products to stakeholders',
      icon: Sparkles,
      path: '/business-development/showcase',
      color: 'from-violet-600/20 to-violet-600/5 hover:border-violet-500/40 text-violet-400',
    },
    {
      title: 'Record Communication',
      description: 'Log outreach emails, phone calls, and direct discussions',
      icon: MessageSquare,
      path: '/business-development/communications/new',
      color: 'from-pink-600/20 to-pink-600/5 hover:border-pink-500/40 text-pink-400',
    },
  ]

  return (
    <div className="bg-[#110B2E] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Quick Actions</h2>
            <p className="text-xs text-slate-400">Core business development shortcuts and workflows</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">6 Actions</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {actions.map((act) => {
          const Icon = act.icon
          return (
            <Link
              key={act.title}
              to={act.path}
              className={`p-4 rounded-xl bg-gradient-to-br ${act.color} border border-slate-800 transition-all duration-300 hover:-translate-y-0.5 group flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-[#1A1040] border border-slate-800">
                    <Icon className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-violet-200 transition">
                  {act.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {act.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
export default QuickActions
