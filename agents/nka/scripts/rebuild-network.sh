#!/usr/bin/env bash
# NKA rebuild-network — regenerate network from city-params.json and restart the world
# Called by the NKA heartbeat agent during growth waves (exec-approved, no confirmation needed)
# Usage: bash agents/nka/scripts/rebuild-network.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MOCK_EIAP="$PROJECT_DIR/mock-eiap"

echo "[rebuild] starting network rebuild at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Regenerate data-ireland.js from artifacts/city-params.json
echo "[rebuild] rebuilding network from city-params.json..."
node "$SCRIPT_DIR/rebuild-from-params.js" && echo "[rebuild] network-builder OK" || {
  echo "[rebuild] network-builder FAILED — aborting"
  exit 1
}

# Restart mock EIAP server to pick up new topology
echo "[rebuild] restarting mock-eiap server..."

# Find and stop existing server process
EXISTING_PID=$(pgrep -f "node.*mock-eiap/server.js" 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
  echo "[rebuild] stopping PID $EXISTING_PID"
  kill "$EXISTING_PID" 2>/dev/null || true
  sleep 2
fi

# Find and stop existing event-engine process
ENGINE_PID=$(pgrep -f "node.*event-engine.js" 2>/dev/null || true)
if [ -n "$ENGINE_PID" ]; then
  echo "[rebuild] stopping event-engine PID $ENGINE_PID"
  kill "$ENGINE_PID" 2>/dev/null || true
  sleep 1
fi

# Start server in background with ireland data set
DATA_SET=ireland nohup node "$MOCK_EIAP/server.js" >> /tmp/nka-mock-eiap.log 2>&1 &
SERVER_PID=$!
echo "[rebuild] server started PID $SERVER_PID (DATA_SET=ireland)"
sleep 2

# Start event engine in background
DATA_SET=ireland nohup node "$MOCK_EIAP/world/event-engine.js" >> /tmp/nka-event-engine.log 2>&1 &
ENGINE_PID=$!
echo "[rebuild] event-engine started PID $ENGINE_PID"

# Quick health check
sleep 3
if curl -sf --max-time 5 "http://127.0.0.1:8080/topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities" > /dev/null 2>&1; then
  echo "[rebuild] health check OK — server is responding"
else
  echo "[rebuild] WARNING: health check failed — server may still be starting"
fi

# Re-collect so artifacts reflect the new topology immediately
echo "[rebuild] re-collecting artifacts..."
bash "$SCRIPT_DIR/collect.sh" && echo "[rebuild] collect OK" || echo "[rebuild] collect FAILED (timer will retry)"

echo "[rebuild] done at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
