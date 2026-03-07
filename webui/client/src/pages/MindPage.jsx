import { useEffect, useState } from 'react';

const AGENTS = ['SENTINEL', 'ORACLE', 'ARCHITECT'];

const AGENT_COLORS = {
  SENTINEL:  { bg: 'bg-cyan-950/40',    border: 'border-cyan-700/50',    text: 'text-cyan-400',    badge: 'bg-cyan-900 text-cyan-300' },
  ORACLE:    { bg: 'bg-violet-950/40',   border: 'border-violet-700/50',  text: 'text-violet-400',  badge: 'bg-violet-900 text-violet-300' },
  ARCHITECT: { bg: 'bg-emerald-950/40',  border: 'border-emerald-700/50', text: 'text-emerald-400', badge: 'bg-emerald-900 text-emerald-300' },
};

function detectAgent(text) {
  // Check first 200 chars for role identification patterns
  // Order matters: check "I am X" / "as X" patterns first to avoid cross-references
  const snippet = text.slice(0, 300).toUpperCase();
  for (const name of ['SENTINEL', 'ORACLE', 'ARCHITECT']) {
    if (snippet.includes(`AM ${name}`) || snippet.includes(`AS ${name}`) || snippet.includes(`${name}.MD`) || snippet.includes(`${name}-FAST`)) {
      return name;
    }
  }
  // Fallback: first mention in full text
  const upper = text.toUpperCase();
  if (upper.includes('SENTINEL')) return 'SENTINEL';
  if (upper.includes('ORACLE')) return 'ORACLE';
  if (upper.includes('ARCHITECT')) return 'ARCHITECT';
  return null;
}

const MAX_RUNS = 20;
function capRuns(runs) {
  const keys = Object.keys(runs);
  if (keys.length <= MAX_RUNS) return runs;
  // Evict oldest completed runs
  const sorted = keys.sort((a, b) => (runs[a].startTs || 0) - (runs[b].startTs || 0));
  const next = { ...runs };
  for (const k of sorted) {
    if (Object.keys(next).length <= MAX_RUNS) break;
    if (next[k].done) delete next[k];
  }
  return next;
}

export default function MindPage() {
  // runId → { agent|null, chunks[], done, startTs }
  const [runs, setRuns] = useState({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/agent-stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const { runId, event, agent } = d;
        if (!runId) return;

        setRuns(prev => {
          const cur = prev[runId] || { agent: null, chunks: [], done: false, startTs: d.ts };

          // Resolve agent: prefer server, then existing, then detect from text
          let bestAgent = (agent && agent !== 'UNKNOWN') ? agent : cur.agent;

          if (event === 'assistant_text_stream' && d.evtType === 'text_delta' && d.delta) {
            const newChunks = [...cur.chunks, d.delta];
            if (!bestAgent) {
              bestAgent = detectAgent(newChunks.join(''));
            }
            return capRuns({ ...prev, [runId]: { ...cur, agent: bestAgent, chunks: newChunks } });
          }
          if (event === 'assistant_message_end') {
            if (!bestAgent) bestAgent = detectAgent(cur.chunks.join(''));
            return capRuns({ ...prev, [runId]: { ...cur, agent: bestAgent, done: true } });
          }
          return prev;
        });
      } catch {}
    };

    return () => es.close();
  }, []);

  // Group runs by agent, newest first, keep last 5 per agent
  const grouped = {};
  for (const name of AGENTS) grouped[name] = [];

  const sorted = Object.entries(runs)
    .filter(([, r]) => r.chunks.length > 0)
    .sort((a, b) => (b[1].startTs || 0) - (a[1].startTs || 0));

  for (const [runId, run] of sorted) {
    const agent = run.agent;
    if (agent && grouped[agent] && grouped[agent].length < 5) {
      grouped[agent].push({ runId, ...run });
    }
  }

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 7rem)', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Agent Minds</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live LLM output — most recent runs per agent</p>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <span className="text-xs text-green-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />connected</span>
          ) : (
            <span className="text-xs text-red-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />disconnected</span>
          )}
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded px-2 py-1 transition-colors"
          >refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {AGENTS.map(name => {
          const colors = AGENT_COLORS[name];
          const agentRuns = grouped[name];
          const current = agentRuns[0];

          return (
            <div
              key={name}
              className={`rounded-lg border ${colors.border} ${colors.bg} flex flex-col min-h-0`}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/50 shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.badge}`}>
                  {name}
                </span>
                {current ? (
                  <>
                    {current.done ? (
                      <span className="text-xs text-slate-600">● done</span>
                    ) : (
                      <span className="text-xs text-green-500 animate-pulse">● live</span>
                    )}
                    <span className="text-xs text-slate-600 ml-auto">{agentRuns.length} run{agentRuns.length > 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-600">waiting…</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                {agentRuns.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">No activity yet</p>
                ) : (
                  agentRuns.map((stream, i) => {
                    const text = stream.chunks.join('');
                    const time = stream.startTs ? new Date(stream.startTs).toLocaleTimeString() : '?';
                    return (
                      <div key={stream.runId}>
                        {i > 0 && (
                          <div className="my-3 flex items-center gap-2">
                            <div className="flex-1 border-t border-dashed border-slate-700/60" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs font-mono ${i === 0 ? 'text-slate-400' : 'text-slate-600'}`}>{time}</span>
                          <span className="text-xs text-slate-700 font-mono">{stream.runId.slice(0, 8)}</span>
                          {i === 0 && !stream.done && (
                            <span className="text-xs text-green-500 animate-pulse">streaming</span>
                          )}
                        </div>
                        <pre className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${i === 0 ? colors.text : 'text-slate-700'} font-mono`}>
                          {text}
                          {i === 0 && !stream.done && <span className="animate-pulse">▌</span>}
                        </pre>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
