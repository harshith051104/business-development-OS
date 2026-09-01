import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { contactsService } from '../../services/contacts'
import { organizationsService } from '../../services/organizations'
import type {
  ContactCreateInput,
  ContactRelationshipStatus,
  DuplicateContactCheckResult,
} from '../../types/contact'
import type { Organization } from '../../types/organization'
import {
  UserPlus,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Save,
  Building2,
  CheckCircle2,
  Star,
  Award,
} from 'lucide-react'

const contactStatuses: ContactRelationshipStatus[] = [
  'Not Contacted',
  'Contacted',
  'Connected',
  'Interested',
  'Inactive',
]

export const ContactNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedOrgId = searchParams.get('organization_id')

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState<boolean>(true)

  const [formData, setFormData] = useState<ContactCreateInput>({
    organization_id: preselectedOrgId ? Number(preselectedOrgId) : 0,
    first_name: '',
    last_name: '',
    designation: '',
    department: '',
    email: '',
    phone: '',
    linkedin_url: '',
    location: '',
    is_decision_maker: false,
    is_primary_contact: false,
    connection_status: 'Not Contacted',
    notes: '',
    allow_duplicate: false,
  })

  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateContactCheckResult | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch organizations for dropdown
  useEffect(() => {
    const fetchOrgs = async () => {
      setLoadingOrgs(true)
      try {
        const data = await organizationsService.getOrganizations({ page_size: 100 })
        setOrganizations(data.items)
        if (data.items.length > 0 && !preselectedOrgId) {
          setFormData((prev) => ({ ...prev, organization_id: data.items[0].id }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingOrgs(false)
      }
    }
    fetchOrgs()
  }, [preselectedOrgId])

  // Live duplicate check on email/phone/name change (debounced)
  useEffect(() => {
    if (!formData.email?.trim() && !formData.phone?.trim()) {
      setDuplicateWarning(null)
      return
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true)
      try {
        const res = await contactsService.checkDuplicate({
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          organization_id: formData.organization_id || undefined,
          first_name: formData.first_name?.trim() || undefined,
          last_name: formData.last_name?.trim() || undefined,
        })
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
  }, [formData.email, formData.phone, formData.first_name, formData.last_name, formData.organization_id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target as HTMLInputElement
    const { name, value, type, checked } = target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name.trim()) {
      setError('First Name is required.')
      return
    }
    if (!formData.organization_id) {
      setError('Please select an Organization.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const created = await contactsService.createContact(formData)
      navigate(`/business-development/contacts/${created.id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.detail || err.message || 'Failed to create contact.')
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
            to={
              preselectedOrgId
                ? `/business-development/organizations/${preselectedOrgId}`
                : '/business-development/contacts'
            }
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {preselectedOrgId ? 'Back to Organization Profile' : 'Back to Contacts'}
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Add Business Contact</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Register a new executive, director, or partner stakeholder
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
          {/* Section 1: Organization & Identity */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400">
              1. Organization & Personal Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Organization Selection */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Associated Organization <span className="text-rose-400">*</span>
                </label>
                <select
                  name="organization_id"
                  required
                  value={formData.organization_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, organization_id: Number(e.target.value) }))
                  }
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.organization_type}) - {org.city || 'India'}
                    </option>
                  ))}
                </select>
              </div>

              {/* First Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  First Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="e.g. Sangita"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                  placeholder="e.g. Reddy"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Designation / Title
                </label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation || ''}
                  onChange={handleChange}
                  placeholder="e.g. Company Director / Chief Technology Officer"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department || ''}
                  onChange={handleChange}
                  placeholder="e.g. Management / Technology / Operations"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400">
              2. Contact Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  placeholder="name@organization.com"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  name="linkedin_url"
                  value={formData.linkedin_url || ''}
                  onChange={handleChange}
                  placeholder="https://www.linkedin.com/in/username"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Location / City</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  placeholder="e.g. Hyderabad / Bangalore"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                      className="rounded border-amber-500 text-teal-600 focus:ring-0"
                    />
                    <span>Create anyway</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: BD Classification & Flags */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400">
              3. Relationship Classification
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Relationship Status
                </label>
                <select
                  name="connection_status"
                  value={formData.connection_status}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  {contactStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox Flags */}
              <div className="flex flex-col justify-center space-y-2.5 pt-2">
                <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    name="is_decision_maker"
                    checked={formData.is_decision_maker}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-700 bg-[#1A1040] text-teal-600 focus:ring-0"
                  />
                  <span className="font-semibold">Key Decision Maker</span>
                  <span className="text-[11px] text-slate-400">(Has sign-off or budget authority)</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    name="is_primary_contact"
                    checked={formData.is_primary_contact}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-700 bg-[#1A1040] text-teal-600 focus:ring-0"
                  />
                  <span className="font-semibold">Primary Contact</span>
                  <span className="text-[11px] text-slate-400">
                    (Main communication focal point for this organization)
                  </span>
                </label>
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
                  placeholder="Confidential stakeholder insights, preferred contact channels, or background details..."
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <Link
              to="/business-development/contacts"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition shadow-lg shadow-teal-600/30 flex items-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Contact</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default ContactNewPage
