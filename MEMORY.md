| last_atlas_at | 2026-03-07T22:26:38Z| |# NKA Memory — Network Knowledge Agent
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |Last updated: 2026-03-07T17:30Z
| last_atlas_at | 2026-03-07T22:26:38Z| |Cycle 120
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Network State
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |- **total_cells**: 249
| last_atlas_at | 2026-03-07T22:26:38Z| |- **outlier_count**: 18
| last_atlas_at | 2026-03-07T22:26:38Z| |- **elevated_count**: 18
| last_atlas_at | 2026-03-07T22:26:38Z| |- **alarm_count**: 17
| last_atlas_at | 2026-03-07T22:26:38Z| |- **cross_zone_count**: 17
| last_atlas_at | 2026-03-07T22:26:38Z| |- **last_heartbeat_at**: 2026-03-07T17:30:00Z
| last_atlas_at | 2026-03-07T22:26:38Z| |- **last_atlas_at**: 2026-03-07T17:20:00Z
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| || Cell ID | Issue | Streak |
| last_atlas_at | 2026-03-07T22:26:38Z| ||---------|-------|--------|
| last_atlas_at | 2026-03-07T22:26:38Z| || Dublin-City-Centre-005 cells 21-25 | Backhaul fault — site-level | 2 |
| last_atlas_at | 2026-03-07T22:26:38Z| || Dublin-City-Centre-002 cells 6-10 | Backhaul fault — site-level | 2 |
| last_atlas_at | 2026-03-07T22:26:38Z| || Cavan-Town-001 cell 63 | Persistent — DL throughput degraded | 4 |
| last_atlas_at | 2026-03-07T22:26:38Z| || Bundoran-001 cells 195-197 | Backhaul fault — site-level | 1 |
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |- **growth_wave_count**: 15
| last_atlas_at | 2026-03-07T22:26:38Z| |- **last_growth_at**: 2026-03-07T15:31:00Z
| last_atlas_at | 2026-03-07T22:26:38Z| |- **growth_target**: 8000
| last_atlas_at | 2026-03-07T22:26:38Z| |- **next_growth_possible**: When total_cells < 8000 AND >40 min since last_growth_at
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Workspace
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |Root: /home/openclaw/projects/nka-poc
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |NKA is a live Irish 5G network simulation. A stochastic fault engine runs continuously, spawning equipment failures, interference patterns, backhaul outages, and maintenance windows. Three autonomous agents — SENTINEL, ORACLE, ARCHITECT — monitor, analyse, and expand the network. They share a bulletin board and have no other communication channel.
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Artefacts
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |All files are in artifacts/ unless noted.
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| || File | Description | Notes |
| last_atlas_at | 2026-03-07T22:26:38Z| ||------|-------------|-------|
| last_atlas_at | 2026-03-07T22:26:38Z| || signals.json | Current network health summary — cell counts, outliers, alarms, cross-zone hits | Small, safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || alarms.json | Active alarms with severity, cell ID, problem description | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || external-context.json | Weather (Open-Meteo + Met Éireann), events (Ticketmaster), traffic (TomTom), derived county zone risks | Updated each SENTINEL cycle |
| last_atlas_at | 2026-03-07T22:26:38Z| || agent-comms.jsonl | Shared bulletin board — append-only, one JSON object per line | See schema below |
| last_atlas_at | 2026-03-07T22:26:38Z| || heartbeat-log.jsonl | Per-cycle log from all agents | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || network-atlas.md | ORACLE's latest network status report | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || state.json | Coordination state: growth_wave_count, last_growth_at, atlas_cycle_count | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || city-params.json | Zone definitions used to build the network — sites, counties, cell counts, coordinates | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || accumulated-zones.json | All zones added across all growth waves | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| || memory.json | Cell streak data | 819KB — do not read directly |
| last_atlas_at | 2026-03-07T22:26:38Z| || performance.json | Raw PM counter data | 1.9MB single line — do not read |
| last_atlas_at | 2026-03-07T22:26:38Z| || topology.json | Full network topology | 2.5MB — do not read |
| last_atlas_at | 2026-03-07T22:26:38Z| || remediation-log.jsonl | Audit trail of all remediation actions taken by ARCHITECT | Safe to read |
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Scripts
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |All scripts are in agents/nka/scripts/
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| || Script | What it does |
| last_atlas_at | 2026-03-07T22:26:38Z| ||---------|-------------|
| last_atlas_at | 2026-03-07T22:26:38Z| || update-memory.sh | Reads current PM/alarm data, updates memory.json streaks, prints cycleCount and any chronic cells |
| last_atlas_at | 2026-03-07T22:26:38Z| || update-state.sh | Derives state.json from agent-comms.jsonl — growth wave count, atlas cycle count, timestamps |
| last_atlas_at | 2026-03-07T22:26:38Z| || update-external-context.js | Fetches weather, events, traffic; derives county zone risks; writes external-context.json |
| last_atlas_at | 2026-03-07T22:26:38Z| || watchdog.sh | Checks EIAP health; restarts with Ireland dataset if cell count drops below minimum |
| last_atlas_at | 2026-03-07T22:26:38Z| || rebuild-network.sh | Rebuilds network topology from city-params.json after a growth wave |
| last_atlas_at | 2026-03-07T22:26:38Z| || remediate-cell.js | Remediate a single cell: `node remediate-cell.js <cellId> clear-alarm` (ghost alarms) or `restart-cell` (force-resolve equipment fault) |
| last_atlas_at | 2026-03-07T22:26:38Z| || remediate-backhaul.js | Reroute backhaul: `node remediate-backhaul.js <siteId>` — cuts remaining fault duration by 75%. One-shot per event. |
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Role Playbooks
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |Each agent has a playbook that defines how to run its cycle. Read yours before acting.
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| || Agent | File | What it covers |
| last_atlas_at | 2026-03-07T22:26:38Z| ||-------|------|----------------|
| last_atlas_at | 2026-03-07T22:26:38Z| || SENTINEL | SENTINEL-FAST.md | What to observe, what to run, what to report each cycle |
| last_atlas_at | 2026-03-07T22:26:38Z| || ORACLE | ORACLE.md | How to analyse the network, write the atlas, advise ARCHITECT |
| last_atlas_at | 2026-03-07T22:26:38Z| || ARCHITECT | ARCHITECT.md | How to evaluate growth readiness and trigger expansion |
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Bulletin Board Schema
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |File: artifacts/agent-comms.jsonl
| last_atlas_at | 2026-03-07T22:26:38Z| |Rules: append only — never overwrite or truncate. One JSON object per line.
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |Fields present in entries: `{"at":"<ISO>","from":"<agent>","to":"<agent>","type":"<type>","message":"<msg>","cycle":<num>,"cells":<num>,"outliers":<num>,"alarms":<num>,"crossZone":<num>}`.
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |Read existing entries to understand the convention before writing. The most recent entries are at the end of the file.
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |---
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |## Recent History
| last_atlas_at | 2026-03-07T22:26:38Z| |
| last_atlas_at | 2026-03-07T22:26:38Z| |- Cycle 120: 6 cross-zone hits — Dublin-City-Centre-005 (cells 21-25) and Dublin-City-Centre-002 (cells 6-10) with site-level backhaul fault (CRITICAL), Cavan-Town-001 cell 63 persistent degradation (MAJOR, streak 3). No external drivers.
| last_atlas_at | 2026-03-07T22:26:38Z| |- Cycle 117: Cell 63 flagged — transient, streak 1.
| last_atlas_at | 2026-03-07T22:26:38Z| |- Cycle 115: Network quiet — 249 cells, 0 outliers, 0 alarms.
| last_atlas_at | 2026-03-07T22:26:38Z| |- Cycle 84: Tralee-001 cell-121 chronic — DL throughput degraded, MAJOR alarm, streak 4. No external drivers.
| last_atlas_at | 2026-03-07T22:26:38Z| |- Cycle 81: 6 cross-zone cells — Dublin-City-Centre-008 cell-40 (chronic streak 7, MAJOR), Clonmel-001 cells 113-116 (CRITICAL backhaul), Tralee-001 cell-121 (MAJOR).
| last_atlas_at | 2026-03-07T22:26:38Z| |- Cycle 77: Cell 40 flagged — DL 2.2 Mbps, error rate 14.84%, availability 91.2%, MAJOR alarm, streak 3.
