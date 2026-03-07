import { Link } from 'react-router-dom';

export default function UseCasePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 py-4">

      <div>
        <p className="text-xs uppercase tracking-widest text-indigo-400 mb-2">Real-World Application</p>
        <h1 className="text-3xl font-bold text-slate-100 leading-tight">
          Autonomous NOC Operations
        </h1>
        <p className="mt-4 text-slate-400 text-base leading-relaxed">
          Network Operations Centres run 24/7 with teams triaging alarms and making judgment calls
          under time pressure. Most of the work is pattern recognition — the same patterns, shift after
          shift, with occasional real emergencies buried in noise. ATA demonstrates that AI agents can
          do this continuously, without fatigue, with more context than any single operator holds in
          their head.
        </p>
      </div>

      {/* Today vs ATA */}
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">Today vs ATA</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ['Alarms fire, humans triage manually', 'Continuous automated triage — transient vs persistent vs chronic'],
            ['Weather correlation is tribal knowledge', 'Real-time weather cross-referenced with faults every cycle, every county'],
            ['Ghost alarms pile up, cleared in bulk', 'Identified and cleared as they appear — alarm active but PM normal = stale'],
            ['Geographic patterns noticed by senior engineers', 'Backhaul fault + nearby interference = automatic root cause detection'],
            ['Growth planning disconnected from fault management', 'Expansion informed by live health, faults, weather, and crowd events'],
            ['Shift handovers lose context', 'Persistent memory — every observation and action available to the next cycle'],
          ].map(([today, nka], i) => (
            <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-xs font-bold flex-none mt-0.5">TODAY</span>
                <p className="text-sm text-slate-500 leading-relaxed">{today}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-xs font-bold flex-none mt-0.5">ATA</span>
                <p className="text-sm text-slate-300 leading-relaxed">{nka}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reasoning challenges */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">Reasoning Challenges</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          The fault engine creates situations requiring genuine diagnostic judgment — not just alarm forwarding.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              title: 'Ghost alarms',
              text: 'Fault resolves, alarm stays. PM counters are normal. Clear it or wait?',
              colour: 'border-slate-700',
            },
            {
              title: 'Weather correlation',
              text: 'Storm in Kerry, three Tralee cells degraded. Weather-driven or hardware?',
              colour: 'border-yellow-800/40',
            },
            {
              title: 'Geographic spreading',
              text: 'Backhaul fault on one site, interference on two neighbours. Independent or root cause?',
              colour: 'border-orange-800/40',
            },
            {
              title: 'Event-driven demand',
              text: 'Concert tonight, Dublin cells elevated. Fault or crowd? Expand or wait?',
              colour: 'border-amber-800/40',
            },
          ].map(({ title, text, colour }) => (
            <div key={title} className={`rounded-lg border ${colour} bg-slate-900/40 p-4 space-y-1`}>
              <p className="text-sm font-medium text-slate-200">{title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key insight */}
      <section className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-6 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-indigo-400">The Key Insight</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          AI agents need two things: a <strong className="text-slate-100">prescribed operational loop</strong> (a
          playbook that drives execution) and <strong className="text-slate-100">genuine reasoning autonomy</strong> within
          that loop. Without the playbook, agents narrate perfectly but don't act. With the playbook but
          no autonomy, you get a script, not an analyst. The combination is what works.
        </p>
        <p className="text-sm text-slate-300 leading-relaxed">
          This is a <strong className="text-slate-100">feature for enterprise deployment</strong>. Regulated
          industries need auditability. A prescribed loop with autonomous reasoning gives you both: the
          compliance of a procedure and the intelligence of an analyst.
        </p>
      </section>

      {/* Production gap */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">From Demo to Production</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Scale', 'ATA monitors 249 cells. A real operator has 10,000+. The three-agent pattern is cell-count independent.'],
            ['Data', 'Simulated 3GPP O1 endpoints. Production reads real ones — same PM counters, same alarm schema.'],
            ['Trust', 'Start human-in-the-loop: agent recommends, human approves. The advisory/action split already supports this.'],
            ['LLM', 'Runs on minimax-m2.5 via llama.cpp. Architecture is model-agnostic — swap the model, keep the playbooks.'],
          ].map(([label, text]) => (
            <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-1">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">{label}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-center">
        <Link to="/about" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          &larr; Back to overview
        </Link>
      </div>

    </div>
  );
}
