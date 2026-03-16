#!/usr/bin/env node
/**
 * Combined input reader for NKA agents — returns everything in one call.
 *
 * Usage:
 *   node read-cycle-inputs.js SENTINEL
 *   node read-cycle-inputs.js ORACLE
 *   node read-cycle-inputs.js ARCHITECT
 *
 * Returns JSON with agent-specific data. Reduces 5-7 tool calls to 1,
 * saving ~37% input tokens (same strategy as WorldLens read-cycle-inputs.js).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const ARTIFACTS = path.join(ROOT, 'artifacts');

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function readCommsLast(n, filter) {
  const file = path.join(ARTIFACTS, 'agent-comms.jsonl');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  const tail = lines.slice(-100); // read last 100, filter down
  const parsed = [];
  for (const line of tail) {
    try {
      const entry = JSON.parse(line);
      if (!filter || filter(entry)) parsed.push(entry);
    } catch { /* skip */ }
  }
  return parsed.slice(-n);
}

// --- Agent-specific readers ---

function sentinelInputs() {
  // SENTINEL-FAST.md only needs gateway/agent status — those are openclaw CLI calls,
  // not file reads. But we can still bundle signals for context.
  return {
    agent: 'SENTINEL',
    signals: readJSON(path.join(ARTIFACTS, 'signals.json')),
    state: readJSON(path.join(ARTIFACTS, 'state.json')),
    recent_comms: readCommsLast(5, null),
  };
}

function oracleInputs() {
  return {
    agent: 'ORACLE',
    // Step 1: SENTINEL handoffs
    sentinel_handoffs: readCommsLast(5, e => e.from === 'SENTINEL'),
    // Step 2: network state
    signals: readJSON(path.join(ARTIFACTS, 'signals.json')),
    state: readJSON(path.join(ARTIFACTS, 'state.json')),
    memory: readFile(path.join(ROOT, 'MEMORY.md')),
    // Step 3: external context
    external_context: readJSON(path.join(ARTIFACTS, 'external-context.json')),
  };
}

function architectInputs() {
  return {
    agent: 'ARCHITECT',
    // Step 1: ORACLE advisory
    oracle_advisory: readCommsLast(3, e => e.from === 'ORACLE' && e.to === 'ARCHITECT' && e.type === 'advisory'),
    // Step 1: state
    state: readJSON(path.join(ARTIFACTS, 'state.json')),
    // Step 1: external context
    external_context: readJSON(path.join(ARTIFACTS, 'external-context.json')),
    // Step 4: city-params (needed if growing)
    city_params: readJSON(path.join(ARTIFACTS, 'city-params.json')),
  };
}

// --- Main ---
const agentName = (process.argv[2] || '').toUpperCase();

const readers = {
  SENTINEL: sentinelInputs,
  ORACLE: oracleInputs,
  ARCHITECT: architectInputs,
};

if (!readers[agentName]) {
  console.error('Usage: node read-cycle-inputs.js SENTINEL|ORACLE|ARCHITECT');
  process.exit(1);
}

const output = readers[agentName]();
console.log(JSON.stringify(output, null, 2));
