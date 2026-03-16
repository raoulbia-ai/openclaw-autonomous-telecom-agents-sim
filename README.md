# Autonomous Telecom Agents

Three AI agents autonomously monitor, analyse, and expand a simulated Irish 5G network. No human prompts them. They share a bulletin board and figure things out from the data.

**Research question:** Can AI agents develop genuine situational awareness of a live network — given the tools and context a human operator would have?

## Current Experiment: Autonomy Phase 2

We assessed the system using de Bono's Six Thinking Hats and rated it at **~15% real autonomy, ~85% engineered** — agents were following prescriptive step-by-step playbooks rather than making genuine decisions. We're now running an experiment to change that.

**Phase 1 — Shared Tools** (complete):
- **Delta-gating** (`check-delta.js`): agents skip cycles when nothing has changed, saving LLM calls
- **Self-assessment** (`self-assess.js`): agents detect when they're repeating themselves or stuck in remediation loops
- **Structured comms** (`post-comms.js`): 10 message types including `hypothesis`, `challenge`, `self-correction`, and `meta`
- **Run tracking** (`update-run-state.js`): per-agent productivity stats (acted vs skipped)

**Phase 2 — Goal-Based Playbooks** (live):
- Replaced step-by-step SOPs with goal + capabilities
- SENTINEL decides what's noteworthy (was: system healthcheck stub)
- ORACLE chooses its own report structure (was: 6 prescribed sections)
- ARCHITECT can disagree with ORACLE and skip stale remediations (was: blindly follow recommendations)

See [`docs/AUTONOMY-ROADMAP.md`](docs/AUTONOMY-ROADMAP.md) for the full plan and success criteria.

## How It Works

A stochastic event engine generates realistic network faults — equipment failures, backhaul outages, interference, maintenance windows. Fault rates are correlated with live weather data (Met Eireann storm warnings). Backhaul faults spread interference to nearby sites. Ghost alarms linger after faults resolve.

Three agents run on independent cron schedules via OpenClaw (an agent runtime):

| Agent | Role | Cycle |
|-------|------|-------|
| **SENTINEL** | Observes the network. Decides what's noteworthy — degradation, patterns, surprises. Can post hypotheses and challenges. | 15 min |
| **ORACLE** | Synthesises SENTINEL's observations with external context. Writes situational briefings. Recommends remediation. | 30 min |
| **ARCHITECT** | Remediates faults (or declines with reasoning), then considers network expansion. Chooses counties strategically. | 40 min |

All three agents use delta-gating: if nothing has changed since their last run, they skip the cycle. Self-assessment catches stuck loops (e.g., retrying the same failed remediation 13 times).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  SENTINEL   │────>│   Bulletin   │<────│   ORACLE    │
│  (observe)  │     │    Board     │     │  (analyse)  │
└─────────────┘     │  (JSONL)     │     └─────────────┘
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  ARCHITECT   │
                    │ (fix + grow) │
                    └──────────────┘

┌──────────────────────────────────────────┐
│  Shared Tools                            │
│  check-delta · self-assess · post-comms  │
│  update-run-state · autonomy-monitor     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Event Engine (30s ticks)                │
│  Equipment faults · Backhaul outages     │
│  Interference · Ghost alarms · Weather   │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Mock EIAP (3GPP O1 API)                 │
│  Topology · PM Counters · Alarms         │
└──────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- OpenClaw — agent runtime that manages cron scheduling, session isolation, and tool permissions
- An OpenAI-compatible LLM endpoint (Ollama, llama.cpp, etc.)

### Setup

```bash
# Install dependencies
cd mock-eiap && npm install && cd ..
cd webui && npm install && cd client && npm install && npm run build && cd ../..

# Configure
cp webui/.env.example webui/.env
# Edit webui/.env — set SESSION_SECRET and ALLOWED_ORIGIN

# Start the mock network
node mock-eiap/server.js &
FAST_MODE=1 node mock-eiap/world/event-engine.js &

# Start the web UI
node webui/server.js &

# Start the agents (requires OpenClaw configured with an LLM)
# See agent playbooks: SENTINEL-AUTONOMOUS.md, ORACLE-AUTONOMOUS.md, ARCHITECT-AUTONOMOUS.md
# Original (prescriptive) playbooks also available: SENTINEL-FAST.md, ORACLE.md, ARCHITECT.md
```

### Monitor the Experiment

```bash
# Check autonomy experiment status
node agents/nka/scripts/autonomy-monitor.js

# Audit agent decisions against ground truth
node agents/nka/scripts/audit-decisions.js
```

## Project Structure

```
├── mock-eiap/                 # Simulated 3GPP network
│   ├── server.js              # O1 API endpoints
│   ├── world/
│   │   ├── event-engine.js    # Stochastic fault generator
│   │   └── config.js          # Fault probabilities, durations
│   └── data-ireland.js        # Ireland network topology (170 sites, 646 cells)
├── agents/
│   ├── nka/scripts/           # Agent tooling
│   │   ├── read-cycle-inputs.js    # Combined input reader
│   │   ├── log-growth.js           # Growth wave recorder
│   │   ├── remediate-cell.js       # Clear alarm / restart cell
│   │   ├── remediate-backhaul.js   # Reroute backhaul
│   │   ├── autonomy-monitor.js     # Experiment dashboard
│   │   └── audit-decisions.js      # Decision audit tool
│   └── shared/tools/          # Shared autonomy tools
│       ├── check-delta.js     # Delta-gating (skip if nothing changed)
│       ├── post-comms.js      # Structured bulletin board posting
│       ├── self-assess.js     # Repetition + stuck loop detection
│       └── update-run-state.js # Per-agent run tracking
├── webui/                     # Dashboard
│   ├── server.js              # Express backend + SSE
│   ├── db.js                  # User auth (SQLite)
│   └── client/                # React frontend
├── docs/
│   └── AUTONOMY-ROADMAP.md    # Full experiment plan
├── SENTINEL-AUTONOMOUS.md     # Autonomous SENTINEL playbook
├── ORACLE-AUTONOMOUS.md       # Autonomous ORACLE playbook
├── ARCHITECT-AUTONOMOUS.md    # Autonomous ARCHITECT playbook
├── SENTINEL-FAST.md           # Original SENTINEL playbook
├── ORACLE.md                  # Original ORACLE playbook
├── ARCHITECT.md               # Original ARCHITECT playbook
├── OPENCLAW-ARCHITECTURE.md   # Key findings on LLM agent architecture
├── CHANGELOG.md               # Project history
└── SECURITY.md                # Security hardening notes
```

## External Data Sources

| Source | Data | Used By |
|--------|------|---------|
| [Open-Meteo](https://open-meteo.com/) | Current weather | SENTINEL |
| [Met Eireann](https://www.met.ie/) | Storm warnings | SENTINEL + Event Engine |
| [Ticketmaster](https://developer.ticketmaster.com/) | Live events (optional) | SENTINEL |
| [TomTom](https://developer.tomtom.com/) | Traffic incidents (optional) | SENTINEL |
| [OpenCelliD](https://opencellid.org/) | Real Irish tower locations | Map overlay |

## Key Insight

AI agents need two things: a **prescribed operational loop** (tool names and script paths that drive execution) and **genuine reasoning autonomy** within that loop. Without the operational loop, agents narrate perfectly but don't act ([details](OPENCLAW-ARCHITECTURE.md)). With the loop but no autonomy, you get a script, not an analyst.

The current experiment tests where the boundary is — how much prescription can you remove before the agent stops being useful, and how much autonomy can you add before it stops being reliable?

## License

MIT
