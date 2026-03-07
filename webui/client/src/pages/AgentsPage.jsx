import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';

const AGENT_META = {
  SENTINEL: {
    tagline: 'Always watching. Never sleeps.',
    colour: 'border-cyan-700 bg-cyan-950/20',
    badge: 'bg-cyan-900/60 text-cyan-300 border-cyan-800',
    dot: 'bg-cyan-400',
    text: 'text-cyan-400',
  },
  ORACLE: {
    tagline: 'Sees the pattern in the noise.',
    colour: 'border-violet-700 bg-violet-950/20',
    badge: 'bg-violet-900/60 text-violet-300 border-violet-800',
    dot: 'bg-violet-400',
    text: 'text-violet-400',
  },
  ARCHITECT: {
    tagline: 'Builds what the network needs.',
    colour: 'border-amber-700 bg-amber-950/20',
    badge: 'bg-amber-900/60 text-amber-300 border-amber-800',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
  },
};

const EXT_INTEL_KEYWORDS = [
  'weather', 'rain', 'wind', 'storm', 'precip', 'flood', 'fog', 'snow', 'ice',
  'met éireann', 'met eireann', 'warning',
  'event', 'concert', 'match', 'gig', 'festival', '3arena', 'croke park', 'aviva',
  'traffic', 'incident', 'accident', 'road works', 'road closed', 'closure',
  'm50', 'm1', 'm7', 'm11', 'n7', 'n11', 'congestion',
];

function hasExtIntel(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return EXT_INTEL_KEYWORDS.some(k => lower.includes(k));
}

const TYPE_LABEL = {
  handoff:  { label: 'handoff',  cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  atlas:    { label: 'status report', cls: 'bg-violet-900/50 text-violet-300 border-violet-800' },
  advisory: { label: 'advisory', cls: 'bg-amber-900/50 text-amber-300 border-amber-800' },
  growth:   { label: 'growth',   cls: 'bg-green-900/50 text-green-300 border-green-800' },
};

function AgentCard({ name, lastComm, heartbeat }) {
  const meta = AGENT_META[name] || AGENT_META.SENTINEL;
  const lastSeen = lastComm?.at || heartbeat?.at || null;
  const timeStr = lastSeen
    ? new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${meta.colour}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${lastSeen ? meta.dot : 'bg-slate-600'} ${lastSeen ? 'animate-pulse' : ''}`} />
          <span className={`text-sm font-bold tracking-wide ${meta.text}`}>{name}</span>
        </div>
        {lastSeen && (
          <span className="text-xs text-slate-500 font-mono">{timeStr}</span>
        )}
      </div>
      <p className="text-xs text-slate-400 italic">{meta.tagline}</p>
      {lastComm && (
        <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800 pt-2">
          {lastComm.message}
        </p>
      )}
      {!lastComm && (
        <p className="text-xs text-slate-600 border-t border-slate-800 pt-2">Waiting for first transmission…</p>
      )}
    </div>
  );
}

function CommEntry({ entry, isFirst }) {
  const fromMeta = AGENT_META[entry.from] || {};
  const typeMeta = TYPE_LABEL[entry.type] || { label: entry.type, cls: 'bg-slate-800 text-slate-400 border-slate-700' };
  const t = new Date(entry.at);
  const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = t.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className={`rounded-lg border p-3.5 space-y-2 ${entry.type === 'advisory' ? 'border-amber-800/60 bg-amber-950/10' : entry.type === 'growth' ? 'border-green-800/60 bg-green-950/10' : entry.type === 'atlas' ? 'border-violet-800/60 bg-violet-950/10' : 'border-slate-800 bg-slate-900/50'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold tracking-wide ${fromMeta.text || 'text-slate-300'}`}>{entry.from}</span>
          <span className="text-slate-600 text-xs">→</span>
          <span className="text-xs text-slate-400 font-medium">{entry.to}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${typeMeta.cls}`}>{typeMeta.label}</span>
          {isFirst && <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-800">latest</span>}
          {hasExtIntel(entry.message) && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-sky-900/50 text-sky-300 border border-sky-800" title="This message references external intelligence (weather, events, or traffic)">ext. intel</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 font-mono leading-none">{timeStr}</p>
          <p className="text-xs text-slate-600 leading-none mt-0.5">{dateStr}</p>
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{entry.message}</p>
      {entry.cycle != null && (
        <div className="flex gap-2 flex-wrap">
          {entry.cycle != null && <span className="text-xs px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">cycle {entry.cycle}</span>}
          {entry.cells != null && <span className="text-xs px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">cells {entry.cells}</span>}
          {entry.crossZone > 0 && <span className="text-xs px-1.5 py-0.5 rounded border border-amber-700 text-amber-400">cross-zone {entry.crossZone}</span>}
          {entry.alarms > 0 && <span className="text-xs px-1.5 py-0.5 rounded border border-red-800 text-red-400">alarms {entry.alarms}</span>}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [comms, setComms]         = useState([]);
  const [heartbeats, setHeartbeats] = useState([]);
  const [loading, setLoading]     = useState(true);
  const prevCountRef              = useRef(0);

  useEffect(() => {
    let active = true;

    const load = () =>
      Promise.all([
        get('/api/agent-comms').catch(() => []),
        get('/api/heartbeat').catch(() => []),
      ]).then(([c, h]) => {
        if (!active) return;
        setComms(c);
        setHeartbeats(h);
        setLoading(false);
        prevCountRef.current = c.length;
      });

    load();
    const id = setInterval(load, 20_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Build per-agent last comm and last heartbeat — comms/heartbeats already newest-first
  const lastComm = {};
  const lastHb   = {};
  for (const entry of comms) {
    if (!lastComm[entry.from]) lastComm[entry.from] = entry;
  }
  for (const entry of heartbeats) {
    if (entry.agent && !lastHb[entry.agent]) lastHb[entry.agent] = entry;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Agents</h1>
          <p className="text-sm text-slate-400 mt-1">
            Three autonomous agents cooperating through a shared bulletin board.
            {comms.length > 0 && <span className="ml-2 text-slate-500">· {comms.length} transmissions</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          auto-refresh 20s
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['SENTINEL', 'ORACLE', 'ARCHITECT'].map(name => (
          <AgentCard
            key={name}
            name={name}
            lastComm={lastComm[name] || null}
            heartbeat={lastHb[name] || null}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(TYPE_LABEL).map(([type, { label, cls }]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>
        ))}
        <span className="text-xs text-slate-600 self-center ml-1">message types</span>
      </div>

      {/* Comms feed */}
      {loading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      )}

      {!loading && comms.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-10 text-center space-y-2">
          <p className="text-slate-300 text-sm font-medium">Waiting for first transmission</p>
          <p className="text-slate-500 text-xs">
            SENTINEL posts every cycle. ORACLE follows every few minutes. ARCHITECT acts on a longer interval.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {comms.map((entry, i) => (
          <CommEntry key={`${entry.at}-${entry.from}-${i}`} entry={entry} isFirst={i === 0} />
        ))}
      </div>

      <div className="border-t border-slate-800 pt-4">
        <Link to="/heartbeat" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          View raw cycle log →
        </Link>
      </div>
    </div>
  );
}
