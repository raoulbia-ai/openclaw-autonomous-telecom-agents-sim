#!/usr/bin/env node
/**
 * Structured bulletin board posting for ATA agents.
 *
 * Validates message structure and appends to agent-comms.jsonl.
 * Extends the original 4 message types with hypothesis, challenge,
 * self-correction, and meta types to enable genuine inter-agent reasoning.
 *
 * Usage:
 *   node post-comms.js '{"agent":"ORACLE","type":"advisory","to":"ARCHITECT","message":"..."}'
 *
 * Required fields: agent, type, message
 * Optional fields: to, references[], cellId, siteId, topic
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const COMMS_FILE = path.join(__dirname, '..', '..', '..', 'artifacts', 'agent-comms.jsonl');

const REQUIRED_FIELDS = ['agent', 'type', 'message'];

const VALID_TYPES = [
  // Original ATA types
  'handoff',          // SENTINEL → ALL: raw observations from monitoring
  'atlas',            // ORACLE → ALL: status report written
  'advisory',         // ORACLE → ARCHITECT: specific recommendation
  'growth',           // ARCHITECT → ALL: growth wave executed

  // New autonomy types
  'hypothesis',       // Any → ALL: "I think X is causing Y" — testable claim
  'challenge',        // Any → specific agent: "I disagree because..."
  'self-correction',  // Any → ALL: "My previous assessment was wrong"
  'meta',             // Any → ALL: observation about the system's own behaviour
  'review_request',   // Any → specific agent: "Please investigate X"
  'remediation',      // ARCHITECT → ALL: remediation action taken or skipped
];

function postComms(entry) {
  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!entry[field]) throw new Error(`Missing required field: ${field}`);
  }

  if (!VALID_TYPES.includes(entry.type)) {
    throw new Error(`Invalid message type: "${entry.type}". Valid: ${VALID_TYPES.join(', ')}`);
  }

  // challenge and review_request need a target
  if (['challenge', 'review_request'].includes(entry.type) && !entry.to) {
    throw new Error(`type "${entry.type}" requires a "to" field`);
  }

  // hypothesis should have reasoning
  if (entry.type === 'hypothesis' && entry.message.length < 20) {
    throw new Error('hypothesis messages should contain substantive reasoning (min 20 chars)');
  }

  // Build the record
  const record = {
    at: new Date().toISOString(),
    from: entry.agent,
    to: entry.to || 'ALL',
    type: entry.type,
    message: entry.message,
  };

  // Optional fields
  if (entry.references) record.references = entry.references;
  if (entry.cellId) record.cellId = entry.cellId;
  if (entry.siteId) record.siteId = entry.siteId;
  if (entry.topic) record.topic = entry.topic;
  if (entry.challengeRef) record.challengeRef = entry.challengeRef;

  // Append
  fs.mkdirSync(path.dirname(COMMS_FILE), { recursive: true });
  fs.appendFileSync(COMMS_FILE, JSON.stringify(record) + '\n');

  return record;
}

module.exports = postComms;

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node post-comms.js \'{"agent":"ORACLE","type":"advisory","to":"ARCHITECT","message":"..."}\'');
    process.exit(1);
  }

  try {
    const entry = JSON.parse(input);
    const result = postComms(entry);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`[post-comms] Error: ${e.message}`);
    process.exit(1);
  }
}
