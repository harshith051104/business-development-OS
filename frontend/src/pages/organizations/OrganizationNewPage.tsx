import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { organizationsService } from '../../services/organizations'
import type {
  OrganizationCreateInput,
  OrganizationType,
  ConnectionStatus,
  PriorityLevel,
  DuplicateCheckResult,
} from '../../types/organization'
import {
  Building2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Save,
} from 'lucide-react'

const orgTypes: OrganizationType[] = [
  'Company',
  'Company Group',
  'Startup',
  'SaaS Company',
  'Technology Company',
  'Enterprise',
  'Consulting Firm',
  'Financial Services',
  'Insurance Company',
  'Manufacturing',
  'Retail',
  'Education',
  'NGO',
  'Other',
]

const statusStages: ConnectionStatus[] = [
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

const priorityLevels: PriorityLevel[] = ['High', 'Medium', 'Low']

export const OrganizationNewPage: React.FC = () => {
  const navigate = useNavigate()

  const [formData, setFormData] = useState<OrganizationCreateInput>({
    name: '',
    organization_type: 'Company',
    website: '',
    email: '',
    phone: '',
    country: 'India',
    state: '',
    city: '',
    address: '',
    industry: 'Healthcare',
    size: '200-1000',
    status: 'Potential',
    priority: 'Medium',
    description: '',
    notes: '',
    allow_duplicate: false,
  })

  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Live duplicate check on name input change (debounced)
  useEffect(() => {
    const trimmed = formData.name.trim()
    if (!trimmed || trimmed.length < 3) {
      setDuplicateWarning(null)
      return
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true)
      try {
        const res = await organizationsService.checkDuplicate(trimmed)
        if (res.is_duplicate) {
          setDuplicateWarning(res)
        } else {
          setDuplicateWarning(null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setCheckingDuplicate(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [formData.name])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Organization Name is required.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const created = await organizationsService.createOrganization(formData)
      navigate(`/business-development/organizations/${created.id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.detail || err.message || 'Failed to create organization.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* ── Top Back Link & Title ── */}
        <div>
          <Link
            to="/business-development/organizations"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Organizations</span>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Add New Organization
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Register a new organization into your Business Development directory
              </p>
            </div>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Form Card ── */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8"
        >
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
              <span>1. Basic Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Organization Name */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Organization Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Apollo Companys Jubilee Hills"
                    className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  {checkingDuplicate && (
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Duplicate Warning */}
                {duplicateWarning && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{duplicateWarning.message}</span>
                    </div>
                    <label className="flex items-center space-x-2 text-[11px] text-amber-200 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={formData.allow_duplicate}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, allow_duplicate: e.target.checked }))
                        }
                        className="rounded border-amber-500 text-violet-600 focus:ring-0"
                      />
                      <span>Create anyway (Allow duplicate)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Organization Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Organization Type <span className="text-rose-400">*</span>
                </label>
                <select
                  name="organization_type"
                  value={formData.organization_type}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  {orgTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Industry</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry || ''}
                  onChange={handleChange}
                  placeholder="e.g. Company Network / Tertiary Healthcare"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website || ''}
                  onChange={handleChange}
                  placeholder="https://www.example.com"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Organization Size */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Organization Size</label>
                <select
                  name="size"
                  value={formData.size || '200-1000'}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value="1-50">1-50 employees / beds</option>
                  <option value="50-200">50-200 employees / beds</option>
                  <option value="200-1000">200-1000 employees / beds</option>
                  <option value="1000+">1000+ employees / beds</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Location */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
              2. Contact & Location
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  placeholder="partnerships@hospital.org"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  placeholder="+91 40 1234 5678"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  placeholder="e.g. Hyderabad"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleChange}
                  placeholder="e.g. Telangana"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleChange}
                  placeholder="Street address or campus details"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: BD Classification & Pipeline */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
              3. Business Development Classification
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Connection Pipeline Stage
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  {statusStages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  BD Priority Level
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  {priorityLevels.map((p) => (
                    <option key={p} value={p}>
                      {p} Priority
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description / Overview
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description || ''}
                  onChange={handleChange}
                  placeholder="Key background information about this organization..."
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Internal BD Notes
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={handleChange}
                  placeholder="Confidential team notes, meeting plans, or key decision maker insights..."
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Internal only. These notes are strictly private to the Business Development team.
                </p>
              </div>
            </div>
          </div>

          {/* Form Submit & Cancel Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <Link
              to="/business-development/organizations"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition shadow-lg shadow-violet-600/30 flex items-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Create Organization</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default OrganizationNewPage
