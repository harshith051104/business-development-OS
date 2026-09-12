import React, { useState, useRef } from 'react'
import { showcaseService } from '../../services/showcase'
import { UploadCloud, FileText, CheckCircle2, RotateCw, AlertCircle, X, ExternalLink } from 'lucide-react'

interface PresentationDeckUploadProps {
  value?: string
  onChange: (url: string) => void
  projectId?: number | string
}

export const PresentationDeckUpload: React.FC<PresentationDeckUploadProps> = ({
  value,
  onChange,
  projectId,
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedName, setUploadedName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleClear = () => {
    onChange('')
    setUploadedName(null)
    setUploadError(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-300 flex items-center space-x-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>Presentation Deck / Pitch File (.PDF, .PPT, .PPTX)</span>
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

      {value ? (
        <div className="p-3.5 rounded-xl bg-[#1A1040] border border-indigo-500/40 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {uploadedName || value.split('/').pop() || 'Presentation Deck'}
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
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
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
