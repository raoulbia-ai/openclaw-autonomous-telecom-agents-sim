import { useEffect, useState, useRef } from 'react';
import { get } from '../lib/api';

function CycleBadge({ entry }) {
  if (entry.notable) {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300 font-medium">notable</span>;
  }
  return <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">steady</span>;
}

function StatPill({ label, value, warn }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${warn ? 'border-amber-700 text-amber-400' : 'border-slate-700 text-slate-400'}`}>
      {label}: <span className={warn ? 'text-amber-300 font-medium' : 'text-slate-300'}>{value}</span>
    </span>
  );
}

function HeartbeatEntry({ entry, isFirst }) {
  const t = new Date(entry.at);
  const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = t.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className={`rounded-lg border p-4 space-y-2.5 ${entry.notable ? 'border-indigo-700 bg-indigo-950/30' : 'border-slate-800 bg-slate-900/60'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="text-center">
            <p className="text-xs text-slate-500 leading-none">{dateStr}</p>
            <p className="text-sm font-mono text-slate-300 leading-tight">{timeStr}</p>
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <span className="text-xs text-slate-500 font-mono">cycle {entry.cycle}</span>
          {isFirst && <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-800">latest</span>}
        </div>
        <CycleBadge entry={entry} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatPill label="cells" value={entry.cells} />
        <StatPill label="outliers" value={entry.outliers} warn={entry.outliers > 0} />
        <StatPill label="alarms" value={entry.alarms} warn={entry.alarms > 0} />
        <StatPill label="cross-zone" value={entry.crossZone} warn={entry.crossZone > 0} />
      </div>

      <p className={`text-sm leading-relaxed ${entry.notable ? 'text-slate-200' : 'text-slate-400'}`}>
        {entry.summary}
      </p>
    </div>
  );
}

export default function HeartbeatPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevCountRef = useRef(0);

  useEffect(() => {
    let active = true;

    const load = () =>
      get('/api/heartbeat')
        .then(data => { if (active) { setEntries(data); setLoading(false); prevCountRef.current = data.length; } })
        .catch(() => { if (active) setLoading(false); });

    load();
    const id = setInterval(load, 30_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const newCount = entries.length > prevCountRef.current ? entries.length - prevCountRef.current : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Heartbeat</h1>
          <p className="text-sm text-slate-400 mt-1">
            SENTINEL wakes every 10 minutes, reads the network, and logs what it found and decided.
            {entries.length > 0 && <span className="ml-2 text-slate-500">· {entries.length} cycles</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          auto-refresh 30s
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-10 text-center space-y-2">
          <p className="text-slate-300 text-sm font-medium">Waiting for first heartbeat</p>
          <p className="text-slate-500 text-xs">NKA runs every 10 minutes. The first entry will appear here after the next cycle completes.</p>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <HeartbeatEntry key={`${entry.at}-${entry.cycle}`} entry={entry} isFirst={i === 0} />
        ))}
      </div>
    </div>
  );
}
