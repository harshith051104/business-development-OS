import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { organizationsService } from '../../services/organizations'
import type {
  OrganizationUpdateInput,
  OrganizationType,
  ConnectionStatus,
  PriorityLevel,
} from '../../types/organization'
import {
  Building2,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Save,
  RotateCw,
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

export const OrganizationEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [formData, setFormData] = useState<OrganizationUpdateInput>({
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
  })

  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchOrg = async () => {
      setInitialLoading(true)
      try {
        const org = await organizationsService.getOrganization(id)
        setFormData({
          name: org.name,
          organization_type: org.organization_type,
          website: org.website || '',
          email: org.email || '',
          phone: org.phone || '',
          country: org.country || 'India',
          state: org.state || '',
          city: org.city || '',
          address: org.address || '',
          industry: org.industry || 'Healthcare',
          size: org.size || '200-1000',
          status: org.status,
          priority: org.priority,
          description: org.description || '',
          notes: org.notes || '',
        })
      } catch (err: any) {
        setError(err.detail || err.message || 'Unable to load organization.')
      } finally {
        setInitialLoading(false)
      }
    }
    fetchOrg()
  }, [id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !formData.name?.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await organizationsService.updateOrganization(id, formData)
      navigate(`/business-development/organizations/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.detail || err.message || 'Failed to update organization.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* ── Top Back Link ── */}
        <div>
          <Link
            to={id ? `/business-development/organizations/${id}` : '/business-development/organizations'}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Organization Profile</span>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Edit Organization
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Update details, contact information, and BD status
              </p>
            </div>
          </div>
        </div>

        {initialLoading ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-3">
            <RotateCw className="w-6 h-6 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading organization details...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8"
            >
              {/* Basic Information */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
                  1. Basic Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Organization Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Organization Type
                    </label>
                    <select
                      name="organization_type"
                      value={formData.organization_type || 'Company'}
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Industry</label>
                    <input
                      type="text"
                      name="industry"
                      value={formData.industry || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Website</label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Size</label>
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

              {/* Contact & Location */}
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
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* BD Classification */}
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
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Internal BD Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={4}
                      value={formData.notes || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <Link
                  to={`/business-development/organizations/${id}`}
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
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
export default OrganizationEditPage
