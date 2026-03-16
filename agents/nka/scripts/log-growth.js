#!/usr/bin/env node
/**
 * Log a growth wave to artifacts/growth-log.json.
 *
 * Usage:
 *   node log-growth.js --wave N --sites N --cells N --counties "Cork,Kerry" [--note "description"]
 *
 * Reads artifacts/growth-log.json (JSON array).
 * Handles legacy format: if the file is a single object (old JSONL-style), converts it to an array.
 * Appends a new entry and writes back as a proper JSON array using an atomic temp-file rename.
 *
 * Required: --wave, --sites, --cells, --counties
 * Optional: --note
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ARTIFACTS     = path.join(__dirname, '..', '..', '..', 'artifacts');
const GROWTH_LOG    = path.join(ARTIFACTS, 'growth-log.json');
const STATE_FILE    = path.join(ARTIFACTS, 'state.json');
const COMMS_FILE    = path.join(ARTIFACTS, 'agent-comms.jsonl');

// --- Parse args ---

const args = process.argv.slice(2);

function getArg(name) {
  const flag = `--${name}`;
  const idx  = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

const waveRaw    = getArg('wave');
const sitesRaw   = getArg('sites');
const cellsRaw   = getArg('cells');
const countiesRaw = getArg('counties');
const note       = getArg('note') || '';

// Validate required args
const missing = [];
if (waveRaw    === null) missing.push('--wave');
if (sitesRaw   === null) missing.push('--sites');
if (cellsRaw   === null) missing.push('--cells');
if (countiesRaw === null) missing.push('--counties');

if (missing.length > 0) {
  console.error(`[log-growth] Missing required arguments: ${missing.join(', ')}`);
  console.error('Usage: node log-growth.js --wave N --sites N --cells N --counties "Cork,Kerry" [--note "description"]');
  process.exit(1);
}

const wave       = parseInt(waveRaw, 10);
const sitesAdded = parseInt(sitesRaw, 10);
const cellsAdded = parseInt(cellsRaw, 10);
const counties   = countiesRaw.split(',').map(c => c.trim()).filter(Boolean);

if (isNaN(wave) || isNaN(sitesAdded) || isNaN(cellsAdded)) {
  console.error('[log-growth] --wave, --sites, and --cells must be integers.');
  process.exit(1);
}

if (counties.length === 0) {
  console.error('[log-growth] --counties must be a non-empty comma-separated list.');
  process.exit(1);
}

// --- Read existing log ---

let entries = [];

if (fs.existsSync(GROWTH_LOG)) {
  const raw = fs.readFileSync(GROWTH_LOG, 'utf8').trim();
  if (raw.length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(`[log-growth] Could not parse ${GROWTH_LOG}: ${e.message}`);
      process.exit(1);
    }

    if (Array.isArray(parsed)) {
      entries = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Legacy: single object — wrap in array
      console.warn('[log-growth] growth-log.json contained a single object; converting to array.');
      entries = [parsed];
    } else {
      console.error('[log-growth] growth-log.json has unexpected format (not array or object).');
      process.exit(1);
    }
  }
}

// --- Build new entry ---

const entry = {
  at:         new Date().toISOString(),
  wave,
  sitesAdded,
  cellsAdded,
  counties,
};
if (note) entry.note = note;

entries.push(entry);

// --- Atomic write ---

const tmp = path.join(os.tmpdir(), `growth-log-${process.pid}.json.tmp`);
fs.writeFileSync(tmp, JSON.stringify(entries, null, 2) + '\n', 'utf8');
fs.renameSync(tmp, GROWTH_LOG);

// --- Update state.json ---

let state = {};
if (fs.existsSync(STATE_FILE)) {
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
}
state.growth_wave_count = wave;
state.last_growth_at = entry.at;

const tmpState = path.join(os.tmpdir(), `state-${process.pid}.json.tmp`);
fs.writeFileSync(tmpState, JSON.stringify(state, null, 2) + '\n', 'utf8');
fs.renameSync(tmpState, STATE_FILE);

// --- Append to agent-comms.jsonl ---

const commsEntry = JSON.stringify({
  at: entry.at,
  from: 'ARCHITECT',
  to: 'ALL',
  type: 'growth',
  message: `Growth wave ${wave} executed. Added ${counties.join(', ')}.${note ? ' ' + note : ''}`,
});
fs.appendFileSync(COMMS_FILE, commsEntry + '\n', 'utf8');

console.log(`[log-growth] wave ${wave} logged — ${sitesAdded} sites, ${cellsAdded} cells, counties: ${counties.join(', ')}${note ? ` — "${note}"` : ''}`);
console.log(`[log-growth] state.json updated: growth_wave_count=${wave}`);

// --- Run autonomy monitor ---
try {
  const { execSync } = require('child_process');
  const monitorPath = path.join(__dirname, 'autonomy-monitor.js');
  if (fs.existsSync(monitorPath)) {
    const output = execSync(`node "${monitorPath}"`, { timeout: 10000, encoding: 'utf8' });
    console.log('\n' + output);
  }
} catch (e) {
  console.log(`[log-growth] monitor skipped: ${e.message}`);
}
console.log(`[log-growth] growth-log.json now has ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`);
