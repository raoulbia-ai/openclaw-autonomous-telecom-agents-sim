import { useEffect, useState } from 'react';
import { get } from '../lib/api';

function extractSection(markdown, heading) {
  if (!markdown) return null;
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|\\n#\\s|$)`, 'i');
  return markdown.match(re)?.[1]?.trim() ?? null;
}

export default function AtlasPage() {
  const [atlases, setAtlases] = useState([]); // [{mtime, html}, ...]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch latest + history in parallel
        const [latest, history] = await Promise.all([
          get('/api/atlas').catch(() => null),
          get('/api/atlas/history').catch(() => []),
        ]);

        if (!latest) { setAtlases([]); setLoading(false); return; }

        // Fetch all historical entries
        const historical = await Promise.all(
          history
            .filter(h => new Date(h.mtime).getTime() !== new Date(latest.mtime).getTime())
            .map(h => get(`/api/atlas/history/${h.id}`).catch(() => null))
        );

        // Latest first, then history newest→oldest
        setAtlases([latest, ...historical.filter(Boolean)]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Network Status</h1>
        <p className="text-sm text-slate-400 mt-1">ORACLE's network status report — synthesises performance data and alarms into a plain-language analysis of current network health</p>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      )}

      {!loading && atlases.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-slate-400 text-sm">No network status report yet — ORACLE generates one automatically every 30 minutes.</p>
        </div>
      )}

      {atlases.map((atlas, i) => {
        const extContext = extractSection(atlas.markdown, 'External Context');
        return (
        <div key={i} className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <p className="text-sm text-slate-400 mb-4 pb-4 border-b border-slate-800">
            {i === 0
              ? <span className="text-indigo-400 font-medium">Latest · </span>
              : <span className="text-slate-500">Previous · </span>
            }
            {new Date(atlas.mtime).toLocaleString()}
          </p>

          {i === 0 && extContext && (
            <div className="mb-5 rounded-lg border border-sky-800/50 bg-sky-950/20 p-4 space-y-1.5">
              <p className="text-xs uppercase tracking-widest text-sky-400">External context used in this report</p>
              <p className="text-sm text-slate-300 leading-relaxed">{extContext}</p>
            </div>
          )}

          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-slate-100 prose-headings:font-semibold
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-p:text-slate-300 prose-li:text-slate-300
              prose-strong:text-slate-200
              prose-code:text-indigo-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded
              prose-table:text-sm prose-th:text-slate-400 prose-td:text-slate-300
              prose-hr:border-slate-700"
            dangerouslySetInnerHTML={{ __html: atlas.html }}
          />
        </div>
        );
      })}
    </div>
  );
}
