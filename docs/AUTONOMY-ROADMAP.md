# Autonomy Roadmap — From Engineered to Genuine Situational Awareness

## Background

The ATA (Autonomous Telco Agents) system runs three AI agents — SENTINEL, ORACLE, ARCHITECT — that monitor, analyse, and expand a simulated Irish 5G network. A de Bono Six Hats assessment rated the system at **~15% real autonomy, ~85% engineered**: agents follow prescriptive step-by-step playbooks with the LLM providing natural-language synthesis and constrained parameter selection, but no goal-directed behaviour, self-correction, or adaptive strategy.

**Research goal**: Move toward genuine autonomous situational awareness — agents that notice, reason, adapt, and disagree rather than execute templates.

### Current State

**What works well (keep)**:
- Tool calling is functional — agents execute scripts and produce real state changes
- ORACLE's trend analysis shows genuine pattern recognition across cycles
- The bulletin board enables information flow between agents
- The proximate-directive pattern (HEARTBEAT → playbook → tools) reliably drives execution

**What limits autonomy**:
- Playbooks prescribe every step, including report structure and decision criteria
- SENTINEL is a stub (system healthcheck, not network monitoring)
- ARCHITECT follows a hardcoded county priority list and never pushes back on ORACLE
- No delta-gating — agents run full cycles even when nothing changed
- No self-assessment — agents can't detect they're stuck in loops (e.g., 27 failed remediations on the same cell)
- Only 4 message types (handoff, atlas, advisory, growth) — no mechanism for hypothesis, challenge, or disagreement

### WorldLens Comparison

The WorldLens project (same machine, same LLM) has a more mature tool architecture:
- **13 shared tools** in `agents/shared/tools/` vs ATA's ad-hoc scripts
- **Delta-gating** (`check-delta.js`) — skip cycle if nothing changed
- **7 message types** including `hypothesis`, `challenge`, `revision`
- **Epistemic actions** — agents can elevate/cool topics and request peer review
- **Run state tracking** — know which cycles were productive
- **Discourse health analysis** — detect stalled topics and echo chambers

---

## Phase 1 — Shared Tool Infrastructure

**Goal**: Port the most valuable WorldLens tools to ATA, giving agents capabilities they currently lack.

**Duration**: Can be implemented in one session.

### 1a. Create `agents/shared/tools/` directory

Mirror the WorldLens pattern. All tools are Node.js CLIs invoked via `exec`.

### 1b. Port `check-delta.js` (delta-gating)

**What it does**: Compares artifact hashes since the agent's last run. Returns `{ changed: true|false, reason, details }`.

**Adaptation for ATA**: Watch `artifacts/signals.json`, `artifacts/alarms.json`, `artifacts/agent-comms.jsonl` (tail). If signals haven't changed since last check, the agent can skip or run a lightweight cycle.

**Value**:
- Stops wasted LLM calls when nothing changed
- Makes the aggressive schedule (15m/30m/40m) sustainable
- First step toward adaptive frequency — agents could eventually request schedule changes

### 1c. Port `post-comms.js` (structured bulletin board)

**What it does**: Appends to `agent-comms.jsonl` with structured fields and validation.

**Adaptation for ATA**: Extend message types from 4 to 8:

| Type | Sender | Purpose |
|------|--------|---------|
| `handoff` | SENTINEL | Raw observations from monitoring cycle |
| `atlas` | ORACLE | Status report written |
| `advisory` | ORACLE | Specific recommendation to ARCHITECT |
| `growth` | ARCHITECT | Growth wave executed |
| `hypothesis` | Any | "I think X is causing Y" — testable claim |
| `challenge` | Any | "I disagree with [agent]'s assessment because..." |
| `self-correction` | Any | "My previous assessment was wrong — here's what I missed" |
| `meta` | Any | Observation about the system's own behaviour |

**Value**: Enables genuine disagreement and reasoning. ARCHITECT can challenge a stale ORACLE advisory. SENTINEL can hypothesise about weather-fault correlation.

### 1d. Port `update-run-state.js` (cycle tracking)

**What it does**: Records per-agent run outcomes: `skipped_no_change`, `acted`, `error`, `timeout`.

**Adaptation for ATA**: Write to `artifacts/run-state.json` with:
```json
{
  "SENTINEL": { "lastRunAt": "...", "result": "acted", "summary": "2 outliers found", "toolCalls": 4 },
  "ORACLE": { "lastRunAt": "...", "result": "skipped_no_change", "summary": "No new signals since last atlas", "toolCalls": 1 },
  "ARCHITECT": { "lastRunAt": "...", "result": "acted", "summary": "Wave 88 — Cork, Kerry", "toolCalls": 7 }
}
```

**Value**: Observable cycle productivity. Dashboard can show "last productive cycle" vs "last cycle". Agents can read this to understand what their peers have been doing.

### 1e. Create `self-assess.js` (new — not in WorldLens)

**What it does**: Reads the agent's last N bulletin board posts and run states. Returns a self-assessment:
- Am I repeating myself? (cosine similarity or exact-match on last 5 posts)
- Am I stuck? (same remediation target attempted N times with no effect)
- Am I adding value? (ratio of `acted` vs `skipped` in last 10 cycles)

**Value**: This is the foundation of genuine self-awareness. An agent that can detect "I've tried to restart Castleconnell-001 twelve times and it never works" can adapt.

---

## Phase 2 — Goal-Based Playbooks

**Goal**: Replace step-by-step SOPs with goal + capabilities, while keeping the proximate-directive pattern that makes tool calling work.

**Duration**: One playbook at a time, with A/B testing against current playbooks.

**Key constraint**: The OPENCLAW-ARCHITECTURE.md finding still applies — agents need explicit proximate directives to invoke tools. The playbooks must name the tools and scripts; they just don't need to prescribe the analysis.

### 2a. SENTINEL-AUTONOMOUS.md

**Current**: 4-step system healthcheck stub (doesn't monitor the network at all).

**Proposed**:
```markdown
# SENTINEL — Network Observer

You are SENTINEL. You are the network's eyes.

## Bootstrap
Run: `node agents/shared/tools/check-delta.js SENTINEL`

If nothing changed since your last run, post a one-line status to the
bulletin board and stop. Don't waste cycles on unchanged data.

If something changed:

## Observe
Run: `node agents/nka/scripts/read-cycle-inputs.js SENTINEL`

This gives you: signals (cell health, outliers, alarms, cross-zone hits),
external context (weather, warnings, events, traffic, zone risks), and
recent agent comms.

## Assess
You decide what matters. Consider:
- Is anything degrading? Recovering? New?
- Do external factors (weather, events) explain what you see?
- Is anything surprising or inconsistent?
- Have you seen this pattern before in recent comms?

## Self-Check
Run: `node agents/shared/tools/self-assess.js SENTINEL`

If you're repeating yourself, say something different or say nothing.

## Report
Post your findings to the bulletin board:
`node agents/shared/tools/post-comms.js '<JSON>'`

Choose your message type:
- "handoff" — routine observations for ORACLE
- "hypothesis" — you think you see a pattern (testable)
- "challenge" — you disagree with a recent ORACLE or ARCHITECT assessment
- "meta" — you notice something about how the system itself is behaving

If nothing noteworthy: post type "handoff" with a one-line status.
If something is wrong: be specific about what, where, and how bad.
If you have a theory: post type "hypothesis" and state what would confirm or refute it.
```

**What changes**: SENTINEL goes from system healthcheck to genuine network observer with discretion over what to report and how to frame it.

### 2b. ORACLE-AUTONOMOUS.md

**Current**: 7-step procedure with prescribed 6-section report structure.

**Proposed**:
```markdown
# ORACLE — Network Analyst

You are ORACLE. You synthesise raw signals into network intelligence.

## Bootstrap
Run: `node agents/shared/tools/check-delta.js ORACLE`

If nothing changed since your last run and SENTINEL hasn't posted
anything new, skip this cycle:
`node agents/shared/tools/update-run-state.js ORACLE '{"result":"skipped_no_change"}'`

If something changed:

## Read
Run: `node agents/nka/scripts/read-cycle-inputs.js ORACLE`

## Analyse
Write a network status report to artifacts/network-atlas.md.

You decide the structure. You decide what's important. The report serves
two audiences:
1. ARCHITECT — who needs to know what to fix and where to grow
2. A human engineer — who needs to understand the network in 60 seconds

What would a senior network analyst write after looking at this data?
Write that. Don't pad with sections that say "nothing to report."

Copy to artifacts/atlas-history/atlas-<YYYY-MM-DD-HHmm>.md

## Advise
If ARCHITECT needs to act (remediate, defer growth, change strategy),
post an advisory. Be specific: cell IDs, site IDs, recommended actions.

If ARCHITECT should NOT act, don't post an advisory. Silence means
"carry on."

If you disagree with SENTINEL's assessment, say so — and explain why.

## Self-Check
Run: `node agents/shared/tools/self-assess.js ORACLE`

Are your reports getting repetitive? Are you recommending the same
remediation that hasn't worked? If so, change your approach or
explicitly flag the stuck pattern.

## Communicate
Post to bulletin board via: `node agents/shared/tools/post-comms.js '<JSON>'`
Update MEMORY.md: last_atlas_at field only.
Log heartbeat to artifacts/heartbeat-log.jsonl.
```

**What changes**: ORACLE chooses its own report structure, can disagree with SENTINEL, and self-checks for repetitive recommendations.

### 2c. ARCHITECT-AUTONOMOUS.md

**Current**: 6-step procedure with hardcoded county priority list, no ability to disagree.

**Proposed**:
```markdown
# ARCHITECT — Network Planner

You are ARCHITECT. You fix what's broken and grow the network.

## Bootstrap
Run: `node agents/shared/tools/check-delta.js ARCHITECT`

If ORACLE hasn't posted a new atlas or advisory since your last run,
and no new growth window has opened, skip:
`node agents/shared/tools/update-run-state.js ARCHITECT '{"result":"skipped_no_change"}'`

## Read
Run: `node agents/nka/scripts/read-cycle-inputs.js ARCHITECT`

## Self-Check
Run: `node agents/shared/tools/self-assess.js ARCHITECT`

Before acting, check: have you attempted the same remediation before
without success? If so, don't repeat it. Post a "meta" observation
about the stuck pattern instead.

## Remediate
If ORACLE recommended remediation, decide whether to act:
- `node agents/nka/scripts/remediate-cell.js <cellId> clear-alarm`
- `node agents/nka/scripts/remediate-cell.js <cellId> restart-cell`
- `node agents/nka/scripts/remediate-backhaul.js <siteId>`

You may disagree with ORACLE. If you think a recommendation is wrong
(fault already resolved, or you've tried it before, or the evidence
doesn't support it), explain your reasoning in a "challenge" post.

## Grow
The network targets 8000 cells (currently check state.json for count).
Look at city-params.json for current coverage. Look at accumulated-zones.json
for what exists.

Decide where to grow. Consider:
- Coverage gaps (which regions have no presence?)
- Zone risks from external context
- ORACLE's advisory (if any)
- Strategic network topology (not just the next county alphabetically)

If it's not the right time to grow, don't grow — post why.

Execute via: bash agents/nka/scripts/rebuild-network.sh +
node agents/nka/scripts/log-growth.js (see state.json for wave count).

CRITICAL: NEVER write to state.json directly — only log-growth.js may update it.

## Report
Post to bulletin board: `node agents/shared/tools/post-comms.js '<JSON>'`
```

**What changes**: ARCHITECT can disagree with ORACLE, skip stale remediations, make strategic growth choices, and explain when it chooses not to act.

---

## Phase 3 — Adaptive Behaviour

**Goal**: Let agents modify their own behaviour based on what they learn.

**Duration**: Experimental — run for 50+ cycles and observe.

### 3a. Self-Modifying MEMORY.md

Currently MEMORY.md is updated with timestamps only. Allow agents to write **observations about patterns** they've noticed:

```markdown
## Agent Observations
- [ORACLE 2026-03-15] Site3-Dublin-West backhaul faults correlate with
  high wind events. 3 of last 4 backhaul alarms occurred when wind > 35 km/h.
- [ARCHITECT 2026-03-16] Castleconnell-001-192 restart has been attempted
  12 times with no effect. Likely not an equipment_fault — may be a
  configuration issue outside remediation scope.
- [SENTINEL 2026-03-16] Ghost alarms on high-diskio appear within 30 min
  of event-engine tick. Suspect these are event-engine artifacts, not real faults.
```

**Value**: Agents build a shared knowledge base that persists across cycles. Future cycles can read these observations and adapt.

### 3b. Inter-Agent Review Requests

Port WorldLens `manage-obligations.js`. Allow agents to explicitly request peer review:

```json
{"from":"ARCHITECT","to":"ORACLE","type":"review_request",
 "message":"I've skipped remediation on Castleconnell-001-192 for 5 cycles.
  Please verify whether this cell is genuinely faulted or if this is a
  persistent ghost alarm."}
```

ORACLE would then specifically investigate and respond, creating a genuine back-and-forth.

### 3c. Anomaly-Driven Scheduling

Currently all agents run on fixed intervals. Add a mechanism where agents can request accelerated or decelerated scheduling:

```json
{"from":"SENTINEL","to":"SYSTEM","type":"meta",
 "message":"Network degradation accelerating — 3 new outliers in last 2 cycles.
  Recommend ORACLE runs immediately rather than waiting for next scheduled cycle."}
```

The webui or a simple watcher script could read these and trigger `openclaw --profile ata cron run <oracle-id>` on demand.

---

## Phase 4 — Measurement

**Goal**: Quantify the autonomy improvement.

### 4a. Decision Diversity Score

Count unique decisions per N cycles:
- How many distinct county selections has ARCHITECT made?
- How many distinct report structures has ORACLE produced?
- How many hypotheses has SENTINEL generated?

Compare current playbooks vs autonomous playbooks over 50 cycles.

### 4b. Self-Correction Rate

Count instances where an agent:
- Changed its assessment from a previous cycle
- Challenged another agent's recommendation
- Identified a stuck pattern and adapted

Current baseline: 0 (no mechanism for any of these).

### 4c. Novelty Detection

Manually review agent outputs for observations that weren't prompted by the playbook:
- Did ORACLE notice a correlation the template wouldn't have surfaced?
- Did SENTINEL flag something outside its prescribed checks?
- Did ARCHITECT make a strategic choice the priority list wouldn't have produced?

### 4d. Operational Effectiveness

Compare against current baseline:
- Mean time to detect a fault (SENTINEL → ORACLE)
- Mean time to remediate (ORACLE advisory → ARCHITECT action)
- False positive rate (remediation attempts on resolved faults)
- Growth efficiency (cells added per LLM call)

---

## Implementation Order

| Step | Phase | What | Depends On |
|------|-------|------|------------|
| 1 | 1b | Port `check-delta.js` | Nothing |
| 2 | 1c | Port `post-comms.js` with extended types | Nothing |
| 3 | 1d | Port `update-run-state.js` | Nothing |
| 4 | 1e | Create `self-assess.js` | 1c, 1d |
| 5 | 2a | Write SENTINEL-AUTONOMOUS.md | 1b, 1c, 1d, 1e |
| 6 | 2b | Write ORACLE-AUTONOMOUS.md | 1b, 1c, 1d, 1e |
| 7 | 2c | Write ARCHITECT-AUTONOMOUS.md | 1b, 1c, 1d, 1e |
| 8 | — | Create A/B cron jobs (disabled) | 5, 6, 7 |
| 9 | — | Run Experiment A: Enable autonomous ORACLE for 20 cycles | 8 |
| 10 | — | Run Experiment B: Enable autonomous SENTINEL for 20 cycles | 8 |
| 11 | — | Run Experiment C: Enable all three autonomous for 50 cycles | 9, 10 |
| 12 | 3a | Self-modifying MEMORY.md | 11 (after validating Phase 2) |
| 13 | 3b | Inter-agent review requests | 11 |
| 14 | 3c | Anomaly-driven scheduling | 11 |
| 15 | 4 | Measurement framework | 11 |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Autonomous playbooks produce garbage with qwen3.5:122b-a10b | A/B test: keep current playbooks as fallback cron jobs |
| Agents stop calling tools without step-by-step instructions | Proximate directives for tool names are retained in all autonomous playbooks |
| Bulletin board floods with low-quality hypotheses | `self-assess.js` gates output; `post-comms.js` validates structure |
| Atlas reports become inconsistent, breaking downstream consumers | ARCHITECT reads full text, not parsed sections; dashboard handles variable structure |
| Agents disagree endlessly without resolution | Review requests have expiry (6-24h, ported from WorldLens) |
| LLM hallucinates tool outputs instead of calling tools | Run state tracking makes this detectable; delta-gating reduces unnecessary cycles |

---

## Success Criteria

The system moves from **~15% real autonomy** toward **~40%+** when:

1. Agents skip cycles when nothing changed (delta-gating works)
2. At least one agent posts a `hypothesis` or `challenge` message per 20 cycles
3. ORACLE produces at least 3 structurally distinct report formats in 50 cycles
4. ARCHITECT declines a remediation at least once with stated reasoning
5. An agent self-corrects ("my previous assessment was wrong") at least once in 50 cycles
6. Mean time to detect + remediate a fault does not increase vs baseline

---

*Document created: 2026-03-15*
*Project: /path/to/ata*
