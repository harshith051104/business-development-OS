import React, { useEffect, useState } from 'react';
import { proposalService } from '../services/proposals';
import type { Proposal, ProposalCreate } from '../types/proposal';
import Navbar from '../components/layout/Navbar';
import { 
  FileText, 
  Plus, 
  Search, 
  DollarSign, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  FileCheck2
} from 'lucide-react';

export const ProposalsView: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ProposalCreate>({
    organization_id: 1,
    title: '',
    version: 'v1.0',
    value: 500000,
    currency: 'INR',
    content_summary: '',
    commercial_terms: '30-day payment term upon milestone verification.',
  });

  useEffect(() => {
    loadProposals();
  }, [statusFilter]);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const data = await proposalService.list(statusFilter !== 'All' ? { status: statusFilter } : undefined);
      setProposals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await proposalService.create(form);
      setShowModal(false);
      loadProposals();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = proposals.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    (p.organization_name && p.organization_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-teal-400" />
            Commercial Proposals
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track enterprise quotes, scope documents, commercial versioning, and client acceptance milestones.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Proposal</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search proposals or organizations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['All', 'Draft', 'Sent', 'Under Discussion', 'Accepted', 'Rejected'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                statusFilter === st
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading proposals...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No commercial proposals found</h3>
          <p className="text-sm text-slate-500 mt-1">Generate a structured proposal to send commercial terms to clients.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(p => (
            <div
              key={p.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                    p.status === 'Accepted'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : p.status === 'Sent' || p.status === 'Under Discussion'
                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {p.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {p.version}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1">{p.title}</h3>
                <div className="flex items-center space-x-1.5 text-xs text-teal-400 font-medium mb-3">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{p.organization_name || 'Target Account'}</span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800/80 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Proposal Value:</span>
                    <span className="font-bold text-teal-300 text-sm">
                      ₹{p.value?.toLocaleString('en-IN') || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Created:</span>
                    <span className="text-slate-300">{new Date(p.date_created).toLocaleDateString()}</span>
                  </div>
                  {p.valid_until && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Valid Until:</span>
                      <span className="text-slate-300">{new Date(p.valid_until).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {p.content_summary && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {p.content_summary}
                  </p>
                )}
              </div>

              {p.commercial_terms && (
                <div className="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
                  <strong className="text-slate-300">Terms:</strong> {p.commercial_terms}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Generate Commercial Proposal</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Proposal Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Enterprise License Agreement v1.0"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Estimated Value (₹)</label>
                  <input
                    required
                    type="number"
                    value={form.value}
                    onChange={e => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Version</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={e => setForm({ ...form, version: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Scope & Executive Summary</label>
                <textarea
                  rows={3}
                  placeholder="Summary of platform modules, hospital department rollout, and support SLA..."
                  value={form.content_summary || ''}
                  onChange={e => setForm({ ...form, content_summary: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Commercial Terms & Milestones</label>
                <input
                  type="text"
                  placeholder="e.g. 50% upfront, 50% upon deployment"
                  value={form.commercial_terms || ''}
                  onChange={e => setForm({ ...form, commercial_terms: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-sm font-semibold transition"
                >
                  Create Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};
