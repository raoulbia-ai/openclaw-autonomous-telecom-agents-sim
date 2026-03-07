/**
 * EIAP Mock Server — schema-faithful mock of Ericsson EIAP APIs.
 *
 * Endpoints:
 *   POST /auth/realms/master/protocol/openid-connect/token  — OAuth 2.0 stub
 *   GET  /topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities
 *   GET  /topology-inventory/v1/domains/RAN/relationship-types/NRCELLDU_USES_NRSECTORCARRIER/relationships
 *   GET  /data-management/v1/pm/cells
 *   GET  /data-management/v1/fm/alarms
 *   GET  /network-configuration/v1/ch/:cmHandle/data/ds/:datastore
 *
 * Run: DATA_SET=ireland node mock-eiap/server.js  (from project root)
 */

const express        = require('express');
const data           = require('./data');
const worldState     = require('./world/world-state');
const pmGenerator    = require('./world/pm-generator');
const alarmGenerator = require('./world/alarm-generator');

// Cache world state for up to 5s to avoid disk reads on every rapid API call
let _wsCache = null;
let _wsCacheAt = 0;
const WS_CACHE_TTL = 5_000;

function getWorldState() {
  const now = Date.now();
  if (!_wsCache || now - _wsCacheAt > WS_CACHE_TTL) {
    _wsCache   = worldState.load();
    _wsCacheAt = now;
  }
  return _wsCache;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 8080;
const MOCK_TOKEN = 'mock-bearer-token';

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Bearer token' });
  }
  next();
}

// ---------------------------------------------------------------------------
// OAuth 2.0 stub
// ---------------------------------------------------------------------------

app.post('/auth/realms/master/protocol/openid-connect/token', (req, res) => {
  res.json({
    access_token: MOCK_TOKEN,
    token_type: 'Bearer',
    expires_in: 3600,
  });
});

// ---------------------------------------------------------------------------
// Topology & Inventory
// ---------------------------------------------------------------------------

app.get(
  '/topology-inventory/v1/domains/RAN/entity-types/NRCellDU/entities',
  requireAuth,
  (req, res) => res.json(data.topology.cells)
);

app.get(
  '/topology-inventory/v1/domains/RAN/relationship-types/NRCELLDU_USES_NRSECTORCARRIER/relationships',
  requireAuth,
  (req, res) => res.json(data.topology.relationships)
);

// ---------------------------------------------------------------------------
// Data Management — Performance Management
// ---------------------------------------------------------------------------

app.get('/data-management/v1/pm/cells', requireAuth, (req, res) => {
  res.json(pmGenerator.generate(data.cells, getWorldState(), new Date()));
});

// ---------------------------------------------------------------------------
// Data Management — Fault Management
// ---------------------------------------------------------------------------

app.get('/data-management/v1/fm/alarms', requireAuth, (req, res) => {
  res.json(alarmGenerator.generate(data.cells, getWorldState(), new Date()));
});

// ---------------------------------------------------------------------------
// Network Configuration — Express CM Access
// ---------------------------------------------------------------------------

app.get(
  '/network-configuration/v1/ch/:cmHandle/data/ds/:datastore',
  requireAuth,
  (req, res) => {
    res.json({
      cmHandle: req.params.cmHandle,
      datastore: req.params.datastore,
      publicCmHandleProperties: { neType: 'GNodeB' },
      state: { cmHandleState: 'READY', dataSyncEnabled: true },
      moduleSetTag: 'oran-sc-5g-v2',
      alternateId: `urn:3gpp:dn:MeContext=${req.params.cmHandle}`,
      dataProducerIdentifier: 'eiap-ncmp',
    });
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-eiap] listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock-eiap] DATA_SET=${process.env.DATA_SET || 'default'}`);
  console.log('[mock-eiap] endpoints ready');
});
