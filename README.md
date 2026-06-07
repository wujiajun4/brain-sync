<div align="center">

# 🧠 Brain Sync

**Fast reflexes. Deep memory. No drift.**

**小脑快反应。大脑深记忆。零漂移。**

[![version](https://img.shields.io/badge/version-1.1.0-blue)](https://github.com/wujiajun4/brain-sync)
[![platform](https://img.shields.io/badge/platform-Claude%20Code%20%7C%20Agent%20Skills-purple)](https://skills.sh)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![lang](https://img.shields.io/badge/lang-EN%20%7C%20%E4%B8%AD%E6%96%87-brightgreen)](#)

[Features](#features) · [Install](#install) · [Architecture](#architecture) · [Contributing](#contributing)

<br/>

<code>npx skills add wujiajun4/brain-sync -g</code>

</div>

---

## Screenshot

<!-- No live demo URL — Brain Sync is a CLI/skill that runs inside Claude Code. -->

---

## About

> **You have three memory systems. They don't talk to each other.**
> Brain Sync fixes that — extracts triggers and relations for your fast-twitch
> Memory MCP, keeps deep docs in your Obsidian brain. TRUST 5 quality gate on
> every sync.

**Brain Sync** keeps your three-layer AI memory stack in sync without
duplication. It reads your Obsidian knowledge base, extracts the "how to use"
information (triggers, relations, orchestras), and stores it in Memory MCP for
0.1-second reflexes. Full documentation stays in Obsidian for deep reasoning.

> **你有三个记忆系统。它们互相不说话。** Brain Sync 修复这个问题——提取触发词和关系到
> 快反应小脑，把深度文档留在大脑。每次同步都过 TRUST 5 质量门。

### Key Features

| Feature | What it does |
|---------|-------------|
| 🔍 **Drift Detection** | Compares Obsidian skill count vs Memory MCP entity count |
| ➕ **Auto-sync Missing** | Creates entities for skills not yet in Memory MCP |
| 🔗 **Auto-relations** | Links every new tool to its orchestra |
| 👻 **Ghost Pruning** | Removes entities that no longer exist in Obsidian |
| ✅ **TRUST 5 Quality Gate** | Tested · Readable · Unified · Secure · Trackable |
| 📊 **Sync Report** | Before/after table with pass/fail for each dimension |
| 🎚️ **Progressive Disclosure** | L1 150-token summary → L2 4000-token full spec |

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Platform | Claude Code · Agent Skills (67+ platforms) |
| Language | Markdown (SKILL.md) |
| Runtime | Memory MCP · Obsidian knowledge base |
| Design Reference | MoAI-ADK TRUST 5 · Progressive Disclosure |
| Dependencies | Zero — pure instruction skill |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Brain Sync                  │
│                                             │
│  ┌──────────┐    extract     ┌───────────┐  │
│  │ Obsidian │ ──triggers──→ │ Memory    │  │
│  │ (Brain)  │  +relations   │ MCP       │  │
│  │          │               │ (Cereb.)  │  │
│  │ Deep     │  don't sync   │ Fast      │  │
│  │ docs     │ ←──────────── │ reflexes  │  │
│  │ logs     │  code blocks  │ triggers  │  │
│  │ specs    │  trade data   │ relations │  │
│  └──────────┘               └───────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │         TRUST 5 Gate                 │   │
│  │  Tested · Readable · Unified ·       │   │
│  │  Secure · Trackable                  │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │         Sync Report                  │   │
│  │  Tools: 7→9  Prefs: 11→12  Ghosts:0  │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Project Structure

```
brain-sync/
├── .gitignore
├── LICENSE               # MIT
├── README.md             # ← You are here
└── SKILL.md              # Runtime spec — L1/L2 progressive disclosure
                          #   5-step pipeline + TRUST 5 gate + sync report template
```

---

## Getting Started

### Prerequisites

- Claude Code or any Agent Skills-compatible platform
- Memory MCP configured and running
- Obsidian knowledge base at `~/obsidian/knowledge-base/`

### Install

```bash
# Claude Code (one command / 一行命令)
mkdir -p ~/.claude/skills && git clone https://github.com/wujiajun4/brain-sync.git ~/.claude/skills/brain-sync

# Agent Skills (any platform / 全平台)
npx skills add wujiajun4/brain-sync -g
```

### Usage

| You say | What happens |
|---------|-------------|
| `/brain-sync` | Manual sync |
| `sync memory` · `更新小脑` · `同步记忆` | Chinese/English triggers |
| *(auto)* | After orchestra-intake · skill created · preference written |

---

## TRUST 5 Quality Gate

Every sync passes through five automated checks. If any fail, the report tells you exactly what to fix.

| Dimension | Check | Failure means |
|-----------|-------|---------------|
| **T** Tested | Can `search_nodes` find the new entity? | Write failed — entity not persisted |
| **R** Readable | Observations ≤ 3 each, ≤ 200 chars each | Small brain overloaded — trim it |
| **U** Unified | Obsidian count ≈ Memory MCP count? | Brains drifted — gap > 2 warns, > 5 fails |
| **S** Secure | No `ghp_` / `sk-` / token leaks in observations? | Immediate fix — expose credential |
| **T** Trackable | Sync report output? | No audit trail |

---

## Pair with Your Other Skills

```
tool-eval      → Evaluate someone else's tool (should I install this?)
preflight      → Check your own project (is this ready to ship?)
brain-sync     → Sync small brain and big brain (memory consistent?)
```

All three belong to Orchestra ⑮ AI/ML — your skill development toolchain.

---

## Contributing

Issues and PRs welcome. Before submitting — eat your own dog food:

```bash
/preflight --strict
```

---

## Acknowledgements

- **TRUST 5** quality gate adapted from [MoAI-ADK](https://github.com/modu-ai/moai-adk) (Apache 2.0)
- **Progressive Disclosure** pattern from MoAI-ADK's three-tier knowledge delivery design
- Built with [Agent Skills](https://skills.sh) specification

---

## License

MIT — © 2026 wujiajun4
