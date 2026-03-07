#!/usr/bin/env node
/**
 * Audit tool — compares agent decisions against event engine ground truth.
 *
 * Reads:
 *   - artifacts/event-history.jsonl    (ground truth: what actually happened)
 *   - artifacts/agent-comms.jsonl      (agent decisions: handoffs, advisories, actions)
 *   - artifacts/remediation-log.jsonl  (remediation actions taken)
 *
 * Reports:
 *   - Events detected vs missed by agents
 *   - Ghost alarms: created vs cleared by agents
 *   - Remediation accuracy: did agents fix the right things?
 *   - Time-to-detection: how many cycles before agents flagged an issue
 *   - False positives: agent flagged something that wasn't a real event
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ARTIFACTS = path.join(__dirname, '..', '..', '..', 'artifacts');

function readJsonl(file) {
  const p = path.join(ARTIFACTS, file);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// --- Load data ---

const eventHistory  = readJsonl('event-history.jsonl');
const agentComms    = readJsonl('agent-comms.jsonl');
const remediations  = readJsonl('remediation-log.jsonl');

if (eventHistory.length === 0) {
  console.log('No event history yet. The event engine needs to run with the updated');
  console.log('logging code for a while before this audit produces meaningful results.');
  console.log(`\nAgent comms entries: ${agentComms.length}`);
  console.log(`Remediation entries: ${remediations.length}`);
  process.exit(0);
}

// --- Analyse ground truth ---

const spawned  = eventHistory.filter(e => e.action === 'spawned');
const resolved = eventHistory.filter(e => e.action === 'resolved');
const ghostsCreated = eventHistory.filter(e => e.action === 'ghost_alarm_created');
const ghostsExpired = eventHistory.filter(e => e.action === 'ghost_alarm_expired');

const byType = {};
for (const e of spawned) {
  byType[e.type] = (byType[e.type] || 0) + 1;
}

const byTrigger = {};
for (const e of spawned) {
  const t = e.trigger || 'unknown';
  byTrigger[t] = (byTrigger[t] || 0) + 1;
}

// --- Analyse agent activity ---

const sentinelHandoffs = agentComms.filter(e => e.from === 'SENTINEL' && e.type === 'handoff');
const oracleAdvisories = agentComms.filter(e => e.from === 'ORACLE' && e.type === 'advisory');
const oracleAtlas      = agentComms.filter(e => e.from === 'ORACLE' && e.type === 'atlas');
const architectActions = agentComms.filter(e => e.from === 'ARCHITECT');

// Extract cell IDs mentioned in SENTINEL handoffs
const cellsMentionedBySentinel = new Set();
for (const h of sentinelHandoffs) {
  const msg = h.message || '';
  // Match patterns like "cell-63", "cells 6-10", "NRCellDU-7", "cell 121"
  const matches = msg.match(/cell[s]?\s*[-=]?\s*(\d+)/gi) || [];
  for (const m of matches) {
    const nums = m.match(/\d+/g);
    if (nums) nums.forEach(n => cellsMentionedBySentinel.add(parseInt(n)));
  }
}

// Extract cell IDs from event history
const cellsInEvents = new Set();
for (const e of spawned) {
  for (const c of e.cells) {
    const num = c.match(/\d+/);
    if (num) cellsInEvents.add(parseInt(num[0]));
  }
}

// --- Remediation analysis ---

const remediationsByAction = {};
for (const r of remediations) {
  const a = r.action || 'unknown';
  remediationsByAction[a] = remediationsByAction[a] || { total: 0, changed: 0 };
  remediationsByAction[a].total++;
  if (r.changed) remediationsByAction[a].changed++;
}

// Ghost alarm detection: did agents clear ghost alarms before they expired naturally?
const agentClearedGhosts = remediations.filter(r => r.action === 'clear-alarm' && r.changed);
const agentFailedClears  = remediations.filter(r => r.action === 'clear-alarm' && !r.changed);

// --- Report ---

console.log('=== GROUND TRUTH (Event Engine) ===\n');
console.log(`Event history entries: ${eventHistory.length}`);
console.log(`  Spawned:  ${spawned.length}`);
console.log(`  Resolved: ${resolved.length}`);
console.log(`  Ghost alarms created: ${ghostsCreated.length}`);
console.log(`  Ghost alarms expired: ${ghostsExpired.length}`);
console.log(`\nBy type:`);
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}
console.log(`\nBy trigger:`);
for (const [trigger, count] of Object.entries(byTrigger).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${trigger}: ${count}`);
}
console.log(`\nCells affected by events: ${cellsInEvents.size}`);

console.log('\n=== AGENT ACTIVITY ===\n');
console.log(`SENTINEL handoffs: ${sentinelHandoffs.length}`);
console.log(`ORACLE advisories: ${oracleAdvisories.length}`);
console.log(`ORACLE atlas reports: ${oracleAtlas.length}`);
console.log(`ARCHITECT actions: ${architectActions.length}`);
console.log(`\nCells mentioned by SENTINEL: ${cellsMentionedBySentinel.size}`);

// Detection coverage
const detected = new Set([...cellsMentionedBySentinel].filter(c => cellsInEvents.has(c)));
const missed   = new Set([...cellsInEvents].filter(c => !cellsMentionedBySentinel.has(c)));
const falsePos = new Set([...cellsMentionedBySentinel].filter(c => !cellsInEvents.has(c)));

console.log('\n=== DETECTION ACCURACY ===\n');
console.log(`Cells with real events:      ${cellsInEvents.size}`);
console.log(`Cells SENTINEL detected:     ${detected.size} (${cellsInEvents.size > 0 ? (detected.size / cellsInEvents.size * 100).toFixed(0) : 0}%)`);
console.log(`Cells SENTINEL missed:       ${missed.size}`);
if (missed.size > 0 && missed.size <= 20) {
  console.log(`  Missed: ${[...missed].sort((a, b) => a - b).map(c => `NRCellDU-${c}`).join(', ')}`);
}
console.log(`Possible false positives:    ${falsePos.size}`);
if (falsePos.size > 0 && falsePos.size <= 10) {
  console.log(`  (cells flagged but not in event log — may be from before logging started)`);
}

console.log('\n=== REMEDIATION ACCURACY ===\n');
console.log(`Total remediation actions: ${remediations.length}`);
for (const [action, stats] of Object.entries(remediationsByAction)) {
  const rate = stats.total > 0 ? (stats.changed / stats.total * 100).toFixed(0) : 0;
  console.log(`  ${action}: ${stats.total} total, ${stats.changed} effective (${rate}% success)`);
}

console.log(`\nGhost alarm handling:`);
console.log(`  Engine created:        ${ghostsCreated.length}`);
console.log(`  Engine auto-expired:   ${ghostsExpired.length}`);
console.log(`  Agent cleared:         ${agentClearedGhosts.length}`);
console.log(`  Agent clear failed:    ${agentFailedClears.length} (alarm already gone)`);

// --- Verdict ---

console.log('\n=== HYPOTHESIS ASSESSMENT ===\n');

const detectionRate = cellsInEvents.size > 0 ? detected.size / cellsInEvents.size : 0;
const remTotal = remediations.length;
const remEffective = remediations.filter(r => r.changed).length;
const remRate = remTotal > 0 ? remEffective / remTotal : 0;

const scores = [];
if (detectionRate >= 0.8) scores.push('Detection: GOOD');
else if (detectionRate >= 0.5) scores.push('Detection: PARTIAL');
else scores.push('Detection: POOR');

if (remRate >= 0.7) scores.push('Remediation: EFFECTIVE');
else if (remRate >= 0.4) scores.push('Remediation: PARTIAL');
else if (remTotal === 0) scores.push('Remediation: NO DATA');
else scores.push('Remediation: INEFFECTIVE');

if (oracleAdvisories.length >= 3) scores.push('Analysis: ACTIVE');
else if (oracleAdvisories.length >= 1) scores.push('Analysis: MINIMAL');
else scores.push('Analysis: NONE');

console.log(scores.join(' | '));

if (eventHistory.length < 20) {
  console.log('\nInsufficient data for conclusive assessment.');
  console.log('Run for 24-48h to accumulate enough event history.');
} else {
  console.log(`\nBased on ${eventHistory.length} events and ${agentComms.length} agent communications.`);
  if (detectionRate >= 0.8 && remRate >= 0.5) {
    console.log('Evidence supports the hypothesis: agents demonstrate situational awareness.');
  } else if (detectionRate >= 0.5) {
    console.log('Partial evidence: agents detect issues but miss some or remediate inconsistently.');
  } else {
    console.log('Insufficient evidence: detection rate too low for situational awareness claim.');
  }
}

console.log('');
