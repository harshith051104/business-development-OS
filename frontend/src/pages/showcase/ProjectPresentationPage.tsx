import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { showcaseService } from '../../services/showcase'
import type { Project } from '../../types/project'
import {
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  RotateCw,
  Download,
  FileText,
  UploadCloud,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { getGoogleSlidesEmbedUrl, isGoogleSlidesUrl } from '../../components/showcase/PresentationDeckUpload'

export const ProjectPresentationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [exactPdfUrl, setExactPdfUrl] = useState<string | null>(null)
  const [deckFileName, setDeckFileName] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [gslidesInput, setGslidesInput] = useState<string>('')
  const [showGslidesModal, setShowGslidesModal] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchPresentation = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [proj, slidesInfo] = await Promise.all([
        showcaseService.getProject(id),
        showcaseService.getProjectSlides(id).catch(() => null),
      ])
      setProject(proj)

      const gslidesEmbed = getGoogleSlidesEmbedUrl(proj.presentation_url)
      if (gslidesEmbed) {
        setExactPdfUrl(gslidesEmbed)
        setDeckFileName('Google Slides Presentation')
        setFileType('GSLIDES')
      } else if (slidesInfo && slidesInfo.has_presentation) {
        setDeckFileName(slidesInfo.filename)
        setFileType(slidesInfo.file_type)
        // Prefer exact rendered PDF (works for both native PDF and converted PPTX/PPT)
        const resolvedPdf = slidesInfo.exact_pdf_url || (proj.presentation_url?.endsWith('.pdf') ? proj.presentation_url : null)
        setExactPdfUrl(resolvedPdf)
      } else if (proj.presentation_url) {
        const fname = proj.presentation_url.split('/').pop() || 'presentation.pdf'
        setDeckFileName(fname)
        setFileType(fname.split('.').pop() || 'pdf')
        if (proj.presentation_url.endsWith('.pdf')) {
          setExactPdfUrl(proj.presentation_url)
        }
      } else {
        setExactPdfUrl(null)
        setDeckFileName(null)
        setFileType(null)
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load presentation deck.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPresentation()
  }, [fetchPresentation])

  const handleDeckUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !project) return
    setIsUploading(true)
    try {
      await showcaseService.uploadPresentation(project.id, file)
      setToastMessage({ type: 'success', text: `Uploaded "${file.name}" deck successfully!` })
      await fetchPresentation()
      setTimeout(() => setToastMessage(null), 5000)
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.detail || err?.message || 'Failed to upload presentation deck.' })
      setTimeout(() => setToastMessage(null), 6000)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err))
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch((err) => console.error(err))
      setIsFullscreen(false)
    }
  }

  // Keyboard shortcut to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        if (id) navigate(`/business-development/showcase/${id}`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [id, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05040D] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Loading exact presentation deck...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#05040D] flex items-center justify-center p-6 text-white">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-lg font-bold text-white">Unable to launch presentation</h2>
          <p className="text-xs text-slate-400">{error || 'Project data unavailable.'}</p>
          <button
            onClick={() => navigate('/business-development/showcase')}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
          >
            Back to Showcase
          </button>
        </div>
      </div>
    )
  }

  // Resolved URL for exact viewer iframe
  const viewerUrl = exactPdfUrl || (project.presentation_url?.endsWith('.pdf') ? project.presentation_url : null)

  // Download URL for original uploaded file
  const originalDownloadUrl = project.presentation_url || viewerUrl

  return (
    <div className="h-screen w-screen bg-[#05040D] text-[#F0ECFF] flex flex-col justify-between select-none overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="px-5 py-3 flex items-center justify-between z-50 border-b border-slate-900/80 bg-[#080518]/95 backdrop-blur-md shrink-0">
        {/* Left: Exit & Project Info */}
        <div className="flex items-center space-x-3">
          <Link
            to={`/business-development/showcase/${project.id}`}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#110B2E] hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
            title="Exit Presentation"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </Link>

          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-xs font-bold text-white tracking-wide">{project.name}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[11px] text-slate-400 font-medium">{project.category}</span>
          </div>
        </div>

        {/* Center: File Badge */}
        {deckFileName && (
          <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-xl bg-[#110B2E] border border-slate-800 text-slate-300 text-xs font-mono">
            <FileText className="w-3.5 h-3.5 text-violet-400" />
            <span className="truncate max-w-xs">{deckFileName}</span>
            {fileType && (
              <span className="px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 text-[10px] font-bold uppercase">
                {fileType}
              </span>
            )}
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {originalDownloadUrl && (
            <a
              href={originalDownloadUrl}
              download
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#110B2E] hover:bg-violet-900/40 border border-violet-500/40 text-violet-200 text-xs font-semibold transition"
              title="Download original uploaded file"
            >
              <Download className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">Download Original</span>
            </a>
          )}

          {viewerUrl && (
            <a
              href={viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-[#110B2E] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-[#110B2E] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Main Viewport: EXACT Presentation Deck Display ── */}
      <main className="flex-1 w-full h-full bg-[#05040D] flex items-center justify-center p-0 relative overflow-hidden">
        {viewerUrl ? (
          /* EXACT Presentation Deck (Rendered 1:1 without separate template) */
          <div className="w-full h-full">
            {fileType === 'GSLIDES' ? (
              <iframe
                src={viewerUrl}
                title={`${project.name} Google Slides`}
                className="w-full h-full border-0 bg-black"
                allowFullScreen
              />
            ) : (
              <object
                data={`${viewerUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="w-full h-full border-0 bg-[#0B0520]"
              >
                <iframe
                  src={`${viewerUrl}#toolbar=1&navpanes=0`}
                  title={`${project.name} Presentation Deck`}
                  className="w-full h-full border-0 bg-[#0B0520]"
                />
              </object>
            )}
          </div>
        ) : (
          /* Empty State when no presentation is uploaded */
          <div className="text-center max-w-lg mx-auto p-10 rounded-3xl bg-[#110B2E] border border-violet-500/30 shadow-2xl space-y-5 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">No Presentation Deck Uploaded Yet</h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Upload your exact <span className="text-violet-300 font-semibold">.pptx</span>,{' '}
                <span className="text-violet-300 font-semibold">.ppt</span>, or{' '}
                <span className="text-violet-300 font-semibold">.pdf</span> presentation deck, or attach a{' '}
                <span className="text-violet-300 font-semibold">Google Slides</span> link to view it in full widescreen presentation mode.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-violet-600/30 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <UploadCloud className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>{isUploading ? 'Uploading & Rendering...' : 'Upload Presentation Deck'}</span>
              </button>

              <button
                onClick={() => setShowGslidesModal(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#1A1040] hover:bg-violet-900/40 border border-violet-500/40 text-violet-200 font-semibold text-xs transition flex items-center justify-center space-x-1.5"
              >
                <span>Attach Google Slides</span>
              </button>

              <Link
                to={`/business-development/showcase/${project.id}`}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition flex items-center justify-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Project</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Attach Google Slides Modal */}
      {showGslidesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#110B2E] border border-violet-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Attach Google Slides Presentation</h3>
              <button
                onClick={() => setShowGslidesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Paste the sharing or presentation link to your Google Slides deck (e.g. <code className="text-violet-300 font-mono">https://docs.google.com/presentation/d/...</code>).
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!project || !gslidesInput.trim()) return
              setIsUploading(true)
              try {
                await showcaseService.updateProject(project.id, { presentation_url: gslidesInput.trim() })
                setToastMessage({ type: 'success', text: 'Google Slides presentation attached successfully!' })
                setShowGslidesModal(false)
                setGslidesInput('')
                await fetchPresentation()
                setTimeout(() => setToastMessage(null), 5000)
              } catch (err: any) {
                setToastMessage({ type: 'error', text: err?.detail || err?.message || 'Failed to attach Google Slides.' })
                setTimeout(() => setToastMessage(null), 6000)
              } finally {
                setIsUploading(false)
              }
            }} className="space-y-4">
              <input
                type="url"
                required
                value={gslidesInput}
                onChange={(e) => setGslidesInput(e.target.value)}
                placeholder="https://docs.google.com/presentation/d/..."
                className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700/80 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
              />
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGslidesModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-600/30 disabled:opacity-50"
                >
                  {isUploading ? 'Attaching...' : 'Attach & View'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx"
        onChange={handleDeckUpload}
        className="hidden"
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl bg-[#110B2E] border ${
            toastMessage.type === 'success'
              ? 'border-emerald-500/40 text-emerald-300'
              : 'border-rose-500/40 text-rose-300'
          } shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}
    </div>
  )
}

export default ProjectPresentationPage
