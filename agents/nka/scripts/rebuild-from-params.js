'use strict';
/**
 * rebuild-from-params.js — rebuild data-ireland.js from city-params.json.
 * Called by rebuild-network.sh.
 *
 * Accumulates zones across all growth waves via artifacts/accumulated-zones.json.
 * city-params.json only needs to contain the NEW zones for the current wave —
 * previous waves are preserved from the accumulated store.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '../../..');
const PARAMS      = path.join(ROOT, 'artifacts', 'city-params.json');
const ACCUMULATED = path.join(ROOT, 'artifacts', 'accumulated-zones.json');

const { buildNetwork, writeAll } = require(path.join(ROOT, 'mock-eiap', 'world', 'network-builder'));

const params = JSON.parse(fs.readFileSync(PARAMS, 'utf8'));

// Load previously accumulated zones (from all prior waves)
let accumulated = [];
if (fs.existsSync(ACCUMULATED)) {
  try { accumulated = JSON.parse(fs.readFileSync(ACCUMULATED, 'utf8')); } catch {}
}

// Map new zones from city-params into builder format
const newZones = (params.newZones || []).map(z => ({
  name:       z.site || z.name || `${z.county}-Site`,
  type:       z.type || 'suburban',
  lat:        z.lat,
  lon:        z.lon,
  radius_km:  z.radius_km || (z.type === 'urban' ? 3 : z.type === 'rural' ? 5 : 2),
  site_count: z.site_count || 1,
}));

// Merge: keep accumulated zones, add any new ones not already present
const existingNames = new Set(accumulated.map(z => z.name));
const toAdd = newZones.filter(z => !existingNames.has(z.name));
const allZones = [...accumulated, ...toAdd];

// Persist updated accumulated zones
fs.writeFileSync(ACCUMULATED, JSON.stringify(allZones, null, 2));

// Always start with the Dublin City Centre seed zone
const seedZone = {
  name: 'Dublin-City-Centre',
  type: 'urban',
  lat: 53.3498,
  lon: -6.2603,
  radius_km: 2.5,
  site_count: 10,
};

const design = {
  model:          params.model || 'growth',
  cells_per_site: params.cells_per_site || { urban: 5, suburban: 4, rural: 3, motorway: 3 },
  zones:          [seedZone, ...allZones],
  roads:          params.roads || [],
};

const { SITES, CELLS } = buildNetwork(design);
writeAll(design, SITES, CELLS, design.model);

console.log(`[rebuild-from-params] ${SITES.length} sites, ${CELLS.length} cells written (${accumulated.length} prior + ${toAdd.length} new zones)`);
