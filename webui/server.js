/**
 * NKA PoC — Web UI backend
 * Serves the React app, exposes artifact API endpoints, handles auth.
 *
 * Usage:
 *   SESSION_SECRET=<secret> node server.js
 *   or: copy .env.example to .env and fill in values
 */

require('dotenv').config({ path: __dirname + '/.env' });

const express    = require('express');
const session    = require('express-session');
const helmet     = require('helmet');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const { spawn }  = require('child_process');
const { marked }  = require('marked');
const https      = require('https');
const http       = require('http');
const db         = require('./db');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'NKA-PoC/1.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject).setTimeout(8000, function() { this.destroy(); });
  });
}

const app  = express();
const PORT = process.env.PORT || 3000;

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
const ATLAS_DIR     = ARTIFACTS_DIR;  // atlas files now live in artifacts/
const AGENTS_DIR    = path.join(__dirname, '..', 'agents');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Security headers (relaxed CSP for inline styles used by Tailwind/React)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.openfreemap.org"],
      connectSrc: ["'self'", "https://*.openfreemap.org"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

// CORS — allow both HTTPS URLs (with and without port)
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN || 'https://your-domain.example.com',
  'https://your-domain.example.com:9000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Request logger — appends to webui/data/access.log
const ACCESS_LOG = path.join(__dirname, 'data', 'access.log');
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const line = [
      new Date().toISOString(),
      req.ip,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${Date.now() - start}ms`,
      req.get('user-agent') || '-',
    ].join(' | ');
    fs.appendFile(ACCESS_LOG, line + '\n', () => {});
  });
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: fs.existsSync(path.join(__dirname, '..', 'certs', 'fullchain.pem')),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

const OPEN_PATHS = ['/api/login', '/api/register', '/login'];

function requireAuth(req, res, next) {
  if (OPEN_PATHS.includes(req.path)) return next();
  if (req.session?.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/login');
}

app.use(requireAuth);

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'auth.html'));
});

app.post('/api/register', (req, res) => {
  const { email, password, displayName } = req.body;
  try {
    const user = db.register(email, password, displayName);
    res.json({ ok: true, email: user.email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.authenticate(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  req.session.displayName = user.displayName;
  res.json({ ok: true, email: user.email, displayName: user.displayName });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({
    email: req.session.userEmail,
    displayName: req.session.displayName,
  });
});

// ---------------------------------------------------------------------------
// Artifact API
// ---------------------------------------------------------------------------

function readArtifact(name) {
  const file = path.join(ARTIFACTS_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

app.get('/api/llm/status', requireAuth, async (req, res) => {
  // Check local Ollama (LLM provider for NKA agents)
  // Uses /v1/models endpoint — no auth needed on localhost
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch('http://127.0.0.1:11434/v1/models', {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    res.json({ reachable: r.ok });
  } catch {
    res.json({ reachable: false });
  }
});

app.get('/api/agent-schedules', (req, res) => {
  const CRON_IDS = {
    'cef2fd4d-46de-426e-88d5-878353737b93': 'SENTINEL',
    '42104c61-d970-4b9f-9cd8-51dafc73e6b2': 'ORACLE',
    '62036869-c613-4bf0-a9e9-8852f40494ef': 'ARCHITECT',
  };
  try {
    const jobsPath = path.join(process.env.HOME, '.openclaw-ata/cron/jobs.json');
    const data = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    const schedules = {};
    for (const job of data.jobs || []) {
      const agent = CRON_IDS[job.id];
      if (!agent) continue;
      const state = job.state || {};
      const everyMs = job.schedule?.everyMs;
      schedules[agent] = {
        enabled: job.enabled,
        everyMs,
        nextRunAtMs: state.nextRunAtMs,
        lastRunStatus: state.lastRunStatus || state.lastStatus,
        lastRunAtMs: state.lastRunAtMs,
      };
    }
    res.json(schedules);
  } catch {
    res.json({});
  }
});

app.get('/api/status', (req, res) => {
  const artifacts = ['topology', 'performance', 'alarms', 'signals'];
  const status = {};
  for (const name of artifacts) {
    const file = path.join(ARTIFACTS_DIR, `${name}.json`);
    status[name] = fs.existsSync(file)
      ? { exists: true, mtime: fs.statSync(file).mtime }
      : { exists: false };
  }
  const atlasFile = path.join(ATLAS_DIR, 'network-atlas.md');
  status.atlas = fs.existsSync(atlasFile)
    ? { exists: true, mtime: fs.statSync(atlasFile).mtime }
    : { exists: false };
  res.json(status);
});

app.get('/api/topology',    (req, res) => { const d = readArtifact('topology');    d ? res.json(d) : res.status(404).json({ error: 'Not found' }); });
app.get('/api/performance', (req, res) => { const d = readArtifact('performance'); d ? res.json(d) : res.status(404).json({ error: 'Not found' }); });
app.get('/api/alarms',      (req, res) => { const d = readArtifact('alarms');      d ? res.json(d) : res.status(404).json({ error: 'Not found' }); });
app.get('/api/signals',     (req, res) => { const d = readArtifact('signals');     d ? res.json(d) : res.status(404).json({ error: 'Not found' }); });

// ---------------------------------------------------------------------------
// External intelligence — weather + events (used by ORACLE in its analysis)
// ---------------------------------------------------------------------------

app.get('/api/weather', requireAuth, async (req, res) => {
  try {
    const [weather, warnings] = await Promise.all([
      fetchJson('https://api.open-meteo.com/v1/forecast?latitude=53.3498&longitude=-6.2603&current=temperature_2m,wind_speed_10m,precipitation,weather_code&forecast_days=1'),
      fetchJson('https://www.met.ie/Open_Data/json/warning_IRELAND.json').catch(() => []),
    ]);
    const c = weather.current ?? {};
    const risk = c.precipitation > 5 ? 'high' : c.wind_speed_10m > 40 ? 'medium' : 'none';
    res.json({
      temp_c:    c.temperature_2m,
      wind_kmh:  c.wind_speed_10m,
      precip_mm: c.precipitation,
      code:      c.weather_code,
      risk,
      warnings:  Array.isArray(warnings) ? warnings.map(w => ({
        headline:  w.headline ?? w.title ?? '',
        level:     w.level ?? w.severity ?? '',
        regions:   w.regions ?? [],
        validFrom: w.onset ?? w.validFrom ?? '',
        validTo:   w.expiry ?? w.validTo ?? '',
      })) : [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/traffic', requireAuth, async (req, res) => {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) {
    return res.json({ configured: false, incidents: [], message: 'Add TOMTOM_API_KEY to .env to enable traffic intelligence.' });
  }
  try {
    // Ireland bounding box: minLon,minLat,maxLon,maxLat
    const bbox = '-10.5,51.3,-5.5,55.4';
    const fields = '{incidentDetails{fields{id,type,magnitudeOfDelay,from,to,length,delay,roadNumbers,events{description,code,iconCategory}}}}';
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${key}&bbox=${encodeURIComponent(bbox)}&fields=${encodeURIComponent(fields)}&language=en-GB`;
    const data = await fetchJson(url);
    const DELAY_LABEL = { 0: 'unknown', 1: 'minor', 2: 'moderate', 3: 'major', 4: 'severe' };
    const ICON_LABEL  = { 1: 'Accident', 2: 'Fog', 3: 'Hazard', 4: 'Rain', 5: 'Ice',
                          6: 'Congestion', 7: 'Lane closed', 8: 'Road closed',
                          9: 'Road works', 10: 'Wind', 11: 'Flooding', 14: 'Breakdown' };
    const incidents = (data.incidents ?? [])
      .filter(inc => (inc.properties?.magnitudeOfDelay ?? 0) >= 2)
      .map(inc => {
        const p = inc.properties ?? {};
        const coords = inc.geometry?.coordinates;
        const pt = Array.isArray(coords?.[0]) ? coords[0] : (coords ?? []);
        return {
          severity:    DELAY_LABEL[p.magnitudeOfDelay] ?? 'unknown',
          type:        ICON_LABEL[p.events?.[0]?.iconCategory] ?? 'Incident',
          description: p.events?.[0]?.description ?? '',
          from:        p.from ?? '',
          to:          p.to ?? '',
          roads:       p.roadNumbers ?? [],
          delay_s:     p.delay ?? null,
          length_m:    p.length ?? null,
          lat:         pt[1] ?? null,
          lon:         pt[0] ?? null,
        };
      })
      .slice(0, 10);
    res.json({ configured: true, incidents, fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ configured: true, error: e.message, incidents: [] });
  }
});

app.get('/api/events', requireAuth, async (req, res) => {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) {
    return res.json({ configured: false, events: [], message: 'Add TICKETMASTER_API_KEY to .env to enable event intelligence.' });
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?countryCode=IE&size=10&startDateTime=${today}T00:00:00Z&endDateTime=${tomorrow}T23:59:59Z&sort=date,asc&apikey=${key}`;
    const data = await fetchJson(url);
    const events = (data._embedded?.events ?? []).map(e => ({
      name:   e.name,
      date:   e.dates?.start?.localDate,
      time:   e.dates?.start?.localTime,
      venue:  e._embedded?.venues?.[0]?.name ?? '',
      city:   e._embedded?.venues?.[0]?.city?.name ?? '',
      lat:    parseFloat(e._embedded?.venues?.[0]?.location?.latitude ?? 0),
      lon:    parseFloat(e._embedded?.venues?.[0]?.location?.longitude ?? 0),
      capacity: null, // not in free tier
    }));
    res.json({ configured: true, events, fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ configured: true, error: e.message, events: [] });
  }
});

app.get('/api/external-context', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'external-context.json');
  if (!fs.existsSync(file)) return res.json(null);
  try { res.json(JSON.parse(fs.readFileSync(file))); }
  catch { res.json(null); }
});

app.get('/api/remediation', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'remediation-log.jsonl');
  if (!fs.existsSync(file)) return res.json([]);
  try {
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
    res.json(lines.map(l => JSON.parse(l)).reverse().slice(0, 50));
  } catch { res.json([]); }
});

app.get('/api/state', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'state.json');
  if (!fs.existsSync(file)) return res.json({});
  try { res.json(JSON.parse(fs.readFileSync(file))); }
  catch { res.json({}); }
});

app.get('/api/memory', requireAuth, (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'memory.json')))); }
  catch { res.status(404).json({ error: 'no memory yet' }); }
});

app.get('/api/growth-log', requireAuth, (req, res) => {
  // Primary source: growth-log.json (written by log-growth.js)
  let waves = [];
  const file = path.join(ARTIFACTS_DIR, 'growth-log.json');
  if (fs.existsSync(file)) {
    try { waves = JSON.parse(fs.readFileSync(file)); } catch {}
  }

  // Secondary source: agent-comms.jsonl growth entries (written by ARCHITECT directly)
  // Merge any growth comms that log-growth.js missed
  const commsFile = path.join(ARTIFACTS_DIR, 'agent-comms.jsonl');
  if (fs.existsSync(commsFile)) {
    try {
      const knownWaves = new Set(waves.map(w => w.wave));
      const lines = fs.readFileSync(commsFile, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'growth') continue;
          const msg = entry.message || '';
          const waveMatch = msg.match(/wave\s+(\d+)/i);
          if (!waveMatch) continue;
          const waveNum = parseInt(waveMatch[1]);
          if (knownWaves.has(waveNum)) continue;
          // Extract counties from message like "Added Cork, Galway, Limerick."
          const countiesMatch = msg.match(/Added\s+(.+?)\./i);
          const counties = countiesMatch ? countiesMatch[1].split(/,\s*/) : [];
          waves.push({
            at: entry.at,
            wave: waveNum,
            sitesAdded: counties.length,
            cellsAdded: counties.length,
            counties,
            note: msg,
          });
          knownWaves.add(waveNum);
        } catch {}
      }
    } catch {}
  }

  waves.sort((a, b) => (a.wave || 0) - (b.wave || 0));
  res.json(waves);
});

app.get('/api/city-params', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'city-params.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  try { res.json(JSON.parse(fs.readFileSync(file))); }
  catch { res.status(500).json({ error: 'read error' }); }
});

app.get('/api/agent-comms', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'agent-comms.jsonl');
  if (!fs.existsSync(file)) return res.json([]);
  try {
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.json(entries.reverse());
  } catch { res.json([]); }
});

app.get('/api/heartbeat', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'heartbeat-log.jsonl');
  if (!fs.existsSync(file)) return res.json([]);
  try {
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.json(entries.reverse()); // newest first
  } catch { res.json([]); }
});

app.get('/api/memory/history', requireAuth, (req, res) => {
  const file = path.join(ARTIFACTS_DIR, 'memory-history.json');
  if (!fs.existsSync(file)) return res.json([]);
  try { res.json(JSON.parse(fs.readFileSync(file))); }
  catch { res.json([]); }
});

app.get('/api/atlas', (req, res) => {
  const file = path.join(ATLAS_DIR, 'network-atlas.md');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Atlas not generated yet' });
  const md = fs.readFileSync(file, 'utf8');
  res.json({ markdown: md, html: marked(md), mtime: fs.statSync(file).mtime });
});

app.get('/api/atlas/history', requireAuth, (req, res) => {
  const histDir = path.join(ARTIFACTS_DIR, 'atlas-history');
  if (!fs.existsSync(histDir)) return res.json([]);
  const files = fs.readdirSync(histDir).filter(f => f.startsWith('atlas-') && f.endsWith('.md')).sort().reverse();
  res.json(files.map(f => ({
    id: f.replace('.md', ''),
    mtime: fs.statSync(path.join(histDir, f)).mtime,
  })));
});

app.get('/api/atlas/history/:id', requireAuth, (req, res) => {
  const safe = path.basename(req.params.id);
  const file = path.join(ARTIFACTS_DIR, 'atlas-history', `${safe}.md`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  const md = fs.readFileSync(file, 'utf8');
  res.json({ markdown: md, html: marked(md), mtime: fs.statSync(file).mtime, id: safe });
});

// ---------------------------------------------------------------------------
// Trigger endpoints — stream stdout back to client via SSE
// ---------------------------------------------------------------------------

function streamProcess(res, cmd, args, cwd, env = {}) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  child.stdout.on('data', d => send({ type: 'log', text: d.toString() }));
  child.stderr.on('data', d => send({ type: 'log', text: d.toString() }));
  child.on('close', code => {
    send({ type: 'done', code });
    res.end();
  });
}

app.post('/api/inject-fault', requireAuth, (req, res) => {
  const { cellId, durationCycles = 6 } = req.body;
  if (!cellId) return res.status(400).json({ error: 'cellId required' });
  const wsFile = path.join(__dirname, '..', 'mock-eiap', 'world', 'world-state.json');
  if (!fs.existsSync(wsFile)) return res.status(404).json({ error: 'world-state not found' });
  try {
    const ws = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
    // Remove any existing forced event on this cell
    ws.events = (ws.events || []).filter(e => !(e.cellId === cellId && e.forced));
    ws.events.push({
      id: `forced-${Date.now()}`,
      cellId,
      forced: true,
      type: 'degraded',
      severity: 'MAJOR',
      specificProblem: 'DL throughput degraded',
      startedAt: new Date().toISOString(),
      expiresAfterCycles: durationCycles,
      cyclesSeen: 0,
      dlThpMultiplier: 0.25,
      errorRateAdd: 8,
      availabilityMul: 0.85,
    });
    const tmp = wsFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(ws, null, 2));
    fs.renameSync(tmp, wsFile);
    res.json({ ok: true, cellId, durationCycles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/collect', (req, res) => {
  const scriptPath = path.join(AGENTS_DIR, 'nka', 'scripts', 'collect.sh');
  streamProcess(res, 'bash', [scriptPath], path.join(__dirname, '..'));
});

app.post('/api/atlas/run', (req, res) => {
  // Atlas is now generated autonomously by the NKA heartbeat (openclaw cron).
  // Manual trigger: run the heartbeat immediately.
  streamProcess(res, 'openclaw', ['cron', 'run', '2806a46e-cffd-4c59-b7bc-33f3cac23c69'], path.join(__dirname, '..'));
});

// ---------------------------------------------------------------------------
// Live agent stream (SSE) — tails raw-stream.jsonl
// ---------------------------------------------------------------------------

const RAW_STREAM_PATH = path.join(
  process.env.HOME, '.openclaw-ata', 'logs', 'raw-stream.jsonl'
);

// Map runId → agent name by checking gateway log for the most recent cron start
const CRON_AGENTS = {
  'cef2fd4d-46de-426e-88d5-878353737b93': 'SENTINEL',
  '42104c61-d970-4b9f-9cd8-51dafc73e6b2': 'ORACLE',
  '62036869-c613-4bf0-a9e9-8852f40494ef': 'ARCHITECT',
};

// Track active runId → agent mapping (detected from content)
const runIdToAgent = {};

// Detect agent from accumulated text
const AGENT_PATTERNS = [
  [/SENTINEL/i, 'SENTINEL'],
  [/ORACLE/i, 'ORACLE'],
  [/ARCHITECT/i, 'ARCHITECT'],
];

function detectAgent(text) {
  for (const [re, name] of AGENT_PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}

// Track text per runId for detection (capped to prevent memory leak)
const runIdText = {};
const MAX_RUN_IDS = 50;
function evictOldRuns() {
  const keys = Object.keys(runIdText);
  if (keys.length > MAX_RUN_IDS) {
    for (const k of keys.slice(0, keys.length - MAX_RUN_IDS)) {
      delete runIdText[k];
      delete runIdToAgent[k];
    }
  }
}

app.get('/api/agent-stream', (req, res) => {
  if (!fs.existsSync(RAW_STREAM_PATH)) {
    return res.status(404).json({ error: 'Raw stream log not found. Enable OPENCLAW_RAW_STREAM=1' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':\n\n'); // SSE comment to keep alive

  // Send recent history (last 500 lines) — first pass to detect agents
  const existing = fs.readFileSync(RAW_STREAM_PATH, 'utf8').trim().split('\n').slice(-500);
  for (const line of existing) {
    try {
      const d = JSON.parse(line);
      if (d.event === 'assistant_text_stream' && d.delta && d.runId) {
        runIdText[d.runId] = (runIdText[d.runId] || '') + d.delta;
        if (!runIdToAgent[d.runId]) {
          const detected = detectAgent(runIdText[d.runId]);
          if (detected) runIdToAgent[d.runId] = detected;
        }
      }
    } catch {}
  }
  evictOldRuns();
  // Second pass to send with detected agents
  for (const line of existing) {
    try {
      const d = JSON.parse(line);
      const agent = runIdToAgent[d.runId] || 'UNKNOWN';
      res.write(`data: ${JSON.stringify({ ...d, agent })}\n\n`);
    } catch {}
  }

  let lastSize = fs.statSync(RAW_STREAM_PATH).size;

  const interval = setInterval(() => {
    try {
      const stat = fs.statSync(RAW_STREAM_PATH);
      // Handle log rotation/truncation
      if (stat.size < lastSize) {
        lastSize = 0;
      }
      if (stat.size > lastSize) {
        const fd = fs.openSync(RAW_STREAM_PATH, 'r');
        const buf = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        lastSize = stat.size;
        const newLines = buf.toString('utf8').trim().split('\n');
        for (const line of newLines) {
          try {
            const d = JSON.parse(line);
            if (d.event === 'assistant_text_stream' && d.delta && d.runId) {
              runIdText[d.runId] = (runIdText[d.runId] || '') + d.delta;
              if (!runIdToAgent[d.runId]) {
                const detected = detectAgent(runIdText[d.runId]);
                if (detected) runIdToAgent[d.runId] = detected;
              }
            }
            const agent = runIdToAgent[d.runId] || 'UNKNOWN';
            res.write(`data: ${JSON.stringify({ ...d, agent })}\n\n`);
          } catch {}
        }
        evictOldRuns();
      }
    } catch {}
  }, 300);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// ---------------------------------------------------------------------------
// Serve React app
// ---------------------------------------------------------------------------

const DIST = path.join(__dirname, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*splat', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('Run `npm run build` in client/ to build the frontend.'));
}

// Start HTTPS if certs exist, otherwise HTTP
const TLS_CERT = path.join(__dirname, '..', 'certs', 'fullchain.pem');
const TLS_KEY  = path.join(__dirname, '..', 'certs', 'privkey.pem');

if (fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY)) {
  const tlsOpts = {
    cert: fs.readFileSync(TLS_CERT),
    key:  fs.readFileSync(TLS_KEY),
  };
  const server = https.createServer(tlsOpts, app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[webui] listening on https://0.0.0.0:${PORT}`);
  });

} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[webui] listening on http://0.0.0.0:${PORT}`);
  });
}
