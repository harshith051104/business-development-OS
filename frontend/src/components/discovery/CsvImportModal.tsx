import React, { useState, useRef } from 'react'
import { discoveryService } from '../../services/discovery'
import type { CsvImportPreview, CsvImportResult } from '../../types/discovery'
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCw,
  Plus,
} from 'lucide-react'

interface CsvImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CsvImportPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false)
  const [importing, setImporting] = useState<boolean>(false)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      setFile(selected)
      setError(null)
      setResult(null)
      setLoadingPreview(true)
      try {
        const previewData = await discoveryService.previewCsv(selected)
        setPreview(previewData)
      } catch (err: any) {
        setError(err.message || 'Failed to process CSV preview.')
      } finally {
        setLoadingPreview(false)
      }
    }
  }

  const handleExecuteImport = async () => {
    if (!preview) return
    setImporting(true)
    setError(null)
    try {
      const res = await discoveryService.executeCsvImport({
        rows: preview.rows,
        skip_duplicates: skipDuplicates,
      })
      setResult(res)
      onSuccess()
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to execute import.')
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#110B2E] border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Organizations from CSV</h2>
              <p className="text-xs text-slate-400">
                Bulk upload organizations, companies, and partner prospects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!preview && !result && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-violet-500/60 rounded-2xl p-8 text-center cursor-pointer bg-[#1A1040]/50 hover:bg-[#1A1040] transition space-y-3"
              >
                <Upload className="w-8 h-8 text-violet-400 mx-auto" />
                <div>
                  <span className="text-xs font-bold text-white">Click to upload CSV</span>
                  <span className="text-xs text-slate-400"> or drag and drop</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Headers accepted: name, organization_type, website, email, phone, city, state, country, description
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {loadingPreview && (
                <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <RotateCw className="w-4 h-4 animate-spin text-violet-400" />
                  <span>Validating CSV rows...</span>
                </div>
              )}
            </div>
          )}

          {preview && !result && (
            <div className="space-y-5">
              {/* Preview Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400">Rows Detected</span>
                  <div className="text-lg font-bold font-mono text-white mt-0.5">
                    {preview.total_rows}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center">
                  <span className="text-[11px] text-emerald-400">Valid</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    {preview.valid_rows}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-center">
                  <span className="text-[11px] text-amber-400">Duplicates</span>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                    {preview.duplicate_rows}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-center">
                  <span className="text-[11px] text-rose-400">Invalid</span>
                  <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
                    {preview.invalid_rows}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded border-slate-700 bg-[#1A1040] text-violet-600 focus:ring-0"
                  />
                  <span>Skip potential duplicate organizations</span>
                </label>

                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Choose another file
                </button>
              </div>

              {/* Rows Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1A1040] sticky top-0 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2.5 font-semibold">Row</th>
                      <th className="p-2.5 font-semibold">Name</th>
                      <th className="p-2.5 font-semibold">Type</th>
                      <th className="p-2.5 font-semibold">Location</th>
                      <th className="p-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {preview.rows.map((row) => (
                      <tr key={row.row_number} className="hover:bg-[#1A1040]/40">
                        <td className="p-2.5 text-slate-500 font-sans">{row.row_number}</td>
                        <td className="p-2.5 font-bold text-white font-sans truncate max-w-[200px]">
                          {row.name || <span className="text-rose-400 italic">Missing Name</span>}
                        </td>
                        <td className="p-2.5 text-slate-300 font-sans">{row.organization_type}</td>
                        <td className="p-2.5 text-slate-400 font-sans truncate max-w-[150px]">
                          {row.city || row.state || row.country}
                        </td>
                        <td className="p-2.5 font-sans">
                          {!row.is_valid ? (
                            <span className="text-rose-400 text-[11px]">{row.errors?.join(', ') || row.error_message || 'Invalid row'}</span>
                          ) : row.is_duplicate ? (
                            <span className="text-amber-400 text-[11px]">Duplicate in Pipeline</span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Import Successfully Completed</h3>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800">
                  <span className="text-slate-400">Imported:</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
                    {result.imported_count}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800">
                  <span className="text-slate-400">Skipped:</span>
                  <div className="text-base font-bold text-slate-300 mt-0.5 font-mono">
                    {result.skipped_count}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800">
                  <span className="text-slate-400">Duplicates:</span>
                  <div className="text-base font-bold text-amber-400 mt-0.5 font-mono">
                    {result.duplicate_count}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1A1040] border border-slate-800">
                  <span className="text-slate-400">Invalid:</span>
                  <div className="text-base font-bold text-rose-400 mt-0.5 font-mono">
                    {result.invalid_count}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
          >
            {result ? 'Close' : 'Cancel'}
          </button>

          {preview && !result && (
            <button
              onClick={handleExecuteImport}
              disabled={importing || preview.valid_rows === 0}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {importing && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                Import {skipDuplicates ? preview.valid_rows : preview.valid_rows + preview.duplicate_rows} Organizations
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
export default CsvImportModal
