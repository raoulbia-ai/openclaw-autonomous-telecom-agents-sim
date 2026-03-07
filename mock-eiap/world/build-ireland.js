/**
 * World builder — LLM agent designs the Irish 5G network.
 *
 * The agent researches real Irish geography and decides:
 *   - Which cities and towns get coverage, and how dense
 *   - Which motorways and national roads get roadside cells
 *   - Zone types (urban/suburban/rural/motorway) and cell counts per site
 *   - Zone-specific event probabilities (e.g. rural = more equipment faults)
 *
 * The script then generates sites programmatically from those decisions
 * and writes data-ireland.js + config-ireland.js.
 *
 * Usage:
 *   OLLAMA_HOST=http://127.0.0.1:11434 node mock-eiap/world/build-ireland.js
 *
 * To activate:
 *   rm -f mock-eiap/world-state.json
 *   DATA_SET=ireland node mock-eiap/server.js
 *   DATA_SET=ireland node mock-eiap/world/event-engine.js
 */

'use strict';

const fs  = require('fs');
const path = require('path');

const OLLAMA_HOST = process.env.OLLAMA_HOST  || 'http://127.0.0.1:11434';
const MODEL       = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
const TIMEOUT_MS  = 300_000;

const ROOT       = path.join(__dirname, '..');
const OUT_DATA   = path.join(ROOT, 'data-ireland.js');
const OUT_CONFIG = path.join(ROOT, 'world', 'config-ireland.js');
const OUT_PARAMS = path.join(ROOT, '..', 'artifacts', 'city-params.json');

// ---------------------------------------------------------------------------
// Ollama call
// ---------------------------------------------------------------------------

async function ask(system, user) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  return (await res.json()).message.content;
}

// ---------------------------------------------------------------------------
// Extract JSON from LLM response (handles markdown fences etc.)
// ---------------------------------------------------------------------------

function extractJSON(text) {
  try { return JSON.parse(text.trim()); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenced) try { return JSON.parse(fenced[1].trim()); } catch {}
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  throw new Error('Could not extract JSON from:\n' + text.slice(0, 600));
}

const { buildNetwork, writeAll } = require('./network-builder');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[build-ireland] model: ${MODEL}`);
  console.log('[build-ireland] asking agent to design Irish 5G network...\n');

  const raw = await ask(
    `You are a senior telecom network planning engineer. You design 5G NR networks for Ireland.
Output only valid JSON. No markdown. No explanation. No text outside the JSON object.`,

    `Design a 5G network for Ireland. Output one JSON object, nothing else.

Schema:
{
  "description": "one sentence",
  "zones": [
    { "name": "Dublin-City-Centre", "type": "urban", "lat": 53.3498, "lon": -6.2603, "radius_km": 2.5, "site_count": 50 }
  ],
  "roads": [
    { "name": "M50", "waypoints": [[53.405,-6.435],[53.295,-6.390],[53.245,-6.210],[53.290,-6.090]], "site_spacing_km": 1.5 }
  ],
  "cells_per_site": { "urban": 6, "suburban": 4, "rural": 3, "motorway": 3 },
  "event_probabilities": {
    "urban":    { "equipment_fault": 0.004, "interference": 0.006, "backhaul_fault": 0.002, "maintenance": 0.003 },
    "suburban": { "equipment_fault": 0.003, "interference": 0.003, "backhaul_fault": 0.002, "maintenance": 0.002 },
    "rural":    { "equipment_fault": 0.005, "interference": 0.001, "backhaul_fault": 0.003, "maintenance": 0.001 },
    "motorway": { "equipment_fault": 0.003, "interference": 0.002, "backhaul_fault": 0.004, "maintenance": 0.002 }
  }
}

Rules:
- 30-50 zones total covering all of Ireland (Dublin, Cork, Limerick, Galway, Waterford, county towns, rural areas)
- site_count per zone: urban 30-80, suburban 10-40, rural 3-10
- Accurate Irish WGS84 coords (lat 51.4-55.4, lon -10.6 to -5.4)
- 8-12 roads: M1 M3 M4 M6 M7 M8 M9 M11 M17 M18 M50 N25 — waypoints follow real road curves
- Output JSON only.`
  );

  console.log('[build-ireland] agent responded, parsing...');

  let design;
  try {
    design = extractJSON(raw);
  } catch (err) {
    console.error('[build-ireland] JSON parse failed:', err.message);
    console.error('[build-ireland] raw snippet:\n', raw.slice(0, 800));
    process.exit(1);
  }

  const zoneCount = design.zones?.length    || 0;
  const roadCount = design.roads?.length    || 0;
  const expectedSites = (design.zones || []).reduce((s, z) => s + (z.site_count || 0), 0);

  console.log(`[build-ireland] agent designed: ${zoneCount} zones, ${roadCount} roads (~${expectedSites} zone sites)`);
  if (design.description) console.log(`[build-ireland] agent notes: ${design.description}`);

  console.log('\n[build-ireland] generating sites and cells...');
  const { SITES, CELLS } = buildNetwork(design);

  const zoneSummary = {};
  for (const s of SITES) zoneSummary[s.zone] = (zoneSummary[s.zone] || 0) + 1;
  const CPZ = design.cells_per_site || { urban: 6, suburban: 4, rural: 3, motorway: 3 };
  for (const [z, n] of Object.entries(zoneSummary))
    console.log(`  ${z.padEnd(10)}: ${n} sites × ${CPZ[z]||3} cells = ${n * (CPZ[z]||3)}`);
  console.log(`  TOTAL     : ${SITES.length} sites, ${CELLS.length} cells`);

  writeAll(design, SITES, CELLS, MODEL);
  console.log('\n[build-ireland] → mock-eiap/data-ireland.js');
  console.log('[build-ireland] → mock-eiap/world/config-ireland.js');

  fs.writeFileSync(OUT_PARAMS, JSON.stringify({
    generatedAt:  new Date().toISOString(),
    model:        MODEL,
    totalSites:   SITES.length,
    totalCells:   CELLS.length,
    zoneBreakdown: zoneSummary,
    agentDesign:  design,
  }, null, 2));
  console.log('[build-ireland] → artifacts/city-params.json');

  console.log('\n[build-ireland] done!');
  console.log('\nTo activate:');
  console.log('  rm -f mock-eiap/world-state.json');
  console.log('  DATA_SET=ireland node mock-eiap/server.js &');
  console.log('  DATA_SET=ireland node mock-eiap/world/event-engine.js &');
}

main().catch(err => { console.error('[build-ireland] fatal:', err.message); process.exit(1); });
