# Changelog

## 2026-03-16 — Autonomy Experiment (Phase 1 + 2)

### Six Hats Assessment
- Formal de Bono analysis rated system at ~15% real autonomy, ~85% engineered
- Agents follow prescriptive step-by-step playbooks; LLM provides synthesis but no goal-directed behaviour
- SENTINEL was a stub (system healthcheck, not network monitoring)
- ARCHITECT followed hardcoded county priority list with no ability to disagree
- 27 failed remediation retries on same cell (Castleconnell-001/NRCellDU-001192) — no self-correction

### Phase 1 — Shared Tool Infrastructure (ported from WorldLens)
- **`agents/shared/tools/check-delta.js`**: delta-gating — skip cycle if nothing changed since last run; per-agent file watchlists, comms mention detection
- **`agents/shared/tools/post-comms.js`**: structured bulletin board with 10 message types (added `hypothesis`, `challenge`, `self-correction`, `meta`, `review_request`, `remediation`)
- **`agents/shared/tools/update-run-state.js`**: per-agent run tracking (acted/skipped/error), consecutive skip streaks, productivity stats
- **`agents/shared/tools/self-assess.js`**: repetition detection (Jaccard similarity on recent posts), stuck remediation loop detection, productivity analysis

### Phase 2 — Goal-Based Playbooks (autonomous experiment, live)
- **SENTINEL-AUTONOMOUS.md**: network observer with discretion — decides what's noteworthy, can post hypotheses and challenges, delta-gated
- **ORACLE-AUTONOMOUS.md**: free-form atlas structure — "you decide the structure, you decide what's important"; can challenge SENTINEL, post hypotheses
- **ARCHITECT-AUTONOMOUS.md**: strategic growth decisions — no hardcoded county priority list, can disagree with ORACLE, self-assess gates stuck remediations
- Original playbooks disabled (A jobs), autonomous playbooks active (B jobs)
- New cron IDs: SENTINEL `cef2fd4d`, ORACLE `42104c61`, ARCHITECT `62036869`

### Research Artefacts
- **`docs/AUTONOMY-ROADMAP.md`**: full 4-phase plan with success criteria, measurement framework, risk mitigation

---

## 2026-03-15 — DGX Spark Migration

### Migration to [hostname]
- Migrated from dedicated VM to coexist with WorldLens on DGX Spark ([internal-ip])
- OpenClaw profile: `ata` (state dir: `~/.openclaw-ata/`, gateway port 18790)
- TLS certs → local `certs/` directory (certbot + DuckDNS hooks)
- LLM: Fireworks → local Ollama (`qwen3.5:122b-a10b`), shared with WorldLens
- Removed `:443` listener (serves HTTPS only on `:9000`)
- Agent workspace paths updated from `/path/to/ata` to [hostname] path

### Systemd Services
- `openclaw-gateway-ata.service` (port 18790)
- `ata-webui.service` (port 9000)
- `ata-mock-eiap.service` (mock 3GPP O1 API)
- `ata-event-engine.service` (stochastic fault generator, FAST_MODE)

### Infrastructure
- fail2ban jail for `/api/login` brute force
- UFW rule for port 9000
- Cert auto-renewal deploy hook
- User accounts migrated (10 users, SQLite WAL checkpoint)

### Bug Fixes
- `log-growth.js` now updates `state.json` (was missing — caused duplicate wave 86)
- Fixed duplicate wave numbering in growth-log.json

### Dashboard
- Added "Next Growth Wave" panel with ETA, progress bar (cells vs target)

### Schedule Acceleration
- SENTINEL: 30m → 15m, ORACLE: 60m → 30m, ARCHITECT: 120m → 40m
- Based on observed run durations (1-12m actual)

---

## 2026-03-13 — LLM Provider Switch & WorldLens Retirement

### Combined Input Reader
- **`agents/nka/scripts/read-cycle-inputs.js`**: single tool call replaces 5-7 individual file reads per agent cycle
- ORACLE: 5 reads → 1 (sentinel handoffs, signals, state, memory, external context)
- ARCHITECT: 3-4 reads → 1 (oracle advisory, state, external context, city params)
- SOPs updated (ORACLE.md, ARCHITECT.md) to use combined reader as Step 1
- Estimated savings: ~40% fewer API requests per cycle, keeps usage under Synthetic Standard tier (135 reqs/5h)
- Agent schedules slowed: SENTINEL 30m, ORACLE 1h, ARCHITECT 2h (from 5m/15m/30m) to stay within Synthetic rate limits
- Restored agent scripts + mock-eiap accidentally removed during WorldLens cleanup commit `ed85cce`
- Rate limit incident: broken config (wrong API format, wrong API key, stale model refs in jobs.json) caused repeated failures on fast schedules; OpenClaw aggressive retries exhausted rate limit. Credits ($8.74) unaffected — failed requests rejected before token processing
- **WebUI health check fix**: LLM status indicator was sending a completion request (`/v1/chat/completions`, 1 token) every 30 seconds — 120 requests/hour, nearly the entire rate limit. Changed to `/v1/models` endpoint (free, no token consumption) and slowed polling to every 5 minutes

### LLM Provider Switch: Fireworks → Synthetic API
- **Provider**: Switched 3 live agents (SENTINEL, ORACLE, ARCHITECT) from Fireworks GPT-OSS-120B to Synthetic API with Llama 3.3 70B Instruct
- **API**: `https://api.synthetic.new/v1`, model `hf:meta-llama/Llama-3.3-70B-Instruct`
- **Pricing**: Subscription-based (vs per-token on Fireworks) — significant cost reduction
- **Config**: `auth-profiles.json`, `models.json` (provider `synthetic-llama`, api `openai-completions`), `openclaw.json`, `cron/jobs.json`
- **WebUI**: LLM status check updated to hit Synthetic endpoint
- **Docs**: Added `docs/llm-model-switching-instructions.md` for future provider switches

### WorldLens Retired from This VM
- Stopped and disabled `worldlens-webui` (port 9001) and `openclaw-gateway-worldlens` (port 18790)
- Removed 3 system cron entries (run-cycle, ingest, agent-doctor)
- WorldLens migrating to DGX Spark VM

### GitHub Repos Pushed
- **NKA**: `your-org/your-private-repo` (private)
- **WorldLens**: private repo, artifacts/ committed for migration

---

## 2026-03-12 — WebUI Systemd Services

- **Systemd user services**: NKA and WorldLens web UIs now run as `nka-webui.service` and `worldlens-webui.service` — auto-restarting, no manual process management
- **OpenClaw two-profile setup**: NKA (default, port 18789) and WorldLens (`--profile worldlens`, port 18790) run on separate gateways with separate state dirs

---

## 2026-03-11 — Growth Logging & Dashboard Fix

- **Growth log tool** (`agents/nka/scripts/log-growth.js`): records every growth wave to `growth-log.json` with zone details, cell count, and timestamp
- **Growth page**: reads from `growth-log.json` (67 recovered historical waves) instead of `agent-comms.jsonl` which only had the latest entry
- **Dashboard chart**: proper time-scale X-axis with daily ticks, limited to last 7 days
- **ARCHITECT SOP**: updated to call `log-growth.js` after each wave

---

## 2026-03-09 — HTTPS & Remediation Fix

- **HTTPS support**: Express serves on both `:9000` and `:443` when Let's Encrypt certs are present
- **CORS**: updated for multi-origin support (with/without port)
- **Request logging**: `webui/data/access.log`
- **Secure cookies**: auto-detected from cert presence
- **ScrollToTop**: React Router scroll position fix on navigation
- **Remediation fix**: cell ID format mismatch — agents pass short IDs ("301") but world state uses "NRCellDU-301", added normalization

---

## 2026-03-07 — Security, Mind Page, Agent Acceleration

### Security Hardening (pre-public)
- **User registration system**: replaced shared passphrase with per-user accounts (email + bcrypt password, SQLite DB)
- **Helmet security headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **CORS lock**: restricted to serving origin
- **Path traversal audit**: all file-serving routes verified safe
- **Request size limits**: 100kb on JSON/form payloads
- **Caddy reverse proxy**: configured (pending firewall for HTTPS)
- **DuckDNS domain**: `your-domain.example.com` registered

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
