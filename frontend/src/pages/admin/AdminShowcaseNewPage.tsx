import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { adminService } from '../../services/admin'
import {
  Sparkles,
  ArrowLeft,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Globe,
  Video,
  FileText,
  Layers,
  Tag,
} from 'lucide-react'

export const AdminShowcaseNewPage: React.FC = () => {
  const navigate = useNavigate()
  const [name, setName] = useState<string>('')
  const [shortDescription, setShortDescription] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [category, setCategory] = useState<string>('Healthcare')
  const [status, setStatus] = useState<string>('Draft')
  const [demoUrl, setDemoUrl] = useState<string>('')
  const [presentationUrl, setPresentationUrl] = useState<string>('')
  const [websiteUrl, setWebsiteUrl] = useState<string>('')
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [featuresText, setFeaturesText] = useState<string>('')
  const [tagsText, setTagsText] = useState<string>('')
  const [problemSolved, setProblemSolved] = useState<string>('')
  const [targetAudience, setTargetAudience] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !shortDescription.trim() || !description.trim()) {
      setError('Please provide project name, summary, and detailed description.')
      return
    }

    // Safety checks on URLs
    const urls = [demoUrl, presentationUrl, websiteUrl, videoUrl, thumbnailUrl]
    for (const u of urls) {
      if (u && (u.includes('api_key=') || u.includes('bearer') || u.includes('secret=') || u.includes('@'))) {
        setError('URLs must not contain embedded API keys, secret tokens, or user credentials.')
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const keyFeatures = featuresText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      await adminService.createShowcaseProject({
        name: name.trim(),
        short_description: shortDescription.trim(),
        description: description.trim(),
        category,
        status,
        demo_url: demoUrl.trim() || undefined,
        presentation_url: presentationUrl.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        video_url: videoUrl.trim() || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        key_features: keyFeatures,
        tags,
        business_value: {
          problem_solved: problemSolved.trim(),
          target_audience: targetAudience.trim(),
        },
      })

      navigate('/admin/showcase')
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to create showcase project.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link to="/admin/showcase" className="hover:text-white flex items-center gap-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Showcase Governance</span>
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium">New Project</span>
        </div>

        <div className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Create Showcase Initiative</h1>
            <p className="text-xs text-slate-400">
              Draft or publish approved company offerings for Business Development presentations
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#110B2E] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 text-xs">
          {/* Section 1: Overview */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              1. Project Specifications
            </h2>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Project Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Enterprise Intelligence Suite"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Industry Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Healthcare">Healthcare</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Automation">Automation</option>
                  <option value="Web Platform">Web Platform</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Governance Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Draft">Draft (Internal Only)</option>
                  <option value="Review">Review (Under Review)</option>
                  <option value="Published">Published (Active in Showcase)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Short Summary (1-2 sentences) *</label>
              <input
                type="text"
                required
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="High-level value statement for preview cards..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Detailed Description *</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Full executive breakdown, architecture, and market positioning..."
                className="w-full p-3.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Approved Links */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>2. Approved Presentation Materials & Demo Links</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Live Demo URL</label>
                <input
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://demo.company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Presentation Deck / Whitepaper</label>
                <input
                  type="url"
                  value={presentationUrl}
                  onChange={(e) => setPresentationUrl(e.target.value)}
                  placeholder="https://docs.company.com/pitch.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Thumbnail Image URL</label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://cdn.company.com/thumb.jpg"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Video Walkthrough URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://video.company.com/demo.mp4"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Features & Commercial Value */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
              <Tag className="w-4 h-4" />
              <span>3. Commercial Value & Feature Bullets</span>
            </h2>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Key Features (One feature per line)</label>
              <textarea
                rows={3}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder="Enterprise EHR Integration&#10;Real-time Clinical Operations Intelligence&#10;Automated Compliance Verification"
                className="w-full p-3.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Problem Solved</label>
                <input
                  type="text"
                  value={problemSolved}
                  onChange={(e) => setProblemSolved(e.target.value)}
                  placeholder="e.g. Reduces administrative scheduling overhead by 60%"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Target Audience / Persona</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Chief Medical Officers, Company Administrators"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Tags (Comma-separated)</label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="Company, Analytics, Enterprise, Operations"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1040] border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <Link
              to="/admin/showcase"
              className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 font-semibold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-bold transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Save Initiative</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
export default AdminShowcaseNewPage
