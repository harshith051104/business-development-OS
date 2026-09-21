import React, { useState, useRef } from 'react'
import { showcaseService } from '../../services/showcase'
import {
  UploadCloud,
  FileText,
  RotateCw,
  AlertCircle,
  X,
  ExternalLink,
  Link as LinkIcon,
  Check,
} from 'lucide-react'

interface PresentationDeckUploadProps {
  value?: string
  onChange: (url: string) => void
  projectId?: number | string
}

export function isGoogleSlidesUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.includes('docs.google.com/presentation') || url.includes('drive.google.com/file/d/')
}

export function getGoogleSlidesEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.includes('docs.google.com/presentation')) {
    const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
    if (match && match[1]) {
      return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`
    }
  }
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`
    }
  }
  return null
}

export const PresentationDeckUpload: React.FC<PresentationDeckUploadProps> = ({
  value,
  onChange,
  projectId,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'gslides'>('upload')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedName, setUploadedName] = useState<string | null>(null)
  const [gslidesLinkInput, setGslidesLinkInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isCurrentGslides = isGoogleSlidesUrl(value)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.pdf', '.ppt', '.pptx'].includes(ext)) {
      setUploadError('Only .pdf, .ppt, and .pptx presentation decks are accepted.')
      return
    }

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Presentation deck exceeds maximum allowed size of 50MB.')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      if (projectId) {
        const updated = await showcaseService.uploadPresentation(projectId, file)
        onChange(updated.presentation_url || '')
        setUploadedName(file.name)
      } else {
        const res = await showcaseService.uploadPresentationFile(file)
        onChange(res.presentation_url)
        setUploadedName(res.filename)
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload presentation deck.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleApplyGslidesLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = gslidesLinkInput.trim()
    if (!trimmed) return

    if (!isGoogleSlidesUrl(trimmed)) {
      setUploadError('Please enter a valid Google Slides or Google Drive presentation sharing link.')
      return
    }

    setUploadError(null)
    onChange(trimmed)
    setUploadedName('Google Slides Presentation')
    setGslidesLinkInput('')
  }

  const handleClear = () => {
    onChange('')
    setUploadedName(null)
    setUploadError(null)
  }

  return (
    <div className="space-y-3">
      {/* Label and Clear action */}
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-300 flex items-center space-x-1.5 text-xs">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>Presentation Deck / Pitch File</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center space-x-1"
          >
            <X className="w-3 h-3" />
            <span>Remove Deck</span>
          </button>
        )}
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Mode Switcher Tabs (Only if no deck attached yet) */}
      {!value && (
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'upload'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File (.PDF, .PPT, .PPTX)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gslides')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'gslides'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Google Slides Sharing Link</span>
          </button>
        </div>
      )}

      {/* Attached Presentation Display */}
      {value ? (
        <div className="p-3.5 rounded-xl bg-[#1A1040] border border-indigo-500/40 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
              {isCurrentGslides ? <LinkIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                <span>{uploadedName || (isCurrentGslides ? 'Google Slides Presentation' : value.split('/').pop())}</span>
                {isCurrentGslides && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Google Slides
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">{value}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <a
              href={value.startsWith('http') ? value : `http://127.0.0.1:8001${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold flex items-center space-x-1 transition"
            >
              <span>View</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Replace
            </button>
          </div>
        </div>
      ) : activeTab === 'upload' ? (
        /* File Upload Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
            isUploading
              ? 'border-indigo-500/60 bg-indigo-950/20'
              : 'border-slate-700 hover:border-indigo-500/50 hover:bg-[#1A1040]/40'
          }`}
        >
          {isUploading ? (
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <RotateCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs text-indigo-300 font-medium">
                Uploading presentation deck to Showcase...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1.5 py-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-200">
                Click to upload presentation deck
              </div>
              <p className="text-[11px] text-slate-400">
                Supports <strong className="text-indigo-300">.PDF</strong>,{' '}
                <strong className="text-indigo-300">.PPT</strong>, and{' '}
                <strong className="text-indigo-300">.PPTX</strong> up to 50MB
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Google Slides Link Input */
        <div className="rounded-2xl border border-slate-700 p-4 bg-[#110B2E] space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Paste any Google Slides sharing link (e.g.{' '}
            <code className="text-violet-300 font-mono text-[11px]">
              https://docs.google.com/presentation/d/.../edit?usp=sharing
            </code>
            ).
          </p>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={gslidesLinkInput}
              onChange={(e) => setGslidesLinkInput(e.target.value)}
              placeholder="https://docs.google.com/presentation/d/..."
              className="flex-1 px-3.5 py-2 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => handleApplyGslidesLink()}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Attach</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

export default PresentationDeckUpload
