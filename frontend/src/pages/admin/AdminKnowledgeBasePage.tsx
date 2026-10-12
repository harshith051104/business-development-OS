import React, { useCallback, useEffect, useRef, useState } from 'react'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { knowledgeBaseService } from '../../services/knowledgeBase'
import type { KBDocument, KBSearchResult } from '../../types/knowledgeBase'
import {
  BookOpen,
  Upload,
  Search,
  Trash2,
  RotateCw,
  AlertCircle,
  FileText,
} from 'lucide-react'

export const AdminKnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<KBDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KBSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const docs = await knowledgeBaseService.list()
      setDocuments(docs)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load documents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !file) return
    setUploading(true)
    setError(null)
    try {
      await knowledgeBaseService.upload(title.trim(), file)
      setTitle('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchDocuments()
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to upload document.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this knowledge base document? This cannot be undone.')) return
    try {
      await knowledgeBaseService.delete(id)
      fetchDocuments()
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to delete document.')
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await knowledgeBaseService.search(query.trim())
      setResults(res)
    } catch (err: any) {
      alert(err.detail || err.message || 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <AdminNavbar />

      <header className="px-6 py-4 border-b border-rose-500/20 bg-[#110B2E] relative z-10 flex items-center space-x-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Knowledge Base</h1>
          <p className="text-xs text-slate-400">
            Upload internal playbooks, pricing sheets, and policy docs so Copilot can ground answers in them
          </p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload form */}
        <form
          onSubmit={handleUpload}
          className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3"
        >
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Upload Document</h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title (e.g. Q4 Pricing Sheet)"
              className="sm:col-span-6 px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="sm:col-span-4 px-3 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-xs"
            />
            <button
              type="submit"
              disabled={uploading || !title.trim() || !file}
              className="sm:col-span-2 inline-flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Plain text or Markdown only, up to 2MB.</p>
        </form>

        {/* Quick search (verify retrieval) */}
        <form
          onSubmit={handleSearch}
          className="bg-[#110B2E] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3"
        >
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Test Search</h3>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try a question Copilot might be asked..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold transition"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {results && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {results.length === 0 ? (
                <p className="text-xs text-slate-500">No matching passages found.</p>
              ) : (
                results.map((r, i) => (
                  <div key={i} className="bg-[#1A1040]/70 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-indigo-300">{r.document_title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">score {r.score}</span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.chunk_text}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </form>

        {/* Documents list */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No documents uploaded yet.</h3>
            <p className="text-xs text-slate-400">Upload playbooks or pricing docs above to ground Copilot's answers.</p>
          </div>
        ) : (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">Title</th>
                    <th className="p-3.5 font-semibold">Source</th>
                    <th className="p-3.5 font-semibold">Chunks</th>
                    <th className="p-3.5 font-semibold">Uploaded</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#1A1040]/40 transition">
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-bold text-white">{doc.title}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-400">{doc.source || '-'}</td>
                      <td className="p-3.5 text-slate-400 font-mono">{doc.chunk_count ?? '-'}</td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="inline-flex items-center space-x-1 py-1 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
export default AdminKnowledgeBasePage
