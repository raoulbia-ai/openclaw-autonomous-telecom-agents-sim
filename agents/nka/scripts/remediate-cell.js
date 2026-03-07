#!/usr/bin/env node
/**
 * Remediate a cell — clear a ghost alarm or force-resolve a stale equipment fault.
 *
 * Usage:  node remediate-cell.js <cellId> <action>
 * Actions:
 *   clear-alarm   — clear a ghost alarm on this cell (no effect if alarm is real)
 *   restart-cell   — force-resolve an equipment_fault on this cell
 *
 * Modifies world-state.json directly. The event engine will pick up the change on next tick.
 * Writes a log entry to artifacts/remediation-log.jsonl for agent audit trail.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const WORLD_STATE_FILE = path.join(__dirname, '..', '..', '..', 'mock-eiap', 'world-state.json');
const REMEDIATION_LOG  = path.join(__dirname, '..', '..', '..', 'artifacts', 'remediation-log.jsonl');

const cellId = process.argv[2];
const action = process.argv[3];

if (!cellId || !action) {
  console.error('Usage: node remediate-cell.js <cellId> <action>');
  console.error('Actions: clear-alarm, restart-cell');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(WORLD_STATE_FILE, 'utf8'));
const now   = new Date();
let changed = false;
let result  = '';

if (action === 'clear-alarm') {
  // Find ghost alarm events affecting this cell
  for (const evt of state.events) {
    if (!evt.ghostAlarm) continue;
    if (!evt.affectedCells.includes(cellId)) continue;

    evt.ghostAlarm          = false;
    evt.ghostAlarmExpiresAt = null;
    changed = true;
    result  = `Ghost alarm cleared on ${cellId} (event ${evt.id}, alarm ${evt.alarmId})`;
    console.log(`[remediate] ${result}`);
  }

  if (!changed) {
    // Check if there's a real (non-ghost) alarm — can't clear that
    const realAlarm = state.events.find(e =>
      !e.resolved && e.affectedCells.includes(cellId) && e.type === 'equipment_fault'
    );
    if (realAlarm) {
      result = `Cannot clear alarm on ${cellId} — fault is still active (${realAlarm.id}). Use restart-cell to force-resolve.`;
    } else {
      result = `No ghost alarm found on ${cellId}. No action taken.`;
    }
    console.log(`[remediate] ${result}`);
  }

} else if (action === 'restart-cell') {
  // Force-resolve equipment_fault events affecting this cell
  for (const evt of state.events) {
    if (evt.resolved) continue;
    if (evt.type !== 'equipment_fault') continue;
    if (!evt.affectedCells.includes(cellId)) continue;

    evt.resolved   = true;
    evt.resolvedAt = now.toISOString();
    // No ghost alarm on a manual restart
    evt.ghostAlarm = false;
    changed = true;
    result  = `Equipment fault force-resolved on ${cellId} (event ${evt.id})`;
    console.log(`[remediate] ${result}`);
  }

  if (!changed) {
    result = `No active equipment_fault found on ${cellId}. No action taken.`;
    console.log(`[remediate] ${result}`);
  }

} else {
  console.error(`Unknown action: ${action}. Use clear-alarm or restart-cell.`);
  process.exit(1);
}

// Save modified world state
if (changed) {
  const tmp = WORLD_STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, WORLD_STATE_FILE);
}

// Log the remediation for audit trail
const logEntry = JSON.stringify({
  at: now.toISOString(),
  action,
  cellId,
  changed,
  result,
});
fs.appendFileSync(REMEDIATION_LOG, logEntry + '\n');
