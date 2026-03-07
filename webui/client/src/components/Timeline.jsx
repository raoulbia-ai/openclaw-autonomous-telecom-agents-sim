/**
 * Timeline — 24h memory history strip.
 * Renders a horizontal dot/bar chart from memory-history.json snapshots.
 * Uses inline SVG only — no external chart library required.
 */

import { useRef, useState } from 'react';

const BAR_W   = 6;
const BAR_GAP = 2;
const H       = 48;
const PAD_TOP = 4;

// colour for each classification bucket
const COLOURS = {
  chronic:    '#f87171',  // red-400
  persistent: '#fb923c',  // orange-400
  transient:  '#facc15',  // yellow-400
};

export default function Timeline({ history }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  if (!history || history.length === 0) return null;

  // Max total across all snapshots (for scaling)
  const maxTotal = Math.max(1, ...history.map(s =>
    (s.chronic || 0) + (s.persistent || 0) + (s.transient || 0)
  ));

  const totalW = history.length * (BAR_W + BAR_GAP);

  function barSegments(snap, x) {
    const total = (snap.chronic || 0) + (snap.persistent || 0) + (snap.transient || 0);
    if (total === 0) return null;

    const segments = [];
    let y = H;
    for (const key of ['transient', 'persistent', 'chronic']) {
      const count = snap[key] || 0;
      if (count === 0) continue;
      const h = Math.max(2, Math.round(((count / maxTotal) * (H - PAD_TOP))));
      y -= h;
      segments.push(<rect key={key} x={x} y={y} width={BAR_W} height={h} fill={COLOURS[key]} rx="1" />);
    }
    return segments;
  }

  function handleMouseMove(e, snap, idx) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      snap,
      x: idx * (BAR_W + BAR_GAP) + BAR_W / 2,
      clientX: e.clientX - rect.left,
      clientY: e.clientY - rect.top,
    });
  }

  // X-axis ticks: every ~24 bars (~2h if 5-min cycle)
  const tickEvery = Math.max(1, Math.floor(history.length / 6));
  const ticks = history
    .map((s, i) => i % tickEvery === 0 ? { i, label: new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : null)
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">12h Cell History</p>

      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          width={Math.max(totalW, 300)}
          height={H + 20}
          onMouseLeave={() => setTooltip(null)}
          className="block"
        >
          {/* bars */}
          {history.map((snap, i) => (
            <g key={i}
              onMouseMove={e => handleMouseMove(e, snap, i)}
              style={{ cursor: 'crosshair' }}
            >
              <rect x={i * (BAR_W + BAR_GAP)} y={0} width={BAR_W} height={H} fill="transparent" />
              {barSegments(snap, i * (BAR_W + BAR_GAP))}
            </g>
          ))}

          {/* x-axis ticks */}
          {ticks.map(({ i, label }) => (
            <text
              key={i}
              x={i * (BAR_W + BAR_GAP) + BAR_W / 2}
              y={H + 14}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
            >
              {label}
            </text>
          ))}

          {/* tooltip */}
          {tooltip && (() => {
            const s = tooltip.snap;
            const lines = [
              new Date(s.at).toLocaleString(),
              `chronic ${s.chronic || 0}  persistent ${s.persistent || 0}  transient ${s.transient || 0}`,
              s.resolved ? `resolved ${s.resolved}` : null,
            ].filter(Boolean);
            const tw = 180;
            const th = lines.length * 14 + 8;
            let tx = tooltip.x + 8;
            if (tx + tw > totalW) tx = tooltip.x - tw - 4;
            return (
              <g>
                <rect x={tx} y={2} width={tw} height={th} rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                {lines.map((l, i) => (
                  <text key={i} x={tx + 6} y={14 + i * 14} fontSize="9" fill="#cbd5e1">{l}</text>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* legend */}
      <div className="flex gap-4 mt-2">
        {Object.entries(COLOURS).map(([key, colour]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: colour }} />
            <span className="text-xs text-slate-500 capitalize">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
