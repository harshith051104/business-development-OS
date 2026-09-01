import React, { useEffect, useState } from 'react';
import { taskService } from '../services/tasks';
import type { BDTask, BDTaskCreate } from '../types/task';
import Navbar from '../components/layout/Navbar';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Building2,
  Trash2
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<BDTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<BDTaskCreate>({
    title: '',
    description: '',
    priority: 'High',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
  });

  useEffect(() => {
    loadTasks();
  }, [statusFilter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.list(statusFilter !== 'All' ? { status: statusFilter } : undefined);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await taskService.create(form);
      setShowModal(false);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTaskStatus = async (task: BDTask) => {
    try {
      const nextStatus = task.status === 'Completed' ? 'Todo' : 'Completed';
      await taskService.update(task.id, { status: nextStatus });
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = tasks.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
    (t.entity_name && t.entity_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-teal-400" />
            Business Development Tasks
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track daily BD action items, client deliverables, follow-up preparation, and milestone execution.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New BD Task</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, accounts, or notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['All', 'Todo', 'In Progress', 'Completed'].map(st => (
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

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No tasks found</h3>
          <p className="text-sm text-slate-500 mt-1">Create actionable tasks to keep BD outreach on schedule.</p>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 shadow-xl overflow-hidden">
          {filtered.map(t => (
            <div
              key={t.id}
              className="p-4 hover:bg-slate-800/40 transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center space-x-3.5">
                <button
                  onClick={() => toggleTaskStatus(t)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                    t.status === 'Completed'
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : 'border-slate-600 hover:border-teal-400 text-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>

                <div>
                  <h4 className={`text-sm font-semibold ${t.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                    {t.title}
                  </h4>
                  {t.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                  )}
                  {t.entity_name && (
                    <div className="flex items-center space-x-1 text-[11px] text-teal-400 font-medium mt-1">
                      <Building2 className="w-3 h-3" />
                      <span>{t.entity_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  t.priority === 'High'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {t.priority}
                </span>

                {t.due_date && (
                  <span className="text-xs text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(t.due_date).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create BD Task</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Task Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Prepare customized ROI presentation"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date || ''}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Details, research points, or action steps..."
                  value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
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
                  Save Task
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
