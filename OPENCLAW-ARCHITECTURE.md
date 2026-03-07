# OpenClaw Architecture — How It Works and How to Code For It

Findings from the NKA autonomy experiment. Verified through systematic testing across 100+ production cycles and three controlled experiments.

---

## What OpenClaw Is

OpenClaw is an autonomous agent runtime built on top of an LLM (here: minimax-m2.5 via llama.cpp). It manages:
- **Agent definitions** — persona, tools, allowed/denied capabilities
- **Cron scheduling** — fires agents on a timer with a message payload
- **Session isolation** — each cron run gets a fresh context window
- **Bootstrap injection** — automatically injects workspace files into every session
- **Gateway** — routes requests to LLM providers, handles auth, manages sessions

OpenClaw is the technical foundation of **OpenClawCity** — a design pattern where agents are given identity, role, and context, and are expected to "start living" without step-by-step instructions.

---

## Session Bootstrap Order

Every agent session receives context in this order. Understanding this order is essential — earlier layers override later ones if they conflict, and earlier layers are read first by the model.

```
1. SOUL.md          — identity, behaviour rules, tool list
2. MEMORY.md        — persistent shared memory (always injected)
3. HEARTBEAT.md     — per-agent session briefing (role + workspace)
4. [Cron message]   — the user-turn payload that triggered the session
5. [Agent tools]    — available tool definitions
```

**SOUL.md and MEMORY.md are always injected** by the OpenClaw gateway, regardless of what the cron message says. The cron message is the "user turn" that starts the conversation — it is the last thing the model reads before generating its first response.

---

## The Four Prescription Layers (NKA's Architecture)

When we built NKA, we discovered four separate places that were prescribing agent behaviour:

| Layer | File | Content | Mechanism |
|-------|------|---------|-----------|
| 1 (deepest) | `SOUL.md` | "Read HEARTBEAT.md and follow it precisely / do not improvise" | Always injected as system context |
| 2 | `HEARTBEAT.md` | "Read SENTINEL.md and follow every step" | Auto-injected per agent |
| 3 | Cron message | "You are SENTINEL. Read SENTINEL.md and follow every step. Do not skip steps." | User-turn payload |
| 4 | `SENTINEL.md` | The actual 6-step SOP | Discovered by reading HEARTBEAT.md |

This is too prescriptive for an autonomous agent. The final production design reduces to:

| Layer | Content | Purpose |
|-------|---------|---------|
| SOUL.md | Identity + "figure out what needs doing and do it" | Who the agent is |
| HEARTBEAT.md | "Your playbook is SENTINEL.md — read it and run your cycle" | Direct pointer to execution |
| Cron message | Role definition + "MEMORY.md has context" | Trigger with role context |
| SENTINEL.md | Step-by-step cycle procedure | The actual SOP |

---

## The Critical Finding: Proximity of Prescription Drives Tool Invocation

**This is the most important architectural finding.**

We ran three controlled experiments, progressively stripping prescription:

### Experiment 1 — No SOP file, no prescription anywhere
- SOUL.md: removed "follow precisely / do not improvise"
- HEARTBEAT.md: "The network is running. Do your job."
- Cron message: role-only (3 lines)
- SENTINEL.md: renamed so agent cannot find it
- **Result: Agent produced perfect narrative of SENTINEL's work, called zero tools. No bulletin board write. No MEMORY.md update. Pure theater.**

### Experiment 2 — No SOP file, MEMORY.md points to playbook
- Same as Experiment 1 but MEMORY.md had: "Read yours before acting" → SENTINEL.md
- SENTINEL.md: restored (discoverable if agent reads MEMORY.md)
- **Result: Agent narrated steps again, called zero tools. Indirect reference insufficient.**

### Experiment 3 (production) — Explicit direct reference
- HEARTBEAT.md: "Your playbook is SENTINEL.md — read it and run your cycle"
- **Result: Agent reads SENTINEL.md, invokes all tools, writes bulletin board, updates MEMORY.md. Full execution.**

### Conclusion

The LLM does not translate conceptual understanding into tool calls automatically. It needs an **explicit, proximate directive** — at the HEARTBEAT.md or cron message level — to actually invoke a tool. The model knows *what* SENTINEL does (it can narrate it perfectly), but without "read SENTINEL.md" in the immediate instruction context, it generates the narrative output without creating any tool-call tokens.

**Indirect references do not drive execution:**
- MEMORY.md saying "read your playbook" → insufficient
- Role description saying "watch the network" → insufficient
- "Do your job" → insufficient (agent narrates, doesn't execute)

**Direct proximate references do drive execution:**
- "Your playbook is SENTINEL.md — read it" → agent calls read tool → steps get executed

---

## How to Structure Agent Instructions (OpenClawCity Pattern)

### SOUL.md — Identity Layer
- Who the agent is, its domain, its character
- High-level behaviour principles ("figure out what needs doing and do it")
- **Do NOT put step-by-step instructions here**
- **Do NOT say "follow HEARTBEAT.md precisely" — this creates a prescription loop**
- Tool capabilities (what tools exist, not what to call)

```md
## Behaviour
You operate on a heartbeat. When you wake, figure out what needs doing and do it.
- You do not ask for permission — you were given tools for a reason
- You do not hallucinate data — if a fetch fails, you say so and move on
```

### MEMORY.md — Shared Persistent State
- Always injected by OpenClaw — the one file all agents share
- Network state, artefact table, scripts table, bulletin board schema
- Role Playbooks table (points agents to their SOPs)
- Recent history (last N cycles) — **be careful: this becomes training data for confabulation**
- **Do NOT put step-by-step instructions here** — it's a reference document, not a procedure

### HEARTBEAT.md — Per-Agent Session Briefing
- The minimal session context: who the agent is + direct pointer to its SOP
- **This file is the execution trigger** — it must explicitly name the SOP file
- Keep it short (3–5 lines). The detail lives in the SOP file.

```md
# NKA Heartbeat — SENTINEL
You are SENTINEL. Your playbook is SENTINEL.md — read it and run your cycle.
Workspace: /home/openclaw/projects/nka-poc
```

### Cron Message — Role Context
- The "user turn" that triggers the session
- Provide role identity and point to MEMORY.md for context
- Does NOT need to duplicate HEARTBEAT.md — they work together

```
You are SENTINEL, the network observer for NKA — a live Irish 5G simulation.
Your role: watch the network, update shared state, report your findings. You run every 10 minutes.
Everything you need to know about the workspace, artefacts, scripts, and bulletin board is in MEMORY.md.
```

### SOP File (SENTINEL.md / ORACLE.md / ARCHITECT.md) — Procedure Layer
- Step-by-step cycle procedure
- This is where "read artifacts/signals.json" lives — the explicit tool directives
- Can reference MEMORY.md for artefact details
- **This layer is necessary** — it is what causes actual tool invocation

---

## Cron Job Configuration

```bash
# Create a cron job
openclaw cron add \
  --agent nka \
  --name sentinel-watch \
  --every 10m \
  --session isolated \
  --model openai/minimax-m2.5 \
  --timeout-seconds 600 \
  --message "$(cat SENTINEL-AUTO.md)"

# Edit just the message
openclaw cron edit <id> --message "new message text"

# Disable/enable without deleting
openclaw cron disable <id>
openclaw cron enable <id>

# Check what's running
openclaw cron list

# View run history
openclaw cron runs <id>
```

**Critical: always specify `--model` explicitly in cron jobs.** Without it, cron may route to the wrong provider (ollama instead of openai), causing 401 auth failures. Direct `openclaw agent` calls use the model from `openclaw.json` correctly — cron does not always inherit this.

---

## Tool Permissions Architecture

OpenClaw has a global deny list and per-agent allow lists. The interaction matters:

```json
// ~/.openclaw/openclaw.json — global level
{
  "tools": {
    "deny": ["group:runtime"]   // blocks exec for ALL agents
  }
}

// agent config — per-agent level
{
  "tools": {
    "allow": ["web_fetch", "read", "write", "exec"]  // exec listed here but globally blocked
  }
}
```

**Global deny overrides agent allow.** If `group:runtime` (which includes `exec` and `process`) is in the global deny list, exec will be blocked even if the agent explicitly allows it.

Fix: remove `group:runtime` from the global deny list, then deny exec explicitly in agents that shouldn't have it.

---

## Write Tool in Isolated Sessions

In isolated cron sessions, the user approval dialog cannot be delivered to anyone. This manifests as:
```
⚠️ ✍️ Write: failed
```
in the cron run history — but the write may or may not have succeeded depending on the permission mode.

**Workaround**: Prefer exec scripts over direct write tool calls for file output in isolated sessions. Scripts run in a pre-approved context and don't need approval dialogs. The agents use:
- `bash agents/nka/scripts/update-memory.sh` — updates memory.json
- `bash agents/nka/scripts/update-state.sh` — updates state.json
- `node agents/nka/scripts/update-external-context.js` — writes external-context.json

These are pre-approved and don't trigger approval dialogs. Direct `write` tool calls for things like MEMORY.md and agent-comms.jsonl work because they're in the workspace (not system paths) — but if they fail, it's the approval mechanism, not a bug.

---

## Provider Configuration

```json
// ~/.openclaw/models.json
{
  "providers": {
    "openai": {
      "apiType": "openai-completions",   // sends Bearer auth correctly
      "baseUrl": "http://127.0.0.1:11434/v1",
      "apiKey": "...",
      "models": ["minimax-m2.5"]
    }
  }
}
```

Use `apiType: "openai-completions"` not `"openai"` — the former sends Bearer auth headers, which is what llama.cpp expects.

---

## Multi-Agent Shared State Pattern

NKA uses three agents (SENTINEL, ORACLE, ARCHITECT) that share state exclusively through files — no direct inter-agent communication.

```
agent-comms.jsonl   — append-only bulletin board (shared)
MEMORY.md           — always injected, updated by SENTINEL
signals.json        — pre-computed health summary (read by all)
external-context.json — weather/events/traffic (updated by SENTINEL)
network-atlas.md    — ORACLE's analysis report (read by ARCHITECT)
state.json          — growth coordination state
```

**Rules that make this work:**
1. `agent-comms.jsonl` is append-only — never overwrite or truncate
2. One agent writes, others read — no locking needed for small appends
3. SENTINEL runs most often (10 min), ORACLE next (30 min), ARCHITECT least (2h)
4. Agents read the tail of agent-comms.jsonl to understand recent context
5. Large files (memory.json 819KB, topology.json 2.5MB) are never read directly — scripts handle them

---

## Confabulation Risk

After 100+ cycles, the model has been exposed to detailed SENTINEL cycle output in:
- MEMORY.md Recent History section
- agent-comms.jsonl (read to understand bulletin board convention)
- heartbeat-log.jsonl

The model can reconstruct the SENTINEL procedure from this training context alone — and will do so convincingly, narrating all 6 steps with correct terminology and plausible outputs, **without calling any tools**.

This is not a bug — it's a natural consequence of repeated-context LLM behaviour. It means:
1. The HEARTBEAT.md explicit directive is not optional decoration
2. The Recent History section in MEMORY.md trains the model's "default behaviour" for that role
3. Clearing history doesn't help — the confabulation comes from the model's in-context learning, not just the history entries
4. Only direct proximate instruction ("read SENTINEL.md") reliably drives tool execution

---

## What OpenClawCity Design Gets Right

The OpenClawCity philosophy — give agents identity, role, and context rather than step-by-step SOPs — is correct at the design level. The SOUL.md gives agents character and operating principles. MEMORY.md gives them shared awareness. The bulletin board gives them a communication channel.

What NKA learned: the SOP layer (SENTINEL.md) is not in conflict with this philosophy. It is the operational specification of what the role means in practice. A character sheet says "SENTINEL watches the network." The SOP says "to watch the network, read signals.json and run update-memory.sh." Both are necessary.

The prescription at HEARTBEAT.md level ("Your playbook is SENTINEL.md — read it") is minimal — a pointer, not a procedure. This is the right balance: identity and role at the soul level, operational specification at the SOP level, explicit pointer at the session level.

---

*Document generated 2026-03-07 from systematic experiment on NKA autonomy.*
*Project: /home/openclaw/projects/nka-poc*
