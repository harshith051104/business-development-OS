import React, { useState, useEffect, useCallback } from 'react'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import type { SystemSettings } from '../../types/admin'
import {
  Sliders,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  ShieldCheck,
  Building2,
  Handshake,
  Calendar,
  Sparkles,
} from 'lucide-react'

export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [orgTypes, setOrgTypes] = useState<string[]>([])
  const [partnershipTypes, setPartnershipTypes] = useState<string[]>([])
  const [meetingTypes, setMeetingTypes] = useState<string[]>([])
  const [projectCategories, setProjectCategories] = useState<string[]>([])

  // Inputs for adding new entries
  const [newOrgType, setNewOrgType] = useState<string>('')
  const [newPartType, setNewPartType] = useState<string>('')
  const [newMeetingType, setNewMeetingType] = useState<string>('')
  const [newProjectCategory, setNewProjectCategory] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.getSettings()
      setSettings(data)
      setOrgTypes(data.organization_types || [])
      setPartnershipTypes(data.partnership_types || [])
      setMeetingTypes(data.meeting_types || [])
      setProjectCategories(data.project_categories || [])
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load system settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const updated = await adminService.updateSettings({
        organization_types: orgTypes,
        partnership_types: partnershipTypes,
        meeting_types: meetingTypes,
        project_categories: projectCategories,
      })
      setSettings(updated)
      setSuccessMessage('System configuration saved successfully.')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to save system settings.')
    } finally {
      setSaving(false)
    }
  }

  const addTag = (val: string, list: string[], setList: (l: string[]) => void, clearInput: () => void) => {
    const trimmed = val.trim()
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed])
      clearInput()
    }
  }

  const removeTag = (tag: string, list: string[], setList: (l: string[]) => void) => {
    setList(list.filter((item) => item !== tag))
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Application Taxonomies & System Settings
            </h1>
            <p className="text-xs text-slate-400">
              Manage enterprise classification taxonomies and business development dropdown choices
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center space-x-2 py-2 px-5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 disabled:opacity-50"
        >
          {saving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          <span>Save Settings</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Security Notice Banner */}
        <div className="p-4 rounded-3xl bg-[#110B2E] border border-slate-800 text-xs space-y-1 shadow-xl flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Safe Parameter Management: </span>
            <span className="text-slate-400">
              Only application-level options and classification choices are exposed here. Database credentials, encryption keys, and external API tokens are managed via secure environment variables and never rendered in the console.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading system settings...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Organization Types */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                <Building2 className="w-4 h-4 text-violet-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Organization Types
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 min-h-24">
                {orgTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                  >
                    <span>{type}</span>
                    <button
                      onClick={() => removeTag(type, orgTypes, setOrgTypes)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newOrgType}
                  onChange={(e) => setNewOrgType(e.target.value)}
                  placeholder="New organization type..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addTag(newOrgType, orgTypes, setOrgTypes, () => setNewOrgType(''))}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Partnership Types */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                <Handshake className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Partnership Types
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 min-h-24">
                {partnershipTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                  >
                    <span>{type}</span>
                    <button
                      onClick={() => removeTag(type, partnershipTypes, setPartnershipTypes)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newPartType}
                  onChange={(e) => setNewPartType(e.target.value)}
                  placeholder="New partnership type..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addTag(newPartType, partnershipTypes, setPartnershipTypes, () => setNewPartType(''))}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. Meeting Types */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Meeting Types
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 min-h-24">
                {meetingTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                  >
                    <span>{type}</span>
                    <button
                      onClick={() => removeTag(type, meetingTypes, setMeetingTypes)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newMeetingType}
                  onChange={(e) => setNewMeetingType(e.target.value)}
                  placeholder="New meeting format..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addTag(newMeetingType, meetingTypes, setMeetingTypes, () => setNewMeetingType(''))}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4. Project Categories */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Project Categories
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 min-h-24">
                {projectCategories.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs"
                  >
                    <span>{type}</span>
                    <button
                      onClick={() => removeTag(type, projectCategories, setProjectCategories)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newProjectCategory}
                  onChange={(e) => setNewProjectCategory(e.target.value)}
                  placeholder="New project category..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addTag(newProjectCategory, projectCategories, setProjectCategories, () => setNewProjectCategory(''))}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
export default AdminSettingsPage
