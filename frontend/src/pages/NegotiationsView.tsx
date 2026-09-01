import React, { useEffect, useState } from 'react';
import { negotiationService } from '../services/negotiations';
import type { Negotiation, NegotiationCreate } from '../types/negotiation';
import Navbar from '../components/layout/Navbar';
import { 
  Scale, 
  Plus, 
  Search, 
  Building2, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const NegotiationsView: React.FC = () => {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NegotiationCreate>({
    organization_id: 1,
    title: '',
    commercial_value: 1000000,
    currency: 'INR',
    key_requirements: 'Multi-year commitment with technical support SLAs.',
    open_issues: 'Finalizing pricing tiers and payment terms.',
  });

  useEffect(() => {
    loadNegotiations();
  }, [statusFilter]);

  const loadNegotiations = async () => {
    try {
      setLoading(true);
      const data = await negotiationService.list(statusFilter !== 'All' ? { status: statusFilter } : undefined);
      setNegotiations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await negotiationService.create(form);
      setShowModal(false);
      loadNegotiations();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = negotiations.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    (n.organization_name && n.organization_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Scale className="w-7 h-7 text-teal-400" />
            Active Negotiations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage contract reviews, pricing discussions, open deal blockers, and final agreement terms.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Negotiation</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search negotiations or accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['All', 'Active', 'Terms Proposed', 'Legal Review', 'Agreed', 'Blocked'].map(st => (
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
        <div className="text-center py-16 text-slate-400">Loading negotiations...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Scale className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No active negotiations</h3>
          <p className="text-sm text-slate-500 mt-1">Initiate a commercial negotiation when a client accepts a proposal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(n => (
            <div
              key={n.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                    n.status === 'Agreed'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : n.status === 'Blocked'
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}>
                    {n.status}
                  </span>
                  <span className="text-xs font-bold text-teal-300 font-mono">
                    ₹{n.commercial_value?.toLocaleString('en-IN') || 0}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1">{n.title}</h3>
                <div className="flex items-center space-x-1.5 text-xs text-teal-400 font-medium mb-3">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{n.organization_name || 'Account'}</span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800/80 mb-3">
                  {n.expected_close_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Expected Close:</span>
                      <span className="text-slate-200 font-medium">
                        {new Date(n.expected_close_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {n.key_requirements && (
                    <div className="text-slate-300">
                      <strong className="text-slate-500 block mb-0.5">Key Terms:</strong>
                      <span className="line-clamp-2">{n.key_requirements}</span>
                    </div>
                  )}
                </div>

                {n.open_issues && (
                  <div className="flex items-start space-x-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-200">Open Points:</strong>
                      <span>{n.open_issues}</span>
                    </div>
                  </div>
                )}
              </div>

              {n.next_action && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Next Action:</span>
                  <span className="font-semibold text-teal-400">{n.next_action}</span>
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
            <h3 className="text-lg font-bold text-white">Create Commercial Negotiation</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Negotiation Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Terms & SLA Finalization with Apollo Health"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Commercial Value (₹)</label>
                <input
                  required
                  type="number"
                  value={form.commercial_value}
                  onChange={e => setForm({ ...form, commercial_value: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Key Contract Terms</label>
                <textarea
                  rows={2}
                  placeholder="Multi-year commitment, payment terms, infrastructure scope..."
                  value={form.key_requirements || ''}
                  onChange={e => setForm({ ...form, key_requirements: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Open Discussion Points</label>
                <input
                  type="text"
                  placeholder="e.g. Payment milestone schedule, legal indemnity cap"
                  value={form.open_issues || ''}
                  onChange={e => setForm({ ...form, open_issues: e.target.value })}
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
                  Initiate Negotiation
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
