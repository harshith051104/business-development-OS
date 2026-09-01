import React from 'react'
import { Link } from 'react-router-dom'
import type { DiscoveredOrganization } from '../../types/discovery'
import OrganizationTypeBadge from '../organizations/OrganizationTypeBadge'
import {
  Building2,
  MapPin,
  Globe,
  Plus,
  Bookmark,
  Check,
  Ban,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Users,
  Info,
  Search,
  Loader2,
  CircleDot,
} from 'lucide-react'

interface DiscoveryCardProps {
  item: DiscoveredOrganization
  onSave?: (id: number) => void
  onSkip?: (id: number) => void
  onAdd?: (item: DiscoveredOrganization) => void
  onResearch?: (id: number) => void
}

const ResearchStatusIndicator: React.FC<{ status?: string }> = ({ status }) => {
  if (!status || status === 'not_researched') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] text-slate-500">
        <CircleDot className="w-3 h-3" />
        <span>Not researched</span>
      </span>
    )
  }
  if (status === 'researching') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Researching</span>
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400">
        <Check className="w-3 h-3" />
        <span>Researched</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center space-x-1 text-[10px] text-rose-400">
      <Ban className="w-3 h-3" />
      <span>Research failed</span>
    </span>
  )
}

const CRMBadge: React.FC<{
  status?: string
  existingId?: number | null
  existingName?: string | null
  evidence?: string[]
}> = ({
  status,
  existingId,
  existingName,
  evidence,
}) => {
  if (!status || status === 'NEW_LEAD') return null
  if (status === 'ALREADY_IN_CRM') {
    return (
      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">Already in CRM{existingName ? `: ${existingName}` : ''}</span>
          </div>
          {existingId && (
            <Link
              to={`/business-development/organizations/${existingId}`}
              className="text-violet-400 hover:text-white underline text-[10px] shrink-0 ml-2 font-medium"
            >
              Open
            </Link>
          )}
        </div>
        {evidence && evidence.length > 0 && (
          <div className="text-[10px] text-amber-400/70 pl-5">
            {evidence.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
      </div>
    )
  }
  if (status === 'POSSIBLE_DUPLICATE') {
    return (
      <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[11px] text-orange-300 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-orange-400" />
            <span className="truncate">Possible duplicate{existingName ? `: ${existingName}` : ''}</span>
          </div>
          {existingId && (
            <Link
              to={`/business-development/organizations/${existingId}`}
              className="text-violet-400 hover:text-white underline text-[10px] shrink-0 ml-2 font-medium"
            >
              Open
            </Link>
          )}
        </div>
        {evidence && evidence.length > 0 && (
          <div className="text-[10px] text-orange-400/70 pl-5">
            {evidence.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
      </div>
    )
  }
  return null
}

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  item,
  onSave,
  onSkip,
  onAdd,
  onResearch,
}) => {
  const crmStatus = (item as any).crm_status
  const researchStatus = (item as any).research_status
  const dedupEvidence = (item as any).dedup_evidence as string[] | undefined

  return (
    <div className="bg-[#110B2E] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between space-y-4 relative group">
      <div className="space-y-3">
        {/* Top badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <OrganizationTypeBadge type={item.organization_type} size="sm" />
            {item.potential_fit && (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  item.potential_fit === 'High'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : item.potential_fit === 'Medium'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-500/10 text-slate-300 border border-slate-500/30'
                }`}
              >
                {item.potential_fit_score || 0}/100 {item.potential_fit}
              </span>
            )}
            <ResearchStatusIndicator status={researchStatus} />
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              item.status === 'added'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : item.status === 'saved'
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                : item.status === 'skipped'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {item.status}
          </span>
        </div>

        {/* CRM duplicate status with evidence */}
        <CRMBadge
          status={crmStatus}
          existingId={item.existing_org_id}
          existingName={item.existing_org_name}
          evidence={dedupEvidence}
        />

        {/* Title and location */}
        <div>
          <Link
            to={`/business-development/discover/${item.id}`}
            className="text-sm font-bold text-white hover:text-violet-300 transition line-clamp-1"
          >
            {item.name}
          </Link>
          {(item.city || item.state || item.country) && (
            <div className="flex items-center space-x-1 text-xs text-slate-400 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">
                {[item.city, item.state, item.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Qualification Reasoning */}
        {item.qualification_reason && (
          <div className="p-2.5 rounded-xl bg-[#1A1040] border border-violet-500/20 text-xs space-y-1">
            <div className="flex items-center space-x-1 text-violet-400 font-bold text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span>Why this matches</span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
              {item.qualification_reason}
            </p>
          </div>
        )}

        {!item.qualification_reason && item.description && (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Source and Website */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span className="truncate">Source: {item.source_name}</span>
          {item.website && (
            <a
              href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 truncate text-[11px] flex items-center space-x-1"
            >
              <Globe className="w-3 h-3 shrink-0" />
              <span>{item.website.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]}</span>
            </a>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <Link
            to={`/business-development/discover/${item.id}`}
            className="py-1.5 px-3 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center space-x-1.5 transition border border-slate-800"
          >
            <Users className="w-3 h-3 text-teal-400" />
            <span>View</span>
          </Link>

          {onResearch && researchStatus !== 'completed' && (
            <button
              onClick={() => onResearch(item.id)}
              className="py-1.5 px-3 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center space-x-1.5 transition border border-slate-800"
            >
              <Search className="w-3 h-3 text-amber-400" />
              <span>Research</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {item.status !== 'saved' && item.status !== 'added' && onSave && (
            <button
              onClick={() => onSave(item.id)}
              title="Save for later"
              className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-violet-300 transition border border-slate-800"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}

          {item.status !== 'skipped' && item.status !== 'added' && onSkip && (
            <button
              onClick={() => onSkip(item.id)}
              title="Skip"
              className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition border border-slate-800"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}

          {item.status !== 'added' && onAdd && (
            <button
              onClick={() => onAdd(item)}
              className="py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1 shadow-md shadow-violet-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to ELLY</span>
            </button>
          )}

          {item.status === 'added' && (
            <span className="inline-flex items-center space-x-1 py-1 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span>In CRM</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
export default DiscoveryCard
