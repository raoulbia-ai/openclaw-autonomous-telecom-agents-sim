#!/usr/bin/env bash
# NKA update-state — derive authoritative coordination state from agent-comms.jsonl
# Written by script, never by LLM. Called by SENTINEL every cycle.
# Writes artifacts/state.json — the single source of truth for agent coordination.

set -euo pipefail
cd "$(dirname "$0")/../../.."

python3 - << 'PYEOF'
import json, os

COMMS = 'artifacts/agent-comms.jsonl'
STATE = 'artifacts/state.json'

growth_waves = []
oracle_runs  = []

if os.path.exists(COMMS):
    with open(COMMS) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if entry.get('from') == 'ARCHITECT' and entry.get('type') == 'growth':
                    growth_waves.append(entry)
                if entry.get('from') == 'ORACLE' and entry.get('type') == 'atlas':
                    oracle_runs.append(entry)
            except Exception:
                pass

state = {
    'growth_wave_count': len(growth_waves),
    'last_growth_at':    growth_waves[-1]['at'] if growth_waves else None,
    'atlas_cycle_count': len(oracle_runs),
    'last_atlas_at':     oracle_runs[-1]['at']  if oracle_runs  else None,
    'growth_target':     8000,
}

tmp = STATE + '.tmp'
with open(tmp, 'w') as f:
    json.dump(state, f, indent=2)
os.replace(tmp, STATE)

print(f"state_updated waves={state['growth_wave_count']} last_growth={state['last_growth_at']} atlas_runs={state['atlas_cycle_count']}")
PYEOF
