---
name: brain-sync
version: "1.2.0"
description: >-
  L1: Keeps Memory MCP (cerebellum) and Obsidian (brain) in sync without duplication. Auto-extracts triggers+relations for fast reflexes, leaves deep docs for reasoning. L2: full pipeline, TRUST 5 quality gate, drift detection. | 中文触发：记忆同步。 Use this skill when the user mentions memory sync / brain sync / context save / 记忆管理 / 同步知识库.
allowed-tools: Read, Write, Bash
user-invocable: true
tags: [memory, sync, knowledge-management, workflow, optimization]
argument-hint: "brain-sync | sync new skill | sync after changes"

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

# Changelog (newest first)
changelog: |
  v1.2.0 (2026-06-08): + 3 个 bin 工具 (compress-obs, check-drift, hot-trigger-audit)
  v1.1.1 (2026-06-07): SKILL.md frontmatter 标准化
  v1.1.0 (2026-05-XX): TRUST 5 quality gate
  v1.0.0 (2026-05-XX): 初始版本
---

<!-- PROGRESSIVE DISCLOSURE: This is the full SKILL.md.
     Agent should first read this Level 1 summary block (15 lines),
     then decide if the task needs full pipeline details below.
     Level 2 starts at "## Full Pipeline" section. -->

# Brain Sync — "Fast reflexes, deep memory."

> **v1.4.0 (D1 fix)**: 移除了具体延迟数字 (0.1s / 1s / 0.5s) — 那些是估算不是测量. 真延迟取决于:
> 1. 实体数 (越多越慢)
> 2. Obsidian 文件数 (扫描时间)
> 3. Memory MCP server roundtrip
> 用作设计意图的描述, 不用作性能声明.

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
| Small brain | Memory MCP | reflex layer | Rules, triggers, tool names, belongs-to relations |
| Big brain | Obsidian KB | reasoning layer | Full docs, configs, troubleshooting, code blocks |
| Code brain | codebase-memory | trace layer | Functions, classes, routes, call chains |

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

### R 维度辅助工具：compress-obs.mjs

每次写 obs 都要手工压到 ≤200 chars 很烦。`bin/compress-obs.mjs` 自动化这件事：

```bash
# 从 stdin（最常用）
echo "long text..." | node ~/.claude/skills/brain-sync/bin/compress-obs.mjs

# 从 argv
node ~/.claude/skills/brain-sync/bin/compress-obs.mjs "long text..."

# 从文件
node ~/.claude/skills/brain-sync/bin/compress-obs.mjs /path/to/text.md

# 输出 JSON 数组（直接喂给 mcp__memory__add_observations）
node ~/.claude/skills/brain-sync/bin/compress-obs.mjs --json "long text..."

# 仅检查（不切分）
node ~/.claude/skills/brain-sync/bin/compress-obs.mjs --check "text"
```

**智能切分规则**：
- 按 `。！？；.!?;\n` 切分（保留标点）
- `.letter` 模式（文件扩展名/域名，如 `MEMORY.md`）**不切** — 保护 URL/path
- 单个超长无标点句子 → 200 chars 截断 + `...`
- 累计拼接分句到 ≤200 chars / obs
- 默认输出 3 条候选 obs

**何时用**：写 obs 之前发现文本超 200 chars 时 → 先跑 compress → 再 add_observations。**避免 delete+add 来回 2 次的麻烦**。

### U 维度辅助工具：check-drift.mjs

自动检测 Memory MCP 实体 ↔ MEMORY.md 索引的漂移。挡住"写 memory 忘更新索引"的低层错误。

```bash
# stdin 模式（Claude 自动化用）
# 第一行: MEMORY.md 路径
# 后续每行: Memory MCP 实体名
mcp__memory__read_graph | node ~/.claude/skills/brain-sync/bin/check-drift.mjs
# ↑ 实际由 Claude 把 read_graph 输出转成每行一个实体名喂进来

# CLI 模式（人工测试）
node ~/.claude/skills/brain-sync/bin/check-drift.mjs \
  /Users/mac/.claude/projects/-Users-mac/memory/MEMORY.md \
  entity-name-1 entity-name-2 entity-name-3

# 包含所有实体（不 filter）
node ~/.claude/skills/brain-sync/bin/check-drift.mjs --include-all <args>
```

**核心特性**：
- **Filter by prefix**: 默认只检查 `feedback_` / `project_` / `preference_` 前缀的实体（disk memory 镜像类）。Skill/Orchestra/Tool 实体**不**在 MEMORY.md 索引中，是设计预期。
- **JSON 报告**: missing[] / extra[] / drift 布尔 / warnings[]
- **Exit code**: 0=无漂移 / 1=有漂移 / 2=参数错（CI 友好）
- **真实漂移**：脚本一次性发现并修复 7 个真漂移（1 个 slug 错 + 2 个孤儿 disk 缺 + 5 个索引漏）

**何时用**：
- 改完 MEMORY.md → 跑一次（CI gate）
- 新建 disk memory .md → 跑一次（确保索引同步）
- 定期 audit（每周一次）→ 防止漂移累积

### Hot-trigger 被动审计：hot-trigger-audit.mjs

**不依赖 UserPromptSubmit hook 恢复**，纯静态分析 hot-trigger 表格。

```bash
# 默认：人类可读报告
node ~/.claude/skills/brain-sync/bin/hot-trigger-audit.mjs

# JSON 输出
node ~/.claude/skills/brain-sync/bin/hot-trigger-audit.mjs --json

# 静默：healthy 时无输出，异常时 stderr + exit 1（适合 SessionStart）
node ~/.claude/skills/brain-sync/bin/hot-trigger-audit.mjs --quiet
```

**数据源**（自动检测）：
- 优先：`~/.claude/hot-trigger-list.md`（独立文件，2026-06-08 从 CLAUDE.md 搬出来）
- Fallback：`~/.claude/CLAUDE.md`（旧位置，向后兼容）

**审计维度**：
- **total** vs **active**：总条目数 vs 实际活条目（排除 reserved / 空行）
- **dead_skills**：引用的 skill 目录不存在（卸载了但触发器还在）
- **duplicates**：trigger 词被多个条目共享（潜在歧义）
- **bloat**：总条目 > 45 触发膨胀警告

**当前状态**：37 total / 36 active / 0 dead / 0 dup / healthy ✅

**何时用**：
- SessionStart 静默模式（已经启着，加一行 stderr 即可）
- 装新 skill 后 → 检查 trigger 是否对齐
- 半年一次的 hot-trigger list 健康检查

**与 #4 完整 audit 区别**：#4 需要 hook 恢复 + 7 天 runtime 数据；本工具是**零侵入静态分析**。先跑这个，等 #4 数据充足后再切。

### Hot-trigger 表存放位置（2026-06-08 优化）

**问题**：CLAUDE.md 顶部原本有 47 行 hot-trigger 表格，每次 Claude 启动都全文加载 = 浪费 ~1250 tokens。

**解决**：
- 完整 37 项表搬出到独立文件 `~/.claude/hot-trigger-list.md`（76 行，含维护规则）
- CLAUDE.md 顶部只留**指针段**（8 行） + 总结 + 审计工具路径
- 完整 trigger 词只在需要 lookup 时才 fetch 新文件

**节省**：每次 Claude 启动省 ~1250 tokens ≈ 0.3-0.5s 启动加速 + 大量 token 预算。

**审计工具自动检测**：优先读新文件，旧位置 fallback。

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

## Conflict Resolution (v1.3.0)

When Memory MCP and Obsidian KB disagree on an entity's content, **Obsidian is the source of truth**. Reason: Obsidian is git-tracked + human-edited + has audit trail; Memory MCP is derived state. Resolution order:
1. **Obsidian wins** for human-edited content
2. **Memory wins** only for auto-derived metadata (relation counts, observation limits)
3. **Tie → user confirms** via explicit "sync from Obsidian" or "sync from Memory" command
4. **Stale Memory** (>7 days no update + Obsidian newer) → re-derive from Obsidian

## Exit Code Contract (v1.3.0)

All `bin/*.mjs` scripts use a unified exit code scheme for CI:
- **0** = clean (no action needed, or minor-warnings OK)
- **1** = needs action (drift detected, needs compress, etc.)
- **2** = script error (file not found, parse error, missing args)
