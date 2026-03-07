#!/usr/bin/env bash
# NKA collect — fetch EIAP endpoints and write raw artifacts
# Called by the NKA heartbeat agent (exec-approved, no confirmation needed)
# Usage: bash agents/nka/scripts/collect.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ARTIFACTS="$PROJECT_DIR/artifacts"
EIAP="http://127.0.0.1:8080"
TIMEOUT=15

mkdir -p "$ARTIFACTS"

echo "[collect] fetching EIAP endpoints at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Obtain OAuth bearer token (client credentials)
TOKEN=$(curl -sf --max-time "$TIMEOUT" \
  -X POST "$EIAP/auth/realms/master/protocol/openid-connect/token" \
  -d "grant_type=client_credentials&client_id=mock-client&client_secret=mock-secret" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[collect] ERROR: could not obtain EIAP token — server may be down"
  exit 1
fi

fetch() {
  local name="$1" path="$2"
  curl -sf --max-time "$TIMEOUT" \
    -H "Authorization: Bearer $TOKEN" \
    "$EIAP$path" \
    -o "$ARTIFACTS/${name}.json" \
    && echo "[collect] $name OK" || echo "[collect] $name FAILED"
}

fetch topology    "/topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities"
fetch performance "/data-management/v1/pm/cells"
fetch alarms      "/data-management/v1/fm/alarms"

node "$SCRIPT_DIR/normalize.js" && echo "[collect] normalize OK" || echo "[collect] normalize FAILED"

echo "[collect] done"
