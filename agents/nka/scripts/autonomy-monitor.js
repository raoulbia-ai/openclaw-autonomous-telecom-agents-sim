#!/usr/bin/env node
/**
 * Autonomy Experiment Monitor
 *
 * Summarises the state of the Phase 2 autonomous playbook experiment.
 * Run manually or via cron after each growth wave.
 *
 * Usage: node agents/nka/scripts/autonomy-monitor.js [--json]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ARTIFACTS = path.join(__dirname, '..', '..', '..', 'artifacts');
const json = process.argv.includes('--json');

function readJson(file) {
  const p = path.join(ARTIFACTS, file);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function readJsonl(file) {
  const p = path.join(ARTIFACTS, file);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// --- 1. Run State ---
const runState = readJson('last-run-state.json') || {};
const agentRuns = readJsonl('agent-runs.jsonl');

// Filter to experiment period (autonomous jobs started 2026-03-16T07:22Z)
const experimentStart = '2026-03-16T07:00:00Z';
const expRuns = agentRuns.filter(r => r.at > experimentStart);

const runsByAgent = {};
for (const r of expRuns) {
  if (!runsByAgent[r.agent]) runsByAgent[r.agent] = { acted: 0, skipped: 0, error: 0, total: 0 };
  runsByAgent[r.agent].total++;
  if (r.result === 'acted') runsByAgent[r.agent].acted++;
  else if (r.result?.startsWith('skipped')) runsByAgent[r.agent].skipped++;
  else runsByAgent[r.agent].error++;
}

// --- 2. Comms Analysis ---
const comms = readJsonl('agent-comms.jsonl');
const expComms = comms.filter(c => c.at > experimentStart);

const typeCounts = {};
const agentTypeCounts = {};
for (const c of expComms) {
  typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  const key = `${c.from}:${c.type}`;
  agentTypeCounts[key] = (agentTypeCounts[key] || 0) + 1;
}

const autonomyTypes = ['hypothesis', 'challenge', 'self-correction', 'meta', 'review_request', 'remediation'];
const autonomyComms = expComms.filter(c => autonomyTypes.includes(c.type));

// --- 3. Atlas Diversity ---
const histDir = path.join(ARTIFACTS, 'atlas-history');
let atlasCount = 0;
let uniqueStructures = new Set();
if (fs.existsSync(histDir)) {
  const files = fs.readdirSync(histDir).filter(f => f.endsWith('.md')).sort().reverse();
  // Only look at recent atlases (experiment period)
  for (const f of files.slice(0, 20)) {
    const content = fs.readFileSync(path.join(histDir, f), 'utf8');
    // Extract heading structure as a fingerprint
    const headings = content.match(/^##\s+.+$/gm) || [];
    const structure = headings.map(h => h.replace(/^##\s+/, '').replace(/[—–\d:.\-T]+/g, '').trim()).join(' | ');
    uniqueStructures.add(structure);
    atlasCount++;
  }
}

// --- 4. Stuck Remediation ---
const remediations = readJsonl('remediation-log.jsonl');
const recentRemed = remediations.slice(-30);
const stuckTargets = {};
for (const r of recentRemed) {
  if (!r.changed) {
    const target = r.cellId || r.siteId || 'unknown';
    stuckTargets[target] = (stuckTargets[target] || 0) + 1;
  }
}
const stuckList = Object.entries(stuckTargets).filter(([, c]) => c >= 3);

// --- 5. Growth ---
const growthLog = readJson('growth-log.json') || [];
const expGrowth = growthLog.filter(g => g.at > experimentStart);
const state = readJson('state.json') || {};

// --- 6. Cron Status ---
let cronStatus = {};
try {
  const jobsPath = path.join(process.env.HOME, '.openclaw-ata', 'cron', 'jobs.json');
  if (fs.existsSync(jobsPath)) {
    const data = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    const autoJobs = (data.jobs || []).filter(j => j.name?.includes('-auto'));
    for (const j of autoJobs) {
      const agent = j.name.replace('ata-', '').replace('-auto', '').toUpperCase();
      cronStatus[agent] = {
        enabled: j.enabled,
        lastStatus: j.state?.lastRunStatus || 'never',
        lastError: j.state?.lastError || null,
        consecutiveErrors: j.state?.consecutiveErrors || 0,
        nextRunIn: j.state?.nextRunAtMs ? Math.round((j.state.nextRunAtMs - Date.now()) / 60000) + 'm' : '?',
      };
    }
  }
} catch {}

// --- Build Report ---
const report = {
  timestamp: new Date().toISOString(),
  experimentRunning: Object.keys(cronStatus).length > 0,
  totalExperimentRuns: expRuns.length,
  totalExperimentComms: expComms.length,

  runsByAgent,

  deltaGating: {
    totalSkips: expRuns.filter(r => r.result?.startsWith('skipped')).length,
    totalActs: expRuns.filter(r => r.result === 'acted').length,
    skipRate: expRuns.length > 0
      ? Math.round((expRuns.filter(r => r.result?.startsWith('skipped')).length / expRuns.length) * 100) + '%'
      : 'n/a',
  },

  messageDiversity: {
    typeCounts,
    autonomyMessageCount: autonomyComms.length,
    autonomyMessages: autonomyComms.slice(-10).map(c => ({
      from: c.from, type: c.type, to: c.to,
      message: c.message?.substring(0, 120) + (c.message?.length > 120 ? '...' : ''),
    })),
  },

  atlasStructureDiversity: {
    recentAtlasCount: atlasCount,
    uniqueStructures: uniqueStructures.size,
    structures: [...uniqueStructures].slice(0, 5),
  },

  stuckRemediation: {
    stuckTargets: stuckList.map(([target, count]) => ({ target, failedAttempts: count })),
    resolved: stuckList.length === 0,
  },

  growth: {
    currentWave: state.growth_wave_count || 0,
    totalCells: state.growth_target ? undefined : 0,
    growthTarget: state.growth_target || 0,
    wavesSinceExperiment: expGrowth.length,
    recentWaves: expGrowth.slice(-5).map(g => ({
      wave: g.wave, counties: g.counties, at: g.at,
    })),
  },

  cronHealth: cronStatus,

  successCriteria: {
    deltaGatingWorks: expRuns.filter(r => r.result?.startsWith('skipped')).length > 0,
    autonomyMessagePosted: autonomyComms.length > 0,
    atlasStructureVaried: uniqueStructures.size >= 3,
    architectDeclinedRemediation: expComms.some(c => c.from === 'ARCHITECT' && (c.type === 'challenge' || (c.type === 'remediation' && c.message?.toLowerCase().includes('skip')))),
    selfCorrectionOccurred: expComms.some(c => c.type === 'self-correction'),
    noOperationalRegression: !Object.values(cronStatus).some(s => s.consecutiveErrors > 5),
  },
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  AUTONOMY EXPERIMENT MONITOR — ' + report.timestamp.substring(0, 16));
  console.log('═══════════════════════════════════════════════════════');
  console.log();

  console.log('▸ RUNS');
  for (const [agent, stats] of Object.entries(report.runsByAgent)) {
    console.log(`  ${agent.padEnd(12)} acted: ${stats.acted}  skipped: ${stats.skipped}  error: ${stats.error}  total: ${stats.total}`);
  }
  if (Object.keys(report.runsByAgent).length === 0) console.log('  (no runs yet)');
  console.log();

  console.log('▸ DELTA-GATING');
  console.log(`  Skip rate: ${report.deltaGating.skipRate} (${report.deltaGating.totalSkips} skipped / ${report.deltaGating.totalActs} acted)`);
  console.log();

  console.log('▸ MESSAGE DIVERSITY');
  for (const [type, count] of Object.entries(report.messageDiversity.typeCounts).sort((a, b) => b[1] - a[1])) {
    const marker = autonomyTypes.includes(type) ? ' ★' : '';
    console.log(`  ${type.padEnd(18)} ${count}${marker}`);
  }
  if (report.messageDiversity.autonomyMessageCount > 0) {
    console.log(`\n  ★ = autonomy type (${report.messageDiversity.autonomyMessageCount} total)`);
    console.log('  Recent autonomy messages:');
    for (const m of report.messageDiversity.autonomyMessages) {
      console.log(`    [${m.from}→${m.to || 'ALL'}] ${m.type}: ${m.message}`);
    }
  }
  console.log();

  console.log('▸ ATLAS STRUCTURE DIVERSITY');
  console.log(`  ${report.atlasStructureDiversity.uniqueStructures} unique structures in ${report.atlasStructureDiversity.recentAtlasCount} recent atlases`);
  for (const s of report.atlasStructureDiversity.structures) {
    console.log(`    "${s.substring(0, 80)}${s.length > 80 ? '...' : ''}"`);
  }
  console.log();

  console.log('▸ STUCK REMEDIATION');
  if (report.stuckRemediation.resolved) {
    console.log('  No stuck loops ✓');
  } else {
    for (const t of report.stuckRemediation.stuckTargets) {
      console.log(`  ✗ ${t.target} — ${t.failedAttempts} failed attempts`);
    }
  }
  console.log();

  console.log('▸ GROWTH');
  console.log(`  Current wave: ${report.growth.currentWave}  Target: ${report.growth.growthTarget} cells`);
  console.log(`  Waves since experiment: ${report.growth.wavesSinceExperiment}`);
  for (const w of report.growth.recentWaves) {
    console.log(`    Wave ${w.wave}: ${w.counties?.join(', ')} (${w.at?.substring(0, 16)})`);
  }
  console.log();

  console.log('▸ CRON HEALTH');
  for (const [agent, s] of Object.entries(report.cronHealth)) {
    const status = s.enabled ? (s.consecutiveErrors > 0 ? `⚠ ${s.consecutiveErrors} errors` : '✓ ok') : '✗ disabled';
    console.log(`  ${agent.padEnd(12)} ${status.padEnd(18)} next: ${s.nextRunIn}  last: ${s.lastStatus}`);
  }
  console.log();

  console.log('▸ SUCCESS CRITERIA');
  const criteria = report.successCriteria;
  console.log(`  ${criteria.deltaGatingWorks ? '✓' : '○'} Delta-gating working (agents skip when no change)`);
  console.log(`  ${criteria.autonomyMessagePosted ? '✓' : '○'} Autonomy message posted (hypothesis/challenge/meta/self-correction)`);
  console.log(`  ${criteria.atlasStructureVaried ? '✓' : '○'} Atlas structure varied (≥3 distinct formats)`);
  console.log(`  ${criteria.architectDeclinedRemediation ? '✓' : '○'} ARCHITECT declined a remediation with reasoning`);
  console.log(`  ${criteria.selfCorrectionOccurred ? '✓' : '○'} Self-correction occurred`);
  console.log(`  ${criteria.noOperationalRegression ? '✓' : '○'} No operational regression (≤5 consecutive errors)`);
  console.log();
  console.log('═══════════════════════════════════════════════════════');
}
