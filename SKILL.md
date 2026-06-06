---
name: brain-sync
version: "1.1.0"
description: >-
  L1: Keeps Memory MCP (cerebellum) and Obsidian (brain) in sync without
  duplication. Auto-extracts triggers+relations for fast reflexes, leaves deep
  docs for reasoning. L2: full pipeline, TRUST 5 quality gate, drift detection.
argument-hint: "brain-sync | sync new skill | sync after changes"
allowed-tools: Read, Write, Bash
user-invocable: true
tags: [memory, sync, knowledge-management, workflow, optimization]

# MoAI-style Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 150
  level2_tokens: 4000

# MoAI-style Structured Triggers
triggers:
  keywords:
    - "sync memory"
    - "sync brain"
    - "brain-sync"
    - "更新小脑"
    - "同步记忆"
    - "sync after changes"
    - "new skill installed"
  events:
    - "orchestra-intake-complete"
    - "skill-created"
    - "preference-written"
    - "orchestra-updated"
  phases:
    - "drift-check"
    - "sync-snapshot"
    - "quality-verify"
---

<!-- PROGRESSIVE DISCLOSURE: This is the full SKILL.md.
     Agent should first read this Level 1 summary block (15 lines),
     then decide if the task needs full pipeline details below.
     Level 2 starts at "## Full Pipeline" section. -->

# Brain Sync — "Fast reflexes, deep memory."

<!-- LEVEL 1 — Always read these 15 lines first -->

| What | Action |
|------|--------|
| **Goal** | Keep Memory MCP (small brain) ↔ Obsidian (big brain) in sync |
| **Sync scope** | Extract tool names + triggers + relations → Memory MCP. Full docs stay in Obsidian. |
| **How** | 1. Detect drift → 2. Create missing entities → 3. Add relations → 4. TRUST 5 verify |
| **Never sync** | Code blocks, logs, PDF specs, trade journals — too heavy for small brain |
| **Auto-triggers** | After orchestra-intake, skill created, preference written |
| **Manual trigger** | "brain-sync" / "sync memory" / "更新小脑" / "同步记忆" |

**Key rules:**
- Entity name pattern: `{skill-name}-skill` for tools, `{name}-orchestra` for orchestras
- Max 3 observations per entity, each under 200 chars
- Always create relations (unlinked entity = ghost)
- Report after every sync with TRUST 5 pass/fail

---

<!-- LEVEL 2 — Full pipeline starts here. Read only when executing a sync. -->

## The Three Layers

| Layer | System | Role | Stores |
|-------|--------|------|--------|
| Small brain | Memory MCP | 0.1s reflex | Rules, triggers, tool names, belongs-to relations |
| Big brain | Obsidian KB | 1s deep reasoning | Full docs, configs, troubleshooting, code blocks |
| Code brain | codebase-memory | 0.5s code trace | Functions, classes, routes, call chains |

## What to sync (AND what NOT to sync)

### ✅ SYNC: Memory MCP (small brain)

| From Obsidian | To Memory MCP | Entity type |
|--------------|---------------|-------------|
| skill-directory.md — each skill | Tool entity: name, triggers, orchestra, one-liner | Tool |
| orchestra-system.md — each orchestra | Orchestra entity: name, mission, roster | Orchestra |
| New preference rules | Preference entity: rule + when to apply | preference |
| product-catalog.md — each product | Tool entity: name, GitHub URL, one-liner | Tool |

### ❌ NEVER sync to Memory MCP

| Content | Reason |
|---------|--------|
| Troubleshooting logs (github-auth-setup.md) | Too long, context-dependent |
| Code blocks, shell scripts | Not queryable via entities |
| PDF generation specs, NAATI formats | Domain-specific detail |
| Trade journals, strategy backtests | Historical data, not rules |
| Full README content | Already in Obsidian, useless for routing |

## Full Pipeline

### Step 1: Detect

```bash
# Find skill-directory.md last modified
ls -la ~/obsidian/knowledge-base/projects/skill-directory.md

# Count skills in directory
grep -c "^# " ~/obsidian/knowledge-base/projects/skill-directory.md

# Count entities in Memory MCP
# (memory:search_nodes with broad query)
```

Compare counts. If Obsidian has more, there's drift.

### Step 2: Find Drift

```
Read skill-directory.md
  → for each ## skill-name section:
    → extract: name, triggers, orchestra, one-liner
    → memory:open_nodes(["{name}-skill"])
    → if not found: create entity + relation
    → if found but stale: update observations
```

### Step 3: Sync Missing

```javascript
memory:create_entities([
  {
    name: "skill-name",
    entityType: "Tool",
    observations: [
      "one-liner description",
      "triggers: word1, word2, word3",
      "orchestra: ⑮ AI/ML",
      "source: github.com/xxx"
    ]
  }
])

memory:create_relations([
  { from: "skill-name", to: "orchestra-name", relationType: "belongs-to" }
])
```

### Step 4: Prune Ghosts

```
memory:delete_entities(["ghost-entity-name"])
```

---

## TRUST 5 Quality Gate

After every sync, verify all 5 dimensions. **If any fails, report it — don't silently skip.**

| Dimension | Check | How to verify |
|-----------|-------|---------------|
| **T**ested | Do synced entities actually exist in Memory MCP? | `memory:search_nodes("{name}")` → should return the entity |
| **R**eadable | Are observations under the limits? | Each observation ≤ 200 chars, max 3 per entity |
| **U**nified | Are the two brains consistent? | Memory MCP tool count ≈ skill-directory section count |
| **S**ecure | No secrets leaked into observations? | grep for `ghp_`, `sk-`, `token`, `密码` in entity names and observations |
| **T**rackable | Is there a sync report? | Output the report table below |

### TRUST 5 快速自检

```
Run these inline:

T - Testable:
  memory:search_nodes("last-synced-skill-name")
  → PASS if entity found, FAIL if not

R - Readable:
  Each entity has ≤3 observations, each ≤200 chars
  → PASS if all under limits, FAIL if any overflow

U - Unified:
  Skill-directory sections: N
  Memory MCP tool entities: M
  → PASS if |N-M| ≤ 2, WARN if 3-5, FAIL if >5

S - Secure:
  No ghp_/sk-/token/密码 in any entity observation
  → PASS if clean, FAIL if leak detected

T - Trackable:
  Output this report
  → PASS if report shown, FAIL if skipped
```

### Sync Report Template

```
## Brain Sync Report

| Layer | Before | Added | Removed | After |
|-------|--------|-------|---------|-------|
| Memory MCP tools | 7 | 2 | 0 | 9 |
| Memory MCP orchestras | 4 | 0 | 0 | 4 |
| Memory MCP preferences | 11 | 1 | 0 | 12 |
| Obsidian skills | 14 | 1 | 0 | 15 |

### TRUST 5 Gate
| Dimension | Result | Detail |
|-----------|--------|--------|
| T Tested | ✅ PASS | All 3 new entities verified |
| R Readable | ✅ PASS | Max obs length: 145 chars |
| U Unified | ✅ PASS | Obsidian:15, Memory:13 — within tolerance |
| S Secure | ✅ PASS | No secrets found |
| T Trackable | ✅ PASS | This report |

**Verdict: 5/5 PASS. Sync complete.**
```

---

## Rules

- **Never sync code blocks, logs, or full documents.** Summary only.
- **Entity name pattern:** `{skill-name}-skill` for tools, `{name}-orchestra` for orchestras.
- **Max 3 observations per entity, each ≤ 200 chars.** Memory MCP is fast lookup, not reading.
- **Always create relations.** Unlinked entity = ghost.
- **Report after every sync** with TRUST 5 pass/fail table.
- **Progressive disclosure:** Level 1 is the 15-line summary block above. Only read Level 2 (full pipeline) when actually executing a sync.
