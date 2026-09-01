import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { contactsService } from '../../services/contacts'
import { organizationsService } from '../../services/organizations'
import type { ContactUpdateInput, ContactRelationshipStatus } from '../../types/contact'
import type { Organization } from '../../types/organization'
import {
  User,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Save,
  RotateCw,
} from 'lucide-react'

const contactStatuses: ContactRelationshipStatus[] = [
  'Not Contacted',
  'Contacted',
  'Connected',
  'Interested',
  'Inactive',
]

export const ContactEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [formData, setFormData] = useState<ContactUpdateInput>({
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
  })

  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const loadData = async () => {
      setInitialLoading(true)
      try {
        const [contact, orgs] = await Promise.all([
          contactsService.getContact(id),
          organizationsService.getOrganizations({ page_size: 100 }),
        ])
        setOrganizations(orgs.items)
        setFormData({
          organization_id: contact.organization_id,
          first_name: contact.first_name,
          last_name: contact.last_name || '',
          designation: contact.designation || '',
          department: contact.department || '',
          email: contact.email || '',
          phone: contact.phone || '',
          linkedin_url: contact.linkedin_url || '',
          location: contact.location || '',
          is_decision_maker: contact.is_decision_maker,
          is_primary_contact: contact.is_primary_contact,
          connection_status: contact.connection_status,
          notes: contact.notes || '',
        })
      } catch (err: any) {
        setError(err.detail || err.message || 'Unable to load contact.')
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
  }, [id])

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
    if (!id || !formData.first_name?.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await contactsService.updateContact(id, formData)
      navigate(`/business-development/contacts/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.detail || err.message || 'Failed to update contact.')
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
            to={id ? `/business-development/contacts/${id}` : '/business-development/contacts'}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Contact Profile</span>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Edit Contact</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Update professional details, contact information, and relationship classification
              </p>
            </div>
          </div>
        </div>

        {initialLoading ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-3">
            <RotateCw className="w-6 h-6 animate-spin text-teal-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading contact details...</p>
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
              {/* Personal & Organization Details */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400">
                  1. Organization & Personal Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Organization
                    </label>
                    <select
                      name="organization_id"
                      value={formData.organization_id}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, organization_id: Number(e.target.value) }))
                      }
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      First Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      required
                      value={formData.first_name || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Designation
                    </label>
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
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
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
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
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
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
                      value={formData.connection_status || 'Not Contacted'}
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

                  <div className="flex flex-col justify-center space-y-2 pt-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200">
                      <input
                        type="checkbox"
                        name="is_decision_maker"
                        checked={formData.is_decision_maker}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-slate-700 bg-[#1A1040] text-teal-600 focus:ring-0"
                      />
                      <span className="font-semibold">Key Decision Maker</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200">
                      <input
                        type="checkbox"
                        name="is_primary_contact"
                        checked={formData.is_primary_contact}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-slate-700 bg-[#1A1040] text-teal-600 focus:ring-0"
                      />
                      <span className="font-semibold">Primary Contact for Organization</span>
                    </label>
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Internal Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      value={formData.notes || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <Link
                  to={`/business-development/contacts/${id}`}
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
export default ContactEditPage
