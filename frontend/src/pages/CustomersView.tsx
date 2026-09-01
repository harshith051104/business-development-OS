import React, { useEffect, useState } from 'react';
import { customerService } from '../services/customers';
import type { Customer, CustomerCreate } from '../types/customer';
import Navbar from '../components/layout/Navbar';
import { 
  Users, 
  Plus, 
  Search, 
  DollarSign, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  HeartPulse
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CustomerCreate>({
    organization_id: 1,
    contract_value: 1500000,
    currency: 'INR',
    status: 'Active',
    account_health: 'Excellent',
    start_date: new Date().toISOString().slice(0, 10),
    renewal_date: new Date(Date.now() + 86400000 * 365).toISOString().slice(0, 10),
  });

  useEffect(() => {
    loadCustomers();
  }, [statusFilter]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.list(statusFilter !== 'All' ? { status: statusFilter } : undefined);
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await customerService.create(form);
      setShowModal(false);
      loadCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = customers.filter(c => 
    (c.organization_name && c.organization_name.toLowerCase().includes(search.toLowerCase())) ||
    (c.primary_contact_name && c.primary_contact_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-teal-400" />
            Customer Lifecycle & Accounts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Oversee active enterprise customer contracts, account health, ARR milestones, and renewal cycles.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search active accounts, hospitals, or contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['All', 'Active', 'Renewal Pending', 'At Risk', 'Churned'].map(st => (
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
        <div className="text-center py-16 text-slate-400">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No active customers found</h3>
          <p className="text-sm text-slate-500 mt-1">Convert negotiated opportunities into active commercial customer accounts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(c => (
            <div
              key={c.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                    c.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : c.status === 'Renewal Pending'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}>
                    {c.status}
                  </span>

                  <div className="flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    <HeartPulse className={`w-3.5 h-3.5 ${
                      c.account_health === 'Excellent' ? 'text-emerald-400' :
                      c.account_health === 'Good' ? 'text-teal-400' :
                      'text-rose-400'
                    }`} />
                    <span>{c.account_health}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white mb-1">{c.organization_name || 'Organization'}</h3>
                {c.primary_contact_name && (
                  <p className="text-xs text-slate-400 mb-3">Primary Contact: {c.primary_contact_name}</p>
                )}

                <div className="space-y-2 text-xs text-slate-300 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800/80 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Contract ARR:</span>
                    <span className="font-bold text-teal-300 text-sm">
                      ₹{c.contract_value?.toLocaleString('en-IN') || 0}
                    </span>
                  </div>
                  {c.start_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Contract Start:</span>
                      <span className="text-slate-200">{new Date(c.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {c.renewal_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Renewal Due:</span>
                      <span className="text-slate-200 font-medium">{new Date(c.renewal_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {c.notes && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                  <strong className="text-slate-300">Account Notes:</strong> {c.notes}
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
            <h3 className="text-lg font-bold text-white">Create Customer Account</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Contract Value (₹)</label>
                <input
                  required
                  type="number"
                  value={form.contract_value}
                  onChange={e => setForm({ ...form, contract_value: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Renewal Pending">Renewal Pending</option>
                    <option value="At Risk">At Risk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Account Health</label>
                  <select
                    value={form.account_health}
                    onChange={e => setForm({ ...form, account_health: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Needs Attention">Needs Attention</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date || ''}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Renewal Date</label>
                  <input
                    type="date"
                    value={form.renewal_date || ''}
                    onChange={e => setForm({ ...form, renewal_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Customer Notes</label>
                <textarea
                  rows={3}
                  placeholder="Deployment architecture, key hospital stakeholders, SLA terms..."
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
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
                  Save Customer
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
