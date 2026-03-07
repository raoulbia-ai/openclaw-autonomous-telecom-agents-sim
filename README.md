# Autonomous Telecom Agents

Three AI agents autonomously monitor, analyse, and expand a simulated Irish 5G network. No human prompts them. They share a bulletin board and figure things out from the data.

**Research question:** Can AI agents develop genuine situational awareness of a live network — given the tools and context a human operator would have?

## How It Works

A stochastic event engine generates realistic network faults — equipment failures, backhaul outages, interference, maintenance windows. Fault rates are correlated with live weather data (Met Eireann storm warnings). Backhaul faults spread interference to nearby sites. Ghost alarms linger after faults resolve.

Three agents run on independent cron schedules via [OpenClaw](https://github.com/anthropics/claude-code):

| Agent | Role | Cycle |
|-------|------|-------|
| **SENTINEL** | Monitors every cell every cycle. Tracks streaks (transient → persistent → chronic). Fetches live weather, events, traffic. | 5 min |
| **ORACLE** | Reads SENTINEL's handoffs, cross-references external context, writes a situational briefing, recommends remediation. | 15 min |
| **ARCHITECT** | Executes remediation first (clear alarms, reroute backhaul, restart cells), then considers network expansion. | 30 min |

The remediation actions are fixed. The decisions — which action, which cell, and why — are autonomous.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  SENTINEL   │────>│   Bulletin   │<────│   ORACLE    │
│  (monitor)  │     │    Board     │     │  (analyse)  │
└─────────────┘     │  (JSONL)     │     └─────────────┘
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  ARCHITECT   │
                    │ (fix + grow) │
                    └──────────────┘

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
- [OpenClaw](https://github.com/anthropics/claude-code) CLI
- An OpenAI-compatible LLM endpoint (llama.cpp, Ollama, etc.)

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
# See agent playbooks: SENTINEL-FAST.md, ORACLE.md, ARCHITECT.md
```

### Evaluate

After 24–48h of running, audit agent decisions against ground truth:

```bash
node agents/nka/scripts/audit-decisions.js
```

## Project Structure

```
├── mock-eiap/              # Simulated 3GPP network
│   ├── server.js           # O1 API endpoints
│   ├── world/
│   │   ├── event-engine.js # Stochastic fault generator
│   │   └── config.js       # Fault probabilities, durations
│   └── data/               # Ireland network topology
├── agents/nka/scripts/     # Agent tooling
│   ├── update-memory.sh    # Streak tracker
│   ├── remediate-cell.js   # Clear alarm / restart cell
│   ├── remediate-backhaul.js # Reroute backhaul
│   ├── audit-decisions.js  # Decision audit tool
│   └── ...
├── webui/                  # Dashboard
│   ├── server.js           # Express backend + SSE
│   ├── db.js               # User auth (SQLite)
│   └── client/             # React frontend
├── artifacts/              # Runtime data (gitignored)
├── SENTINEL-FAST.md        # SENTINEL playbook
├── ORACLE.md               # ORACLE playbook
├── ARCHITECT.md            # ARCHITECT playbook
├── CHANGELOG.md            # Project history
└── SECURITY.md             # Security hardening notes
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

AI agents need two things: a **prescribed operational loop** (a playbook that drives tool execution) and **genuine reasoning autonomy** within that loop. Without the playbook, agents narrate perfectly but don't act. With the playbook but no autonomy, you get a script, not an analyst.

## License

MIT
