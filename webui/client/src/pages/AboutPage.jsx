import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';

export default function AboutPage() {
  const [extCtx, setExtCtx] = useState(null);
  useEffect(() => {
    get('/api/external-context').then(setExtCtx).catch(() => null);
  }, []);

  const zoneRisks  = extCtx?.zoneRisks ?? {};
  const riskyZones = Object.entries(zoneRisks).filter(([, r]) => r !== 'none');

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-4">

      {/* Research question */}
      <div>
        <p className="text-xs uppercase tracking-widest text-indigo-400 mb-2">Autonomous Telecom Agents — Proof of Concept</p>
        <h1 className="text-3xl font-bold text-slate-100 leading-tight">
          Can AI agents develop genuine situational awareness of a live network — given the tools and context a human operator would have?
        </h1>
        <p className="mt-4 text-slate-400 text-base leading-relaxed">
          Three autonomous agents watch a live simulated 5G network across Ireland. They get what any
          new analyst gets on day one — telemetry, weather feeds, a playbook, a shared bulletin board —
          and nothing more. No human prompts them. Beyond a 50-cell seed network, everything in this UI was produced by the agents themselves.
        </p>
      </div>

      {/* OpenClaw */}
      <section className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-5 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-indigo-400">Powered by OpenClaw</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          OpenClaw is an open-source CLI for running AI agents. Each agent here runs on a cron schedule
          in a fully isolated session — no orchestration framework. Wake up, read the playbook, call tools,
          go back to sleep. The playbook tells them where to look. The intelligence is in what they think
          about what they see.
        </p>
      </section>

      {/* What's happening */}
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">What's Happening</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          A stochastic event engine runs continuously in the background, simulating the unpredictability
          of a real network. Every 30 seconds it rolls dice per cell — probabilistically spawning equipment
          failures, backhaul outages, interference patterns, and maintenance windows. The probabilities are
          tuned by zone type (urban cells fail differently to rural) and by real-world conditions: live
          Met Eireann storm warnings increase fault rates in affected counties.
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          The engine also models realistic complications. 1 in 4 equipment faults leave a ghost alarm
          behind — the fault clears, the alarm doesn't. Backhaul faults spread interference to neighbouring
          sites. These correlations are baked into the simulation but never disclosed to the agents — they
          have to figure them out from the data, just as a human operator would.
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          SENTINEL watches the network every cycle, tracking each cell across time — flagged once is
          transient, flagged four times is chronic. ORACLE reads those handoffs, cross-references
          weather and events, and writes a situational briefing. When something is wrong it recommends
          specific remediation. ARCHITECT acts on that advice — stabilise first, expand second.
          The remediation actions are fixed (clear alarm, restart cell, reroute backhaul) but the
          decisions are autonomous — which action, which cell, and why.
        </p>
      </section>

      {/* Links */}
      <div className="flex justify-center gap-4">
        <Link to="/use-case" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-800/50 rounded-lg px-5 py-2.5 bg-indigo-950/20 hover:bg-indigo-950/40">
          Real-world use case &rarr;
        </Link>
        <Link to="/mind" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors border border-emerald-800/50 rounded-lg px-5 py-2.5 bg-emerald-950/20 hover:bg-emerald-950/40">
          Watch agents think live &rarr;
        </Link>
      </div>

      {/* Live zone risks */}
      {riskyZones.length > 0 && (
        <section className="rounded-xl border border-amber-800/40 bg-amber-950/10 p-5 space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-amber-400">Active Zone Risks</h2>
          <div className="flex flex-wrap gap-2">
            {riskyZones.map(([county, risk]) => (
              <span key={county} className="text-xs px-2.5 py-1 rounded border border-amber-700 bg-amber-900/30 text-amber-300 font-medium">
                {county} — {risk.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* The agents */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">The Agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              name: 'SENTINEL',
              colour: 'border-cyan-700 bg-cyan-950/20',
              badge: 'text-cyan-400',
              tagline: 'Always watching.',
              desc: 'Reads every cell every cycle. Fetches live weather, events, traffic. Classifies anomalies by context — crowd-driven load vs hardware fault. Tracks streaks across cycles.',
            },
            {
              name: 'ORACLE',
              colour: 'border-violet-700 bg-violet-950/20',
              badge: 'text-violet-400',
              tagline: 'Sees the pattern.',
              desc: 'Reads SENTINEL\'s handoffs and the external context. Writes a situational briefing. Recommends specific remediation — clear a ghost alarm, reroute a backhaul, restart a chronic cell.',
            },
            {
              name: 'ARCHITECT',
              colour: 'border-amber-700 bg-amber-950/20',
              badge: 'text-amber-400',
              tagline: 'Fixes, then builds.',
              desc: 'Acts on ORACLE\'s recommendations first — clears alarms, reroutes faults. Then considers expansion. Skips storm-warned counties. Reports every action and its reasoning.',
            },
          ].map(({ name, colour, badge, tagline, desc }) => (
            <div key={name} className={`rounded-lg border p-4 space-y-2 ${colour}`}>
              <p className={`text-sm font-bold tracking-wide ${badge}`}>{name}</p>
              <p className="text-xs text-slate-400 italic leading-snug">{tagline}</p>
              <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-2">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">
          Agents share an append-only bulletin board — no direct calls. The cooperation emerges from reading each other's messages.
        </p>
      </section>

      {/* What to watch */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">What to Watch</h2>
        <div className="space-y-3">
          {[
            {
              page: 'Mind',
              colour: 'border-emerald-700 bg-emerald-950/20',
              text: 'Live streaming LLM output from each agent as it thinks. Watch SENTINEL read telemetry, ORACLE reason about patterns, ARCHITECT decide what to fix.',
            },
            {
              page: 'Agents',
              colour: 'border-indigo-700 bg-indigo-950/20',
              text: 'The bulletin board — every handoff, advisory, and action report in chronological order.',
            },
            {
              page: 'Dashboard',
              colour: 'border-slate-700 bg-slate-900/40',
              text: 'Current situation at a glance. ORACLE\'s latest summary, live stats, external intelligence, remediation actions.',
            },
            {
              page: 'Map',
              colour: 'border-slate-700 bg-slate-900/40',
              text: 'The network as it grows. Toggle "Real towers" to compare our 59 simulated sites against Ireland\'s 28,000+ real cell sites.',
            },
            {
              page: 'Status',
              colour: 'border-violet-800/50 bg-violet-950/10',
              text: 'ORACLE\'s full network briefing. Compare consecutive reports to see how language changes as a fault escalates.',
            },
            {
              page: 'Expansion',
              colour: 'border-amber-800/50 bg-amber-950/10',
              text: 'ARCHITECT\'s growth record — which zones were added, which were skipped, and why.',
            },
          ].map(({ page, colour, text }) => (
            <div key={page} className={`rounded-lg border p-3 flex gap-3 items-start ${colour}`}>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex-none w-20">{page}</span>
              <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">Stack</h2>
        <div className="flex flex-wrap gap-2">
          {[
            'OpenClaw (cron + isolated sessions)',
            'minimax-m2.5 via llama.cpp',
            'Mock EIAP — 3GPP O1 endpoints',
            'Stochastic fault engine (weather + geographic spreading)',
            'Open-Meteo · Met Éireann · Ticketmaster · TomTom',
            'Node.js / Express · React · MapLibre GL',
          ].map(t => (
            <span key={t} className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-slate-400">{t}</span>
          ))}
        </div>
      </section>

    </div>
  );
}
