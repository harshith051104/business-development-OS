import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/tasks';
import type { TaskDashboard } from '../../types/task';
import { ListChecks, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const TaskDashboardWidget: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<TaskDashboard | null>(null);

  useEffect(() => {
    taskService.getDashboard().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <div
      onClick={() => navigate('/business-development/tasks')}
      className="bg-[#110B2E]/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl cursor-pointer hover:border-slate-700 transition"
    >
      <div className="flex items-center space-x-2 mb-3">
        <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
          <ListChecks className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-bold text-white">My Tasks</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-[#1A1040]/70 border border-slate-800">
          <div className="text-base font-bold text-white">{data.open_count}</div>
          <div className="text-[10px] text-slate-500">Open</div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#1A1040]/70 border border-slate-800 flex flex-col items-center">
          <div className="flex items-center gap-1">
            {data.overdue_count > 0 && <AlertTriangle className="w-3 h-3 text-rose-400" />}
            <span className={`text-base font-bold ${data.overdue_count > 0 ? 'text-rose-400' : 'text-white'}`}>
              {data.overdue_count}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">Overdue</div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#1A1040]/70 border border-slate-800 flex flex-col items-center">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-base font-bold text-white">{data.completed_this_week}</span>
          </div>
          <div className="text-[10px] text-slate-500">Done (7d)</div>
        </div>
      </div>
    </div>
  );
};
