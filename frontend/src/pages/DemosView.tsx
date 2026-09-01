import React, { useEffect, useState } from 'react';
import { demoService } from '../services/demos';
import type { Demo, DemoCreate } from '../types/demo';
import Navbar from '../components/layout/Navbar';
import { 
  Tv, 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Clock, 
  UserCheck,
  FileText
} from 'lucide-react';

export const DemosView: React.FC = () => {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<DemoCreate>({
    organization_id: 1,
    title: '',
    scheduled_at: new Date().toISOString().slice(0, 16),
    participants: '',
    customer_requirements: '',
  });

  useEffect(() => {
    loadDemos();
  }, [statusFilter]);

  const loadDemos = async () => {
    try {
      setLoading(true);
      const data = await demoService.list(statusFilter !== 'All' ? { status: statusFilter } : undefined);
      setDemos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await demoService.create(form);
      setShowModal(false);
      loadDemos();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = demos.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    (d.organization_name && d.organization_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Tv className="w-7 h-7 text-teal-400" />
            Product Demonstrations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Schedule, manage, and record outcomes for live platform demonstrations and showcase walkthroughs.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Demo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search demonstrations or hospitals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['All', 'Scheduled', 'Completed', 'Cancelled'].map(st => (
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
        <div className="text-center py-16 text-slate-400">Loading demonstrations...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No demonstrations found</h3>
          <p className="text-sm text-slate-500 mt-1">Schedule your next showcase demonstration to advance deals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(d => (
            <div
              key={d.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                    d.status === 'Completed'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : d.status === 'Scheduled'
                      ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {d.status}
                  </span>
                  {d.outcome && d.outcome !== 'Pending' && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {d.outcome}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mb-1">{d.title}</h3>
                <div className="flex items-center space-x-1.5 text-xs text-teal-400 font-medium mb-3">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{d.organization_name || 'Organization'}</span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 bg-slate-800/40 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Scheduled:</span>
                    <span className="font-medium text-slate-200">
                      {d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                  </div>
                  {d.participants && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Participants:</span>
                      <span className="font-medium truncate max-w-[160px]">{d.participants}</span>
                    </div>
                  )}
                  {d.customer_requirements && (
                    <div className="pt-2 border-t border-slate-700/60 text-slate-400 line-clamp-2">
                      <strong className="text-slate-300">Requirements:</strong> {d.customer_requirements}
                    </div>
                  )}
                </div>
              </div>

              {d.demo_notes && (
                <div className="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
                  <strong className="text-slate-300">Notes:</strong> {d.demo_notes}
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
            <h3 className="text-lg font-bold text-white">Schedule Product Demonstration</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. ELLY Clinical AI Platform Deep Dive"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Scheduled Date & Time</label>
                <input
                  required
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Key Participants</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh Sharma (CTO), Head of Radiology"
                  value={form.participants || ''}
                  onChange={e => setForm({ ...form, participants: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Customer Requirements / Focus Areas</label>
                <textarea
                  rows={3}
                  placeholder="Specific modules, security questions, or workflow integrations to highlight..."
                  value={form.customer_requirements || ''}
                  onChange={e => setForm({ ...form, customer_requirements: e.target.value })}
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
                  Confirm Schedule
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
