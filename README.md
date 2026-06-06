<p align="center">
  <h1 align="center">🧠 Brain Sync</h1>
  <strong>Fast reflexes. Deep memory. No drift.<br/>小脑快反应。大脑深记忆。零漂移。</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-blue" />
  <img src="https://img.shields.io/badge/platform-Claude%20Code%20%7C%20Agent%20Skills-purple" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
  <img src="https://img.shields.io/badge/lang-EN%20%7C%20%E4%B8%AD%E6%96%87-brightgreen" />
</p>

---

> **You have three memory systems. They don't talk to each other.** Brain Sync fixes that — extracts triggers and relations for your fast-twitch Memory MCP, leaves deep docs in your Obsidian brain. TRUST 5 quality gate on every sync.
>
> **你有三个记忆系统。它们互相不说话。** Brain Sync 修复这个问题——提取触发词和关系到快反应小脑，把深度文档留在大脑。每次同步都过 TRUST 5 质量门。

---

## 痛点 / The Problem

你装了新 skill。写了新规则。建了新产品。然后呢？

Obsidian 知识库里有完整记录——但 Memory MCP 还停留在三天前。下次你问"装不装这个工具"，0.1 秒的反射层不知道你有 tool-eval，只能翻 300 个文件的大脑中去找。

| 场景 | 没有同步时 | 有 Brain Sync 后 |
|------|------|------|
| 装完新 skill | Memory MCP 不知道有它 | 自动抽取触发词+归属，小脑 0.1s 命中 |
| 新建偏好规则 | 下次会话 Claude 忘记了 | 规则沉淀到小脑，跨会话生效 |
| 加了新乐团 | 找不到对应工具 | 乐团→工具关系自动建立 |

---

## 解决方案 / The Solution

**`/brain-sync` 把大脑的新知识抽取到小脑——只同步"怎么用"，不同步"为什么"。**

```
Obsidian (大脑)                    Memory MCP (小脑)
skill-directory.md ──抽取──→ Tool 实体 + 触发词 + belongs-to
orchestra-system.md ──抽取──→ Orchestra 实体 + 成员列表
偏好规则 ──抽取──→ Preference 实体
长文档/代码块/排障日志 ──不同步──→ 留在大脑里
```

---

## 功能 / Features

| 功能 Feature | 做什么 |
|-------------|--------|
| 🔍 **漂移检测 / Drift detection** | 对比 Obsidian skill 数量 vs Memory MCP 实体数量 |
| ➕ **自动补齐 / Auto-sync** | 缺失实体 → 创建；过时实体 → 更新；幽灵实体 → 删除 |
| 🔗 **关系建设 / Relations** | 新工具自动关联到所属乐团 |
| ✅ **TRUST 5 质量门** | Tested/Readable/Unified/Secure/Trackable 五维验证 |
| 📊 **同步报告 / Sync report** | 每次同步输出前后对比表 + TRUST 5 通过率 |
| 🎚️ **渐进式披露** | L1 摘要 150 token → L2 全文 4000 token，不浪费上下文 |

---

## TRUST 5 质量门

| 维度 | 检查 | 不过会怎样 |
|------|------|------|
| **T**ested | 同步后 `search_nodes` 能搜到新实体吗？ | 报告 FAIL，指出哪些没写进去 |
| **R**eadable | 每个实体 ≤ 3 observation，每条 ≤ 200 字？ | 报告 FAIL，指出哪个超了 |
| **U**nified | Obsidian skill 数量 ≈ Memory MCP 工具数量？ | 差异 >2 时 WARN，>5 时 FAIL |
| **S**ecure | observations 里有 token/密码/密钥吗？ | 报告 FAIL，指出泄漏位置 |
| **T**rackable | 输出了同步报告吗？ | 没输出就是 FAIL |

---

## 安装 / Install

```bash
# Claude Code
mkdir -p ~/.claude/skills && git clone https://github.com/wujiajun4/brain-sync.git ~/.claude/skills/brain-sync

# Agent Skills
npx skills add wujiajun4/brain-sync -g
```

触发方式：

| 你说 | 发生什么 |
|------|------|
| `brain-sync` / `sync memory` | 手动同步 |
| `更新小脑` / `同步记忆` | 中文触发 |
| （自动） | orchestra-intake 后、新 skill 创建后、偏好规则写入后 |

---

## 与你其他 Skill 的关系

```
tool-eval    → 评估别人的工具（该不该装）
preflight    → 检查自己的项目（能发了吗）
brain-sync   → 同步大小脑（记忆一致吗）
```

---

## 技术栈 / Tech Stack

| 类别 | 技术 |
|------|------|
| 平台 | Claude Code, Agent Skills |
| 语言 | Markdown (SKILL.md) |
| 依赖 | 零 — Memory MCP + Obsidian 都已就绪 |
| 设计参考 | MoAI-ADK TRUST 5 + Progressive Disclosure |

---

## 许可证 / License

MIT — © 2026 wujiajun4
