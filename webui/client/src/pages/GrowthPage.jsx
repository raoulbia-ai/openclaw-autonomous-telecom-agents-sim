import { useEffect, useState } from 'react';
import { get } from '../lib/api';

const GROWTH_TARGET = 8000;

function timeAgo(iso) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

export default function GrowthPage() {
  const [comms, setComms]   = useState([]);
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      get('/api/agent-comms').catch(() => []),
      get('/api/signals').catch(() => null),
    ]).then(([c, s]) => {
      setComms(c);
      setSignals(s);
      setLoading(false);
    });

    const id = setInterval(() => {
      Promise.all([
        get('/api/agent-comms').catch(() => []),
        get('/api/signals').catch(() => null),
      ]).then(([c, s]) => { setComms(c); setSignals(s); });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const waves = comms.filter(c => c.from === 'ARCHITECT' && c.type === 'growth');
  const totalCells = signals?.summary?.totalCells ?? 0;
  const pct = Math.min(100, Math.round((totalCells / GROWTH_TARGET) * 100));

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-slate-100">Network Growth</h1>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (waves.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-slate-100">Network Growth</h1>
        <p className="text-xs text-slate-500">ARCHITECT expands the network every ~2 hours when the growth condition is met.</p>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-500 text-sm">No growth waves yet — ARCHITECT runs every 2 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Network Growth</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          ARCHITECT expands the network every ~2 hours, routing around any zones flagged by ORACLE.
        </p>
      </div>

      {/* Progress */}
      <div className="rounded-lg border border-indigo-800 bg-slate-900 p-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {totalCells.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">/ {GROWTH_TARGET.toLocaleString()} cells</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {(GROWTH_TARGET - totalCells).toLocaleString()} remaining · {waves.length} wave{waves.length !== 1 ? 's' : ''} completed
            </p>
          </div>
          <p className="text-2xl font-bold text-indigo-400">{pct}%</p>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Wave log — newest first, sourced from agent-comms */}
      <div className="space-y-3">
        {waves.map((entry) => {
          const waveNum = entry.message.match(/wave\s+(\d+)/i)?.[1] ?? '?';
          return (
            <div key={entry.at} className="rounded-lg border border-amber-800/50 bg-amber-950/10 p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-400">Wave {waveNum}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-800">growth</span>
                </div>
                <span className="text-xs text-slate-500">{timeAgo(entry.at)} · {new Date(entry.at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{entry.message}</p>
            </div>
          );
        })}
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">Wave 1</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">growth</span>
            <span className="text-xs text-slate-600">pre-comms log</span>
          </div>
          <p className="text-sm text-slate-500">Carlow, Longford, Monaghan, Cavan — initial midlands/north expansion.</p>
        </div>
      </div>
    </div>
  );
}
