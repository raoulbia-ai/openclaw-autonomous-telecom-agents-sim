/**
 * World state persistence.
 * Reads and writes world-state.json — the shared state between event engine and server.
 *
 * The event engine writes; the server reads.
 * Both can call load() safely — returns null if file missing.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { WORLD_STATE_FILE } = require('./config');

/**
 * Initialise a fresh world state for the given cell list.
 * @param {Array<{id, site, localId}>} cells
 * @returns {object} initial state
 */
function init(cells) {
  return {
    version:    1,
    createdAt:  new Date().toISOString(),
    lastTickAt: null,
    tickCount:  0,
    events:     [],
  };
}

/**
 * Load world state from disk.
 * @returns {object|null} state, or null if file missing/corrupt
 */
function load() {
  if (!fs.existsSync(WORLD_STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(WORLD_STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Persist world state to disk (atomic write via temp file).
 * @param {object} state
 */
function save(state) {
  const tmp = WORLD_STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, WORLD_STATE_FILE);
}

module.exports = { init, load, save };
