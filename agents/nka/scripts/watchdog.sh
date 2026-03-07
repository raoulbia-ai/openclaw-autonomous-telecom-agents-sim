#!/usr/bin/env bash
# NKA watchdog — ensure EIAP is running with ireland data set.
# Called by SENTINEL every cycle. Restarts if cell count drops below threshold.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MOCK_EIAP="$PROJECT_DIR/mock-eiap"
EIAP="http://127.0.0.1:8080"
MIN_CELLS=50

# Get token
TOKEN=$(curl -sf --max-time 5 \
  -X POST "$EIAP/auth/realms/master/protocol/openid-connect/token" \
  -d "grant_type=client_credentials&client_id=mock-client&client_secret=mock-secret" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "[watchdog] EIAP unreachable — restarting"
  RESTART=1
else
  COUNT=$(curl -sf --max-time 5 \
    -H "Authorization: Bearer $TOKEN" \
    "$EIAP/topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('totalCount',0))" 2>/dev/null || echo "0")

  if [ "$COUNT" -lt "$MIN_CELLS" ]; then
    echo "[watchdog] EIAP returned $COUNT cells (< $MIN_CELLS) — restarting with ireland data"
    RESTART=1
  else
    echo "[watchdog] EIAP OK — $COUNT cells"
    RESTART=0
  fi
fi

if [ "${RESTART:-0}" = "1" ]; then
  # Kill existing processes
  pkill -f "node.*mock-eiap/server\.js" 2>/dev/null || true
  pkill -f "node.*event-engine\.js"     2>/dev/null || true
  sleep 2

  # Restart with ireland dataset
  DATA_SET=ireland nohup node "$MOCK_EIAP/server.js" >> /tmp/nka-mock-eiap.log 2>&1 &
  sleep 2
  DATA_SET=ireland FAST_MODE="${FAST_MODE:-}" nohup node "$MOCK_EIAP/world/event-engine.js" >> /tmp/nka-event-engine.log 2>&1 &

  echo "[watchdog] restarted — will collect on next cycle"
fi
