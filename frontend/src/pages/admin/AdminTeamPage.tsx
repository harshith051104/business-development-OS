import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import { organizationsService } from '../../services/organizations'
import { opportunitiesService } from '../../services/opportunities'
import { partnershipsService } from '../../services/partnerships'
import type { AdminTeamMember } from '../../types/admin'
import type { Organization } from '../../types/organization'
import type { Opportunity } from '../../types/opportunity'
import type { Partnership } from '../../types/partnership'
import {
  UserCheck,
  Building2,
  Target,
  Handshake,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Users,
  ArrowRight,
  Shield,
  Briefcase,
  Layers,
  ArrowRightLeft,
  Calendar,
} from 'lucide-react'

export const AdminTeamPage: React.FC = () => {
  const [team, setTeam] = useState<AdminTeamMember[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Reassignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false)
  const [selectedTargetOwnerId, setSelectedTargetOwnerId] = useState<number | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [selectedOrgIds, setSelectedOrgIds] = useState<number[]>([])
  const [selectedOppIds, setSelectedOppIds] = useState<number[]>([])
  const [selectedPartIds, setSelectedPartIds] = useState<number[]>([])
  const [isAssigning, setIsAssigning] = useState<boolean>(false)

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminService.getTeam()
      setTeam(res.items)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load BD team.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const openReassignmentModal = async (initialOwnerId?: number) => {
    if (initialOwnerId) setSelectedTargetOwnerId(initialOwnerId)
    setIsAssignModalOpen(true)
    try {
      const [orgsRes, oppsRes, partsRes] = await Promise.all([
        organizationsService.getOrganizations({ page_size: 100 }),
        opportunitiesService.getOpportunities({ page_size: 100 }),
        partnershipsService.listPartnerships({ page_size: 100 }),
      ])
      setOrganizations(orgsRes.items)
      setOpportunities(oppsRes.items)
      setPartnerships(partsRes.items)
    } catch (err) {
      console.error('Failed to load portfolio entities for reassignment:', err)
    }
  }

  const handleBulkAssign = async () => {
    if (selectedOrgIds.length === 0 && selectedOppIds.length === 0 && selectedPartIds.length === 0) {
      alert('Please select at least one record to assign.')
      return
    }

    setIsAssigning(true)
    try {
      const res = await adminService.bulkAssign({
        organization_ids: selectedOrgIds,
        opportunity_ids: selectedOppIds,
        partnership_ids: selectedPartIds,
        owner_id: selectedTargetOwnerId,
      })
      alert(res.message)
      setIsAssignModalOpen(false)
      setSelectedOrgIds([])
      setSelectedOppIds([])
      setSelectedPartIds([])
      fetchTeam()
    } catch (err: any) {
      alert(err.detail || 'Failed to reassign ownership.')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Business Development Team Overview
            </h1>
            <p className="text-xs text-slate-400">
              Representative workload distribution, account allocation, and portfolio reassignments
            </p>
          </div>
        </div>

        <button
          onClick={() => openReassignmentModal()}
          className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Reassign Ownership</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-rose-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading BD team members...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        ) : team.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Business Development users found.</h3>
            <p className="text-xs text-slate-400">Create a user with BUSINESS_DEVELOPMENT role to begin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member) => (
              <div
                key={member.id}
                className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center text-white font-bold shadow-md shadow-amber-600/30">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          to={`/admin/users/${member.id}`}
                          className="font-bold text-white text-sm hover:text-amber-300 transition block truncate"
                        >
                          {member.name}
                        </Link>
                        <span className="text-[11px] text-slate-400 font-mono block truncate">
                          {member.email}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        member.role === 'ADMIN'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {member.role === 'ADMIN' ? (
                        <Shield className="w-2.5 h-2.5 text-rose-400" />
                      ) : (
                        <Briefcase className="w-2.5 h-2.5 text-amber-400" />
                      )}
                      <span>{member.role}</span>
                    </span>
                  </div>

                  {/* Portfolio Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Orgs</span>
                      <div className="text-base font-bold text-violet-400 font-mono">
                        {member.organizations_count}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Opps</span>
                      <div className="text-base font-bold text-indigo-400 font-mono">
                        {member.opportunities_count}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800/80 space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Partners</span>
                      <div className="text-base font-bold text-emerald-400 font-mono">
                        {member.partnerships_count}
                      </div>
                    </div>
                  </div>

                  {member.last_activity_date && (
                    <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 pt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Last active: {new Date(member.last_activity_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <Link
                    to={`/admin/users/${member.id}`}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition"
                  >
                    View Profile →
                  </Link>
                  <button
                    onClick={() => openReassignmentModal(member.id)}
                    className="px-3 py-1 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700 transition"
                  >
                    Assign Items
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bulk Reassignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Portfolio Ownership Reassignment</h3>
              <p className="text-xs text-slate-400">
                Select target records and assign them to an authorized BD representative
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Target Owner Dropdown */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Assign To Representative</label>
                <select
                  value={selectedTargetOwnerId || ''}
                  onChange={(e) => setSelectedTargetOwnerId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Unassigned (Clear Owner) --</option>
                  {team.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-select Organizations */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>Organizations ({selectedOrgIds.length} selected)</span>
                </label>
                <div className="max-h-32 overflow-y-auto rounded-xl bg-[#1A1040] border border-slate-800 p-2 space-y-1">
                  {organizations.map((org) => (
                    <label key={org.id} className="flex items-center space-x-2 p-1.5 rounded hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedOrgIds.includes(org.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedOrgIds([...selectedOrgIds, org.id])
                          else setSelectedOrgIds(selectedOrgIds.filter((id) => id !== org.id))
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-0"
                      />
                      <span className="text-slate-200 truncate">{org.name} ({org.organization_type})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Multi-select Opportunities */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>Opportunities ({selectedOppIds.length} selected)</span>
                </label>
                <div className="max-h-32 overflow-y-auto rounded-xl bg-[#1A1040] border border-slate-800 p-2 space-y-1">
                  {opportunities.map((opp) => (
                    <label key={opp.id} className="flex items-center space-x-2 p-1.5 rounded hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedOppIds.includes(opp.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedOppIds([...selectedOppIds, opp.id])
                          else setSelectedOppIds(selectedOppIds.filter((id) => id !== opp.id))
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-0"
                      />
                      <span className="text-slate-200 truncate">{opp.name} ({opp.stage})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Multi-select Partnerships */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>Partnerships ({selectedPartIds.length} selected)</span>
                </label>
                <div className="max-h-32 overflow-y-auto rounded-xl bg-[#1A1040] border border-slate-800 p-2 space-y-1">
                  {partnerships.map((part) => (
                    <label key={part.id} className="flex items-center space-x-2 p-1.5 rounded hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPartIds.includes(part.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPartIds([...selectedPartIds, part.id])
                          else setSelectedPartIds(selectedPartIds.filter((id) => id !== part.id))
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-0"
                      />
                      <span className="text-slate-200 truncate">{part.name} ({part.status})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={isAssigning}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold transition flex items-center space-x-2 shadow-lg shadow-rose-600/30 text-xs disabled:opacity-50"
              >
                {isAssigning ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Confirm Assignment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminTeamPage
