# Changelog

## 2026-03-07 — Security, Mind Page, Agent Acceleration

### Security Hardening (pre-public)
- **User registration system**: replaced shared passphrase with per-user accounts (email + bcrypt password, SQLite DB)
- **Helmet security headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **CORS lock**: restricted to serving origin
- **Path traversal audit**: all file-serving routes verified safe
- **Request size limits**: 100kb on JSON/form payloads
- **Caddy reverse proxy**: configured (pending firewall for HTTPS)
- **DuckDNS domain**: `openclaw-nka.duckdns.org` registered

See SECURITY.md for full details.

### Mind Page — Live Agent Streaming
- New `/mind` page showing real-time LLM output from all three agents
- Three-column layout (SENTINEL/ORACLE/ARCHITECT) with color-coded output
- SSE endpoint (`/api/agent-stream`) tailing `raw-stream.jsonl`
- Content-based agent detection (identity patterns in accumulated text)
- Connection indicator, timestamps, run separators, up to 5 runs per agent
- Memory leak prevention: server caps at 50 tracked runs, client caps at 20

### Agent Acceleration
- SENTINEL: 10m → 5m cycle (lightweight SENTINEL-FAST.md SOP)
- ORACLE: 30m → 15m cycle
- ARCHITECT: 2h → 30m cycle, growth cooldown 80m → 40m
- Event engine: FAST_MODE support (30s ticks vs 60s)

### Agent SOP Fixes
- **SENTINEL-FAST.md**: added missing steps (update-state.sh, update-external-context.js)
- **ARCHITECT.md**: "Remediation is independent of growth — always execute if ORACLE recommends it"
- **ARCHITECT.md**: ORACLE halt directive overrides time-based growth gate
- **HEARTBEAT.md**: explicit "read SENTINEL-FAST.md" directive to prevent confabulation
- **Cron messages**: added "Do NOT read SENTINEL.md" to block training-context confabulation

### Real Tower Overlay
- Downloaded OpenCelliD Ireland dataset (139,285 cell records, MCC 272)
- Deduplicated to 28,398 unique site locations at ~1km clustering
- Blue dot overlay on Map page with toggle ("Real towers ON/OFF")
- Dataset isolated in `/research/` directory (away from agents)

### Landing Page & Use Case
- Wired UseCasePage into routing
- Six Thinking Hats review — cut ~35-40% verbosity from both pages
- Added Mind page to "What to Watch" section
- Fixed: "everything produced by agents" → clarified 50-cell seed exists

### Bug Fixes
- Dashboard `willGrow` always true — fixed elapsed time calculation
- MapPage "cell undefined" — fixed `selected.shortId` → `selected.id?.split('=').pop()`
- Server memory leak — `runIdText` grew unbounded, added eviction at 50 entries
- Client memory leak — MindPage `runs` state capped at 20 via `capRuns()`
- SSE log rotation — reset `lastSize` when file shrinks
- Removed dead `fs.watch` watcher from server
- Removed hardcoded schedule text from AgentsPage

---

## 2026-03-06 — Three-Agent System

### Autonomous Agent Architecture
- Three agents (SENTINEL, ORACLE, ARCHITECT) running on OpenClaw cron
- Each agent: isolated session, reads its own playbook, calls tools, posts to bulletin board
- Shared append-only bulletin board (`agent-comms.jsonl`)
- No orchestration framework — cooperation emerges from reading each other's messages

### SENTINEL
- Reads signals.json, runs update-memory.sh (streak tracking)
- Fetches live weather (Open-Meteo), Met Eireann warnings, Ticketmaster events, TomTom traffic
- Classifies cells: transient → persistent → chronic
- Hands off to ORACLE with structured summary

### ORACLE
- Reads SENTINEL handoffs + external context
- Writes network-atlas.md (situational briefing)
- Recommends specific remediation to ARCHITECT
- Can issue HALT directive to pause growth

### ARCHITECT
- Reads ORACLE advisory + state.json
- Executes remediation scripts (clear-alarm, restart-cell, reroute-backhaul)
- Designs and executes growth waves (2-4 zones per wave)
- Respects storm warnings and ORACLE directives

### Growth System
- 17 growth waves executed, network expanded from 50 to 249+ cells
- Zone selection from Irish county priority list
- rebuild-network.sh integrates new zones into topology
- Growth gated on cooldown timer + ORACLE approval

### Remediation System
- `remediate-cell.js`: clear ghost alarms, restart cells
- `remediate-backhaul.js`: reroute backhaul (cuts fault duration by 75%)
- Audit trail in `remediation-log.jsonl`

---

## 2026-03-05 — Foundation

### Mock EIAP
- 3GPP-compliant O1 endpoints (topology, PM counters, alarms)
- Ireland dataset with realistic site placement
- OAuth2 token endpoint for agent authentication

### Stochastic Fault Engine
- Equipment failures, backhaul outages, interference patterns
- Weather-correlated fault probability (storm warnings increase rates)
- Geographic spreading (backhaul faults affect nearby sites)
- Ghost alarms (1 in 4 equipment faults leave alarm after resolution)

### Web UI
- Dashboard, Map (MapLibre GL), Cell Health, Atlas, Expansion, Agents pages
- Live data from artifact files via Express API
- Session-based authentication

### Data Collection
- `collect.sh` / `nka-collect.timer` — periodic EIAP polling
- Writes topology.json, performance.json, alarms.json
- `signals.json` — lightweight health summary (800 bytes)
