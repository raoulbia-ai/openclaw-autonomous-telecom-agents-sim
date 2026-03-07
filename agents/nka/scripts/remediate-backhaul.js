#!/usr/bin/env node
/**
 * Remediate a backhaul fault — reroute traffic to accelerate resolution.
 *
 * Usage:  node remediate-backhaul.js <siteId>
 *
 * Effect: Cuts remaining duration of an active backhaul_fault by 75%.
 *         If the fault has 2 hours left, rerouting reduces it to 30 minutes.
 *         Can only be applied once per event (prevents spam).
 *
 * This also immediately stops fault spreading from this site.
 *
 * Modifies world-state.json directly. Writes to artifacts/remediation-log.jsonl.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const WORLD_STATE_FILE = path.join(__dirname, '..', '..', '..', 'mock-eiap', 'world-state.json');
const REMEDIATION_LOG  = path.join(__dirname, '..', '..', '..', 'artifacts', 'remediation-log.jsonl');

const siteId = process.argv[2];

if (!siteId) {
  console.error('Usage: node remediate-backhaul.js <siteId>');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(WORLD_STATE_FILE, 'utf8'));
const now   = new Date();
let changed = false;
let result  = '';

// Find active backhaul_fault events where any affected cell belongs to this site
// We need to check cell IDs against site — cell URN format includes the site ID
for (const evt of state.events) {
  if (evt.resolved) continue;
  if (evt.type !== 'backhaul_fault') continue;
  if (evt.rerouted) continue; // already rerouted

  // Check if any affected cell belongs to this site (site ID is embedded in cell URN)
  const siteMatch = evt.affectedCells.some(cellId => cellId.includes(`MeContext=${siteId},`));
  if (!siteMatch) continue;

  const resolveAt    = new Date(evt.resolveAt);
  const remainingMs  = resolveAt.getTime() - now.getTime();

  if (remainingMs <= 0) continue; // about to resolve anyway

  const newResolveAt = new Date(now.getTime() + remainingMs * 0.25);
  evt.resolveAt      = newResolveAt.toISOString();
  evt.rerouted       = true; // mark so it can't be rerouted again

  changed = true;
  const savedMin = Math.round((remainingMs - remainingMs * 0.25) / 60000);
  result = `Backhaul rerouted for ${siteId} (event ${evt.id}). Remaining time cut by ${savedMin} min. New resolve: ${newResolveAt.toISOString().slice(11, 16)}`;
  console.log(`[remediate] ${result}`);
}

if (!changed) {
  const anyBackhaul = state.events.find(e =>
    !e.resolved && e.type === 'backhaul_fault' &&
    e.affectedCells.some(c => c.includes(`MeContext=${siteId},`))
  );
  if (anyBackhaul && anyBackhaul.rerouted) {
    result = `Backhaul on ${siteId} already rerouted (event ${anyBackhaul.id}). No further action possible.`;
  } else {
    result = `No active backhaul_fault found for site ${siteId}. No action taken.`;
  }
  console.log(`[remediate] ${result}`);
}

// Save
if (changed) {
  const tmp = WORLD_STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, WORLD_STATE_FILE);
}

// Log
const logEntry = JSON.stringify({
  at: now.toISOString(),
  action: 'reroute-backhaul',
  siteId,
  changed,
  result,
});
fs.appendFileSync(REMEDIATION_LOG, logEntry + '\n');
