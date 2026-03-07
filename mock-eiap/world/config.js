/**
 * World simulation parameters.
 * All tuneable values live here — no magic numbers elsewhere.
 *
 * FAST_MODE=1  — speeds up tick interval and event probabilities ~10x for dev/demo.
 */

'use strict';

// Allow switching to the generated Ireland config without touching any other files
if (process.env.DATA_SET === 'ireland') {
  try { module.exports = require('./config-ireland'); return; }
  catch (_) { /* config-ireland.js not generated yet — fall through */ }
}

const path = require('path');

const FAST_MODE = process.env.FAST_MODE === '1';
const FAST_MULT = 10;

module.exports = {
  WORLD_STATE_FILE: path.join(__dirname, '..', 'world-state.json'),

  // How often the event engine ticks
  TICK_INTERVAL_MS: FAST_MODE ? 30_000 : 5 * 60_000,

  // Per-tick spawn probability for each event type
  // Normal mode: ~288 ticks/day → equipment_fault ~0.86/day
  SPAWN_PROBABILITY: {
    equipment_fault: FAST_MODE ? 0.003 * FAST_MULT : 0.003,
    interference:    FAST_MODE ? 0.002 * FAST_MULT : 0.002,
    backhaul_fault:  FAST_MODE ? 0.001 * FAST_MULT : 0.001,
    maintenance:     FAST_MODE ? 0.002 * FAST_MULT : 0.002,
  },

  // Event duration ranges [min_minutes, max_minutes]
  EVENT_DURATION_MINUTES: {
    equipment_fault: [120, 480],  // 2–8 hours
    interference:    [180, 720],  // 3–12 hours
    backhaul_fault:  [30,  240],  // 30 min–4 hours
    maintenance:     [20,   60],  // 20–60 min
  },

  // Max concurrent active events per type (prevents simultaneous chaos)
  MAX_CONCURRENT: {
    equipment_fault: 2,
    interference:    1,
    backhaul_fault:  1,
    maintenance:     2,
  },

  // Probability a resolved equipment_fault leaves a ghost alarm
  GHOST_ALARM_PROBABILITY: 0.25,

  // How long a ghost alarm lingers [min_minutes, max_minutes]
  GHOST_ALARM_DURATION_MINUTES: [30, 120],

  // Per-request PM counter noise (±fraction applied after event effects)
  REQUEST_NOISE: 0.04,

  // How each event type degrades PM counters
  EVENT_EFFECTS: {
    equipment_fault: {
      dlThpCell:          { mode: 'scale', value: 0.12 },
      ulThpCell:          { mode: 'scale', value: 0.15 },
      errorRate:          { mode: 'set',   value: 14.7  },
      cellAvailTime:      { mode: 'set',   value: 91.2  },
      pmRrcConnEstabSucc: { mode: 'set',   value: 10    },
    },
    interference: {
      dlThpCell:  { mode: 'scale', value: 0.75 },
      ulThpCell:  { mode: 'scale', value: 0.80 },
      errorRate:  { mode: 'add',   value: 2.5  },
      cellAvailTime: { mode: 'set', value: 98.5 },
    },
    backhaul_fault: {
      dlThpCell:          { mode: 'scale', value: 0.25 },
      ulThpCell:          { mode: 'scale', value: 0.30 },
      errorRate:          { mode: 'set',   value: 8.0  },
      cellAvailTime:      { mode: 'set',   value: 85.0 },
      pmRrcConnEstabSucc: { mode: 'scale', value: 0.20 },
    },
    maintenance: {
      dlThpCell:          { mode: 'set', value: 0 },
      ulThpCell:          { mode: 'set', value: 0 },
      errorRate:          { mode: 'set', value: 0 },
      cellAvailTime:      { mode: 'set', value: 0 },
      pmRrcConnEstabSucc: { mode: 'set', value: 0 },
      pmRrcConnEstabAtt:  { mode: 'set', value: 0 },
    },
  },
};
