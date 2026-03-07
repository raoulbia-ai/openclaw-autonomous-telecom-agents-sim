import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { get } from '../lib/api';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';

function SituationPanel({ atlas }) {
  if (!atlas?.markdown) return null;

  // Extract the ## Summary section from the atlas markdown
  const match = atlas.markdown.match(/##\s*Summary\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
  const summary = match?.[1]?.trim();
  if (!summary) return null;

  const age = atlas.mtime
    ? Math.round((Date.now() - new Date(atlas.mtime)) / 60000)
    : null;
  const ageLabel = age == null ? null : age < 1 ? 'just now' : age < 60 ? `${age}m ago` : `${Math.floor(age/60)}h ${age%60}m ago`;

  return (
    <div className="rounded-lg border border-violet-800/50 bg-violet-950/10 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-violet-400">Network Status — ORACLE</p>
        {ageLabel && <p className="text-xs text-slate-500">{ageLabel}</p>}
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{summary}</p>
      <Link to="/atlas" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Read full status report →</Link>
    </div>
  );
}

function GrowthChart({ heartbeats, comms }) {
  if (!heartbeats?.length) return null;

  // One point per cycle — deduplicate by cycle number, keep latest
  const byTime = {};
  for (const h of heartbeats) {
    const key = h.at;
    if (!byTime[key] || h.cells > (byTime[key].cells ?? 0)) byTime[key] = h;
  }
  const data = Object.values(byTime)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .map(h => ({
      at: h.at,
      t: new Date(h.at).getTime(),
      label: new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cells: h.cells,
    }));

  if (data.length < 2) return null;

  const waves = (comms ?? []).filter(c => c.from === 'ARCHITECT' && c.type === 'growth');

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs shadow-lg">
        <p className="text-slate-300 font-medium">{d.cells} cells</p>
        <p className="text-slate-500">{new Date(d.at).toLocaleString()}</p>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-4">Cell Growth Over Time</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={36} domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          {waves.map(w => (
            <ReferenceLine
              key={w.at}
              x={new Date(w.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: 'growth', position: 'top', fill: '#f59e0b', fontSize: 10 }}
            />
          ))}
          <Line
            type="stepAfter"
            dataKey="cells"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', stroke: '#0f172a', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

const AGENT_META = {
  SENTINEL:  { colour: 'text-cyan-400',   border: 'border-cyan-900',   bg: 'bg-cyan-950/20',   tagline: 'Always watching' },
  ORACLE:    { colour: 'text-violet-400', border: 'border-violet-900', bg: 'bg-violet-950/20', tagline: 'Pattern analyst' },
  ARCHITECT: { colour: 'text-amber-400',  border: 'border-amber-900',  bg: 'bg-amber-950/20',  tagline: 'Network planner' },
};

const TYPE_BADGE = {
  handoff:  'bg-slate-800 text-slate-400',
  atlas:    'bg-violet-900/50 text-violet-300',
  advisory: 'bg-amber-900/50 text-amber-300',
  growth:   'bg-green-900/50 text-green-300',
};

function AgentPulse({ comms, signals }) {
  if (!comms?.length) return null;

  // comms is newest-first from API — first match per agent is the latest
  const lastPerAgent = {};
  const lastGrowth = comms.find(c => c.from === 'ARCHITECT' && c.type === 'growth');
  for (const c of comms) {
    if (!lastPerAgent[c.from]) lastPerAgent[c.from] = c;
  }

  // ARCHITECT forecast
  const totalCells = signals?.summary?.totalCells ?? 0;
  const nextRunAt = lastGrowth
    ? new Date(new Date(lastGrowth.at).getTime() + 30 * 60 * 1000)
    : null;
  const minsSinceGrowth = lastGrowth
    ? (Date.now() - new Date(lastGrowth.at).getTime()) / 60000
    : Infinity;
  const willGrow = totalCells < 8000 && minsSinceGrowth > 40;
  const minsUntil = nextRunAt ? Math.round((nextRunAt - Date.now()) / 60000) : null;
  const nextRunLabel = minsUntil == null
    ? null
    : minsUntil <= 0
    ? 'due now'
    : minsUntil < 60
    ? `in ${minsUntil}m`
    : `in ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 divide-y divide-slate-800">
      <p className="text-xs uppercase tracking-widest text-slate-500 px-4 pt-3 pb-2">Agent Activity</p>
      {['SENTINEL', 'ORACLE', 'ARCHITECT'].map(name => {
        const meta = AGENT_META[name];
        const entry = lastPerAgent[name];
        return (
          <div key={name} className={`px-4 py-3 flex gap-4 items-start`}>
            <div className="flex-none w-28 pt-0.5">
              <p className={`text-xs font-bold ${meta.colour}`}>{name}</p>
              <p className="text-xs text-slate-600">{meta.tagline}</p>
            </div>
            <div className="flex-1 min-w-0">
              {entry ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[entry.type] ?? 'bg-slate-800 text-slate-400'}`}>
                      {entry.type}
                    </span>
                    <span className="text-xs text-slate-600">{timeAgo(entry.at)}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug line-clamp-2">{entry.message}</p>
                  {name === 'ARCHITECT' && nextRunLabel && (
                    <p className="text-xs mt-1.5 text-slate-500">
                      Est. next run {nextRunLabel}
                      {' · '}
                      <span className={willGrow ? 'text-green-400' : 'text-slate-500'}>
                        {willGrow ? 'growth condition met' : 'growth condition not met'}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-600 italic">No transmissions yet</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function extractSection(markdown, heading) {
  if (!markdown) return null;
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|\\n#\\s|$)`, 'i');
  return markdown.match(re)?.[1]?.trim() ?? null;
}

const ZONE_RISK_STYLE = {
  'event-load':             { cls: 'bg-amber-900/40 text-amber-300 border-amber-700',  label: 'event load'    },
  'high-wind':              { cls: 'bg-slate-800 text-slate-300 border-slate-600',      label: 'high wind'     },
  'storm-warning-yellow':   { cls: 'bg-yellow-900/50 text-yellow-300 border-yellow-700', label: 'storm (yellow)' },
  'storm-warning-orange':   { cls: 'bg-orange-900/50 text-orange-300 border-orange-700', label: 'storm (orange)' },
  'storm-warning-red':      { cls: 'bg-red-900/50 text-red-300 border-red-700',         label: 'storm (red)'   },
};

function ExternalIntelPanel({ atlas, extCtx }) {
  const oracleContext = extractSection(atlas?.markdown, 'External Context');
  const summary = oracleContext ?? extCtx?.summary;
  if (!summary) return null;

  const isOracle = !!oracleContext;
  const age = isOracle && atlas?.mtime ? Math.round((Date.now() - new Date(atlas.mtime)) / 60000)
            : extCtx?.fetchedAt        ? Math.round((Date.now() - new Date(extCtx.fetchedAt)) / 60000)
            : null;
  const ageLabel = age == null ? null : age < 1 ? 'just now' : age < 60 ? `${age}m ago` : `${Math.floor(age/60)}h ${age%60}m ago`;
  const zoneRisks = extCtx?.zoneRisks ?? {};
  const riskyZones = Object.entries(zoneRisks).filter(([, r]) => r !== 'none');

  return (
    <div className="rounded-lg border border-sky-800/40 bg-sky-950/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-sky-400">External Intelligence — ORACLE</p>
        {ageLabel && (
          <p className="text-xs text-slate-500">
            {isOracle ? 'ORACLE read' : 'data'} {ageLabel}
          </p>
        )}
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
      {riskyZones.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Active zone risks</p>
          <div className="flex flex-wrap gap-1.5">
            {riskyZones.map(([county, risk]) => {
              const s = ZONE_RISK_STYLE[risk] ?? { cls: 'bg-slate-800 text-slate-400 border-slate-700', label: risk };
              return (
                <span key={county} className={`text-xs px-2 py-0.5 rounded border font-medium ${s.cls}`}>
                  {county} · {s.label}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-slate-600">ARCHITECT reads these risks before each growth wave and skips or deprioritises affected counties.</p>
        </div>
      )}
      {!isOracle && (
        <p className="text-xs text-slate-600">ORACLE will incorporate this into its next network status report (runs every 30 min).</p>
      )}
    </div>
  );
}

function RemediationPanel({ actions }) {
  if (!actions?.length) return null;
  const recent = actions.filter(a => a.changed);
  if (recent.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/10 p-4 space-y-3">
      <p className="text-xs uppercase tracking-widest text-emerald-400">Remediation Actions — ARCHITECT</p>
      <div className="space-y-2">
        {recent.slice(0, 5).map((a, i) => {
          const age = Math.round((Date.now() - new Date(a.at)) / 60000);
          const ageLabel = age < 1 ? 'just now' : age < 60 ? `${age}m ago` : `${Math.floor(age/60)}h ${age%60}m ago`;
          return (
            <div key={i} className="flex items-start gap-3 text-xs">
              <span className="text-emerald-400 font-medium flex-none w-28">{a.action.replace(/-/g, ' ')}</span>
              <span className="text-slate-300 flex-1">{a.result}</span>
              <span className="text-slate-600 flex-none">{ageLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function cellLabel(cellId) {
  const site = cellId.match(/MeContext=([^,]+)/)?.[1] ?? cellId;
  const num  = cellId.match(/NRCellDU=(\d+)/)?.[1];
  return num ? `${site} · cell ${num}` : site;
}

function StatCard({ label, value, highlight, active, onClick, tooltip }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div
      className={`rounded-lg border p-4 transition-colors relative ${
        active
          ? 'border-indigo-500 bg-indigo-900/20'
          : highlight
          ? 'border-red-700 bg-red-900/20 hover:border-red-500'
          : 'border-slate-700 bg-slate-900'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        {tooltip && (
          <span
            className="text-slate-600 hover:text-slate-400 cursor-help text-xs leading-none"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >?</span>
        )}
      </div>
      <p className={`text-3xl font-bold ${active ? 'text-indigo-300' : highlight ? 'text-red-400' : 'text-slate-100'}`}>
        {value ?? '—'}
      </p>
      {tooltip && showTip && (
        <div className="absolute z-10 bottom-full left-0 mb-2 w-64 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-300 shadow-xl leading-relaxed">
          {tooltip}
        </div>
      )}
    </div>
  );
}

function CellDrilldown({ activeCard, perf, alarms, signals }) {
  if (!activeCard) return null;

  let cells = [];

  if (activeCard === 'outliers') {
    cells = (perf?.outliers ?? []).map(c => ({
      id: c.cellId,
      label: cellLabel(c.cellId),
      detail: c.flags?.join(', ') || null,
      colour: 'border-orange-800 bg-orange-900/10',
      textColour: 'text-orange-300',
    }));
  } else if (activeCard === 'alarms') {
    const seen = new Set();
    for (const a of alarms?.alarms ?? []) {
      if (seen.has(a.managedObjectInstance)) continue;
      seen.add(a.managedObjectInstance);
      cells.push({
        id: a.managedObjectInstance,
        label: cellLabel(a.managedObjectInstance),
        detail: `${a.perceivedSeverity}: ${a.specificProblem ?? a.alarmId}`,
        colour: 'border-red-800 bg-red-900/10',
        textColour: 'text-red-300',
      });
    }
  } else if (activeCard === 'crosszone') {
    cells = (signals?.crossZoneSignals ?? []).map(s => ({
      id: s.cellId,
      label: cellLabel(s.cellId),
      detail: [...(s.perfFlags ?? []), ...(s.alarms ?? []).map(a => `${a.severity}: ${a.problem}`)].join(' · ') || null,
      colour: 'border-red-800 bg-red-900/10',
      textColour: 'text-red-300',
    }));
  }

  const titles = { outliers: 'Perf Outliers', alarms: 'Active Alarms', crosszone: 'Cross-zone Hits' };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">{titles[activeCard]}</p>
      {cells.length === 0 ? (
        <p className="text-sm text-slate-500">No cells in this category.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cells.map(c => (
            <div key={c.id} className={`rounded border px-3 py-2 ${c.colour}`}>
              <p className={`text-xs font-medium ${c.textColour}`}>{c.label}</p>
              {c.detail && <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [signals, setSignals]   = useState(null);
  const [perf, setPerf]         = useState(null);
  const [alarms, setAlarms]     = useState(null);
  const [status, setStatus]     = useState(null);
  const [comms, setComms]       = useState(null);
  const [topology, setTopology]     = useState(null);
  const [heartbeats, setHeartbeats] = useState(null);
  const [atlas, setAtlas]           = useState(null);
  const [extCtx, setExtCtx]         = useState(null);
  const [remediation, setRemediation] = useState(null);
  const [tick, setTick]         = useState(0);
  const [activeCard, setActive] = useState(null);

  useEffect(() => {
    Promise.all([
      get('/api/signals').catch(() => null),
      get('/api/performance').catch(() => null),
      get('/api/status').catch(() => null),
      get('/api/alarms').catch(() => null),
      get('/api/agent-comms').catch(() => null),
      get('/api/topology').catch(() => null),
      get('/api/heartbeat').catch(() => null),
      get('/api/atlas').catch(() => null),
      get('/api/external-context').catch(() => null),
      get('/api/remediation').catch(() => null),
    ]).then(([s, p, st, a, c, t, h, at, ec, rm]) => {
      setSignals(s);
      setPerf(p);
      setStatus(st);
      setAlarms(a);
      setComms(c);
      setTopology(t);
      setHeartbeats(h);
      setAtlas(at);
      setExtCtx(ec);
      setRemediation(rm);
    });
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const navigate  = useNavigate();
  const crossZone = signals?.crossZoneSignals ?? [];
  const lastRun   = status?.signals?.mtime ? new Date(status.signals.mtime).toLocaleString() : null;

  const counterMap = {};
  for (const cell of [...(perf?.outliers ?? []), ...(perf?.elevated ?? [])]) {
    counterMap[cell.cellId] = cell.counters;
  }

  const toggle = (key) => setActive(prev => prev === key ? null : key);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
          {lastRun && <p className="text-xs text-slate-500 mt-0.5">Last collection: {lastRun}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard label="Sites"      value={topology?.sites?.length} />
        <StatCard label="Total Cells" value={signals?.summary?.totalCells} />
        <StatCard
          label="Perf Outliers"
          value={signals?.summary?.perfOutliers}
          highlight={signals?.summary?.perfOutliers > 0}
          active={activeCard === 'outliers'}
          onClick={signals?.summary?.perfOutliers > 0 ? () => toggle('outliers') : undefined}
        />
        <StatCard label="Elevated" value={signals?.summary?.perfElevated} />
        <StatCard
          label="Active Alarms"
          value={signals?.summary?.activeAlarms}
          highlight={signals?.summary?.activeAlarms > 0}
          active={activeCard === 'alarms'}
          onClick={signals?.summary?.activeAlarms > 0 ? () => toggle('alarms') : undefined}
        />
        <StatCard
          label="Cross-zone Hits"
          value={signals?.summary?.crossZoneHits}
          highlight={signals?.summary?.crossZoneHits > 0}
          active={activeCard === 'crosszone'}
          onClick={signals?.summary?.crossZoneHits > 0 ? () => toggle('crosszone') : undefined}
          tooltip="A cell flagged independently by both the performance monitor (PM counters breached) and the alarm system. Dual-detection means it's a real fault, not a transient blip — SENTINEL names these in its handoff to ORACLE."
        />
      </div>

      <SituationPanel atlas={atlas} />

      <GrowthChart heartbeats={heartbeats} comms={comms} />

      <AgentPulse comms={comms} signals={signals} />

      <RemediationPanel actions={remediation} />

      <ExternalIntelPanel atlas={atlas} extCtx={extCtx} />

      <CellDrilldown activeCard={activeCard} perf={perf} alarms={alarms} signals={signals} />

      {crossZone.length > 0 && (
        <div className="rounded-lg border border-red-700 bg-red-900/10 p-4">
          <p className="text-sm font-semibold text-red-400">Cells requiring attention</p>
          <p className="text-xs text-slate-500 mb-3 mt-0.5">These cells have been independently flagged by both the performance agent (PM counter thresholds breached) and the alarm agent (active fault raised). Dual-detection indicates a real problem, not a transient blip.</p>
          <div className="space-y-3">
            {crossZone.map(sig => {
              const label = cellLabel(sig.cellId);
              const c = counterMap[sig.cellId];
              return (
                <div
                  key={sig.cellId}
                  className="rounded border border-red-800 bg-red-900/20 p-3 cursor-pointer hover:border-red-600 hover:bg-red-900/30 transition-colors"
                  onClick={() => navigate(`/map?cell=${encodeURIComponent(sig.cellId)}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-red-300">{label}</p>
                    <span className="text-xs text-slate-500 hover:text-slate-300">View on map →</span>
                  </div>

                  {c && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {c.dlThpCell != null && (
                        <div className="rounded bg-slate-900/60 px-2 py-1.5 text-center">
                          <p className="text-xs font-semibold text-slate-200">{c.dlThpCell} Mbps</p>
                          <p className="text-xs text-slate-500">DL throughput</p>
                        </div>
                      )}
                      {c.errorRate != null && (
                        <div className="rounded bg-slate-900/60 px-2 py-1.5 text-center">
                          <p className="text-xs font-semibold text-slate-200">{c.errorRate}%</p>
                          <p className="text-xs text-slate-500">Error rate</p>
                        </div>
                      )}
                      {c.cellAvailTime != null && (
                        <div className="rounded bg-slate-900/60 px-2 py-1.5 text-center">
                          <p className="text-xs font-semibold text-slate-200">{c.cellAvailTime}%</p>
                          <p className="text-xs text-slate-500">Availability</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {sig.perfFlags.map((f, i) => (
                      <p key={i} className="text-xs text-orange-300">⚠ {f}</p>
                    ))}
                    {sig.alarms.map((a, i) => (
                      <p key={i} className="text-xs text-red-400">🔔 {a.severity}: {a.problem}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
