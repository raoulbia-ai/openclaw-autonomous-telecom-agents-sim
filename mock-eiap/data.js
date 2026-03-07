/**
 * Synthetic network definitions — static topology only.
 *
 * Network: 3 sites, 4 cells each = 12 NRCellDU entities (Dublin area).
 *
 * Exports:
 *   topology  — pre-built EIAP topology/relationship responses (static)
 *   cells     — flat [{id, site, localId}] for use by world modules
 *   SITES     — site definitions [{id, lat, lon}]
 *   CELLS     — raw cell tuples [siteIdx, localId, nRPCI, nRTAC]
 *   cellUrn   — URN builder function
 *   sectorUrn — URN builder function
 *
 * PM counters and alarms are now generated dynamically by world/pm-generator.js
 * and world/alarm-generator.js respectively.
 */

// Allow switching to the generated Ireland dataset without touching any other files
if (process.env.DATA_SET === 'ireland') {
  try { module.exports = require('./data-ireland'); return; }
  catch (e) { console.warn('[data] data-ireland.js not found — run build-ireland.js first, falling back to default'); }
}

const BASE_DN = 'SubNetwork=Ireland,MeContext={site},ManagedElement=1,GNBDUFunction=1';

const SITES = [
  { id: 'Site1-Dublin-North', lat: 53.38, lon: -6.26 },
  { id: 'Site2-Dublin-South', lat: 53.30, lon: -6.24 },
  { id: 'Site3-Dublin-West',  lat: 53.34, lon: -6.38 },
];

// [site_index, local_id, nRPCI, nRTAC]
const CELLS = [
  [0, 1, 10, 100], [0, 2, 11, 100], [0, 3, 12, 100], [0, 4, 13, 100],
  [1, 5, 20, 200], [1, 6, 21, 200], [1, 7, 22, 200], [1, 8, 23, 200],
  [2, 9, 30, 300], [2, 10, 31, 300], [2, 11, 32, 300], [2, 12, 33, 300],
];


function cellUrn(siteId, localId) {
  return `urn:3gpp:dn:${BASE_DN.replace('{site}', siteId)},NRCellDU=${localId}`;
}

function sectorUrn(siteId, localId) {
  return `urn:3gpp:dn:${BASE_DN.replace('{site}', siteId)},NRSectorCarrier=${localId}`;
}

/**
 * Flat cell list for use by world modules (event engine, PM/alarm generators).
 * @returns {Array<{id, site, localId}>}
 */
function buildCells() {
  return CELLS.map(([siteIdx, localId]) => ({
    id:      cellUrn(SITES[siteIdx].id, localId),
    site:    SITES[siteIdx].id,
    localId,
  }));
}

function buildTopology() {
  const cells = [];
  const relationships = [];

  for (const [siteIdx, localId, nrpci, nrtac] of CELLS) {
    const site = SITES[siteIdx];
    const urn = cellUrn(site.id, localId);

    cells.push({
      id: urn,
      attributes: { cellLocalId: localId, nCI: 10000 + localId, nRPCI: nrpci, nRTAC: nrtac },
      decorators: { site: site.id, lat: site.lat, lon: site.lon },
      classifiers: [],
      sourceIds: [urn],
      metadata: {
        reliabilityIndicator: 'OK',
        firstDiscovered: '2025-06-01T00:00:00Z',
        lastModified: '2026-03-01T00:00:00Z',
      },
    });

    relationships.push({
      id: `urn:rel:NRCELLDU_USES_NRSECTORCARRIER:${localId}`,
      aSide: urn,
      bSide: sectorUrn(site.id, localId),
      metadata: {
        reliabilityIndicator: 'OK',
        firstDiscovered: '2025-06-01T00:00:00Z',
        lastModified: '2026-03-01T00:00:00Z',
      },
    });
  }

  return {
    cells: {
      items: cells.map(c => ({ 'o-ran-smo-teiv-ran:NRCellDU': [c] })),
      totalCount: cells.length,
      _links: { self: { href: '/topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities' } },
    },
    relationships: {
      items: relationships.map(r => ({ 'o-ran-smo-teiv-ran:NRCELLDU_USES_NRSECTORCARRIER': [r] })),
      totalCount: relationships.length,
      _links: { self: { href: '/topology-inventory/v1/domains/RAN/relationship-types/NRCELLDU_USES_NRSECTORCARRIER/relationships' } },
    },
  };
}

module.exports = {
  topology:  buildTopology(),
  cells:     buildCells(),
  SITES,
  CELLS,
  cellUrn,
  sectorUrn,
};
