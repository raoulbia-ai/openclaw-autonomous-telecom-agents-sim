#!/usr/bin/env bash
# NKA full reset — wipe state, seed small Dublin network, start from scratch.
# Run from project root: bash agents/nka/scripts/reset.sh

set -euo pipefail
cd "$(dirname "$0")/../../.."
ROOT="$(pwd)"

echo "[reset] Stopping services..."
systemctl --user stop nka-collect.timer nka-collect.service 2>/dev/null || true
pkill -f "node.*server\.js" 2>/dev/null || true

echo "[reset] Clearing artifact state..."
rm -f artifacts/performance.json artifacts/topology.json artifacts/alarms.json
rm -f artifacts/signals.json artifacts/memory.json artifacts/memory-history.json
rm -f artifacts/network-atlas.md artifacts/context.json artifacts/growth-log.json
rm -f artifacts/heartbeat-log.jsonl artifacts/agent-comms.jsonl
rm -rf artifacts/atlas-history
mkdir -p artifacts/atlas-history

echo "[reset] Seeding small Dublin network (10 sites, 50 cells)..."
node - << 'JSEOF'
'use strict';
const { buildNetwork, writeAll } = require('./mock-eiap/world/network-builder');

const design = {
  model: 'seed',
  cells_per_site: { urban: 5, suburban: 4, rural: 3, motorway: 3 },
  zones: [
    { name: 'Dublin-City-Centre', type: 'urban', lat: 53.3498, lon: -6.2603, radius_km: 2.5, site_count: 10 },
  ],
  roads: [],
};

const { SITES, CELLS } = buildNetwork(design);
writeAll(design, SITES, CELLS, 'seed');
console.log(`[seed] ${SITES.length} sites, ${CELLS.length} cells`);
JSEOF

echo "[reset] Writing seed city-params.json..."
node -e "
const fs = require('fs');
const { buildNetwork } = require('./mock-eiap/world/network-builder');
const design = { model:'seed', cells_per_site:{urban:5,suburban:4,rural:3,motorway:3}, zones:[{name:'Dublin-City-Centre',type:'urban',lat:53.3498,lon:-6.2603,radius_km:2.5,site_count:10}], roads:[] };
const { SITES, CELLS } = buildNetwork(design);
const params = {
  generatedAt: new Date().toISOString(),
  model: 'seed',
  totalSites: SITES.length,
  totalCells: CELLS.length,
  zoneBreakdown: { urban: SITES.length, suburban: 0, rural: 0, motorway: 0 },
  note: 'Seed network — Dublin City Centre only. ARCHITECT will grow this.'
};
fs.writeFileSync('artifacts/city-params.json', JSON.stringify(params, null, 2));
console.log('[seed] city-params.json written: ' + SITES.length + ' sites, ' + CELLS.length + ' cells');
"

echo "[reset] Clearing world state (so events start fresh)..."
rm -f mock-eiap/world-state.json

echo "[reset] Resetting MEMORY.md..."
cat > MEMORY.md << 'MDEOF'
# NKA Memory — Shared Agent State

Last updated: (not yet started)
Cycle 0

---

## Network State

- **total_cells**: 50 (seed network — Dublin City Centre only)
- **outlier_count**: 0
- **elevated_count**: 0
- **alarm_count**: 0
- **cross_zone_count**: 0
- **last_heartbeat_at**: null

---

## Chronic Cells

None yet.

---

## Atlas

- **atlas_cycle_count**: 0
- **last_atlas_at**: null

---

## Growth

- **growth_wave_count**: 0
- **last_growth_at**: null
- **cells_after_last_wave**: 50
- **growth_target**: 8000

---

## Network Design

Starting from a Dublin City Centre seed (10 sites). ARCHITECT will expand toward national coverage.
Target unserved counties: Cork, Galway, Limerick, Kerry, Waterford, Sligo, Donegal, Roscommon,
Longford, Leitrim, Monaghan, Cavan, Carlow, Tipperary, Wexford, Kilkenny, Westmeath, Offaly.

---

## Agent Notes

- EIAP runs on loopback :8080
- artifacts/memory.json is ground truth for cell streaks; MEMORY.md is a human-readable summary
- artifacts/agent-comms.jsonl is the shared agent bulletin board
- SENTINEL posts every 10 min, ORACLE every 30 min, ARCHITECT every 90 min
MDEOF

echo "[reset] Clearing agent OpenClaw sessions..."
for agent in nka nka-oracle nka-architect; do
  rm -f ~/.openclaw/agents/$agent/sessions/sessions.json
  rm -f ~/.openclaw/agents/$agent/sessions/*.jsonl 2>/dev/null || true
done

echo "[reset] Recreating cron jobs..."
# Remove all existing NKA cron jobs
openclaw cron list --json 2>/dev/null | python3 -c "
import json,sys,re
raw=sys.stdin.read()
clean=re.sub(r'\x1b\[[0-9;]*m','',raw)
idx=clean.find('{')
if idx>=0:
    d=json.loads(clean[idx:])
    for job in d.get('jobs',[]):
        print(job['id'])
" 2>/dev/null | while read -r id; do
  openclaw cron rm "$id" 2>/dev/null || true
done

# SENTINEL — every 10 min
openclaw cron add \
  --name sentinel-watch \
  --every 10m \
  --agent nka \
  --session isolated \
  --model "openai/minimax-m2.5" \
  --timeout-seconds 600 \
  --no-deliver \
  --message "You are SENTINEL. Read SENTINEL.md and follow every step. Do not skip steps." \
  2>/dev/null | python3 -c "import json,sys,re; raw=sys.stdin.read(); clean=re.sub(r'\x1b\[[0-9;]*m','',raw); idx=clean.find('{'); d=json.loads(clean[idx:]); print('[reset] SENTINEL cron:', d['id'])" 2>/dev/null || echo "[reset] SENTINEL cron created"

# ORACLE — every 30 min
openclaw cron add \
  --name oracle-atlas \
  --every 30m \
  --agent nka-oracle \
  --session isolated \
  --model "openai/minimax-m2.5" \
  --timeout-seconds 600 \
  --no-deliver \
  --message "You are ORACLE. Read ORACLE.md and follow every step. Do not skip steps." \
  2>/dev/null | python3 -c "import json,sys,re; raw=sys.stdin.read(); clean=re.sub(r'\x1b\[[0-9;]*m','',raw); idx=clean.find('{'); d=json.loads(clean[idx:]); print('[reset] ORACLE cron:', d['id'])" 2>/dev/null || echo "[reset] ORACLE cron created"

# ARCHITECT — every 90 min
openclaw cron add \
  --name architect-growth \
  --every 90m \
  --agent nka-architect \
  --session isolated \
  --model "openai/minimax-m2.5" \
  --timeout-seconds 600 \
  --no-deliver \
  --message "You are ARCHITECT. Read ARCHITECT.md and follow every step. Do not skip steps." \
  2>/dev/null | python3 -c "import json,sys,re; raw=sys.stdin.read(); clean=re.sub(r'\x1b\[[0-9;]*m','',raw); idx=clean.find('{'); d=json.loads(clean[idx:]); print('[reset] ARCHITECT cron:', d['id'])" 2>/dev/null || echo "[reset] ARCHITECT cron created"

echo "[reset] Restarting mock EIAP server..."
pkill -f "node.*mock-eiap/server\.js" 2>/dev/null || true
sleep 1
DATA_SET=ireland node mock-eiap/server.js > /tmp/eiap.log 2>&1 &
sleep 2
curl -sf http://127.0.0.1:8080/topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities > /dev/null 2>&1 && echo "[reset] EIAP server up" || echo "[reset] WARN: EIAP server not responding"

echo "[reset] Restarting event engine..."
pkill -f "event-engine.js" 2>/dev/null || true
sleep 1
DATA_SET=ireland node mock-eiap/world/event-engine.js > /tmp/event-engine.log 2>&1 &
echo "[reset] Event engine started"

echo "[reset] Restarting collection timer..."
systemctl --user start nka-collect.timer
sleep 3
bash agents/nka/scripts/collect.sh && echo "[reset] Initial collection OK" || echo "[reset] WARN: initial collection failed"

echo "[reset] Restarting WebUI server..."
cd webui && node server.js > /tmp/webui.log 2>&1 &
cd ..
sleep 2
curl -sf http://localhost:9000/login > /dev/null && echo "[reset] WebUI up at http://localhost:9000" || echo "[reset] WARN: WebUI not responding"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Reset complete."
echo " Network: 50 cells (Dublin City Centre seed)"
echo " Agents:  SENTINEL (10m) · ORACLE (30m) · ARCHITECT (90m)"
echo " Watch the agents talk at http://localhost:9000/agents"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
