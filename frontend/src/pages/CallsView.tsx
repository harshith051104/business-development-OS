import React, { useEffect, useState } from 'react';
import { callService } from '../services/calls';
import type { CallLog, CallLogRequest, CallOutcome } from '../types/call';
import Navbar from '../components/layout/Navbar';
import { 
  PhoneCall, 
  Plus, 
  Search, 
  Building2, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  PhoneForwarded,
  ArrowRight
} from 'lucide-react';

export const CallsView: React.FC = () => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CallLogRequest>({
    organization_id: 1,
    outcome: 'Interested',
    notes: '',
    duration_minutes: 10,
    next_action: 'Send follow-up email with platform collateral',
    schedule_followup: true,
  });

  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    try {
      setLoading(true);
      const data = await callService.list();
      setCalls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await callService.logCall(form);
      setShowModal(false);
      loadCalls();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = calls.filter(c => 
    (c.subject && c.subject.toLowerCase().includes(search.toLowerCase())) ||
    (c.organization_name && c.organization_name.toLowerCase().includes(search.toLowerCase())) ||
    (c.contact_name && c.contact_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <PhoneCall className="w-7 h-7 text-teal-400" />
            Outbound Calls & Conversations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Log telephone conversations, track call outcomes, record meeting requests, and trigger automatic follow-up tasks.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Log Phone Call</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logged calls or contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading call history...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <PhoneCall className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No call logs found</h3>
          <p className="text-sm text-slate-500 mt-1">Log phone conversations with prospects to build timeline history.</p>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl divide-y divide-slate-800 shadow-xl overflow-hidden">
          {filtered.map(c => (
            <div key={c.id} className="p-5 hover:bg-slate-800/40 transition space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                    <PhoneForwarded className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{c.subject}</h4>
                    <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                      <span className="text-teal-300 font-medium flex items-center space-x-1">
                        <Building2 className="w-3 h-3" />
                        <span>{c.organization_name || 'Organization'}</span>
                      </span>
                      {c.contact_name && (
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{c.contact_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400 block">{new Date(c.communication_date).toLocaleDateString()}</span>
                  <span className="text-slate-500">{new Date(c.communication_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {c.content && (
                <p className="text-xs text-slate-300 bg-slate-800/40 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  {c.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Log Telephone Call</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Call Outcome</label>
                  <select
                    value={form.outcome}
                    onChange={e => setForm({ ...form, outcome: e.target.value as CallOutcome })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="Interested">Interested</option>
                    <option value="Meeting Requested">Meeting Requested</option>
                    <option value="Demo Requested">Demo Requested</option>
                    <option value="Callback">Callback</option>
                    <option value="Connected">Connected</option>
                    <option value="No Answer">No Answer</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Call Notes & Key Takeaways</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Key topics discussed, feedback on ELLY platform, stakeholder questions..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Next Action</label>
                <input
                  type="text"
                  placeholder="e.g. Email technical architecture document"
                  value={form.next_action || ''}
                  onChange={e => setForm({ ...form, next_action: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sched_fu"
                  checked={form.schedule_followup}
                  onChange={e => setForm({ ...form, schedule_followup: e.target.checked })}
                  className="rounded border-slate-700 text-teal-500 focus:ring-0"
                />
                <label htmlFor="sched_fu" className="text-xs text-slate-300">
                  Automatically create follow-up reminder task
                </label>
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
                  Save Call Log
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
