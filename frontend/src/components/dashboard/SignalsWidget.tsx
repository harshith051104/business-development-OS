import React, { useEffect, useState } from 'react';
import { signalService } from '../../services/signals';
import type { SignalItem } from '../../types/signal';
import { Zap, X } from 'lucide-react';

export const SignalsWidget: React.FC = () => {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    signalService
      .list(5)
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, []);

  const dismiss = async (id: number) => {
    setSignals((prev) => prev.filter((s) => s.id !== id));
    try {
      await signalService.dismiss(id);
    } catch {
      // already optimistically removed; next poll will reconcile
    }
  };

  if (loading || signals.length === 0) return null;

  return (
    <div className="bg-[#110B2E]/90 border border-amber-500/20 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center space-x-2 mb-3">
        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <Zap className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-bold text-white">Buying Signals</h3>
        <span className="text-[10px] text-slate-500">({signals.length})</span>
      </div>
      <div className="space-y-1.5">
        {signals.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#1A1040]/70 border border-slate-800/80 text-xs"
          >
            <span className="text-slate-300 truncate">{s.description}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold text-amber-400">{s.score}</span>
              <button
                onClick={() => dismiss(s.id)}
                className="text-slate-500 hover:text-white transition"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
