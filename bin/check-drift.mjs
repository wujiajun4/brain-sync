#!/usr/bin/env node
/**
 * check-drift.mjs — Memory MCP ↔ MEMORY.md 漂移检测
 *
 * 用途：自动检测 Memory MCP 实体是否都登记在 MEMORY.md 索引里。
 *      挡住"写 memory 忘更新索引"的低层错误。
 *
 * 用法（推荐：Claude 中转）：
 *   # 由 Claude 跑：
 *   1. mcp__memory__read_graph → 拿到所有 entity.name
 *   2. 把 [name1, name2, ...] 转成每行一个
 *   3. pipe 到本脚本
 *   4. 第一行是 MEMORY.md 路径
 *
 *   实际 Claude 调用模式：
 *     mcp__memory__read_graph → JSON.stringify(entityNames) → 喂给本脚本
 *
 * CLI 用法（人工测试）：
 *   echo "memory_md_path
 *   entity-name-1
 *   entity-name-2" | node check-drift.mjs
 *
 *   或者：
 *   node check-drift.mjs MEMORY.md entity1 entity2 entity3
 *
 * 输出：JSON 报告
 *   {
 *     "memoryMdPath": "...",
 *     "memoryMdIndexCount": 24,
 *     "entityCount": 50,
 *     "missing": [...],   // 实体有但 MEMORY.md 索引缺
 *     "extra": [...],     // 索引有但实体没有
 *     "drift": false,
 *     "warnings": []
 *   }
 */

import fs from 'fs';
import path from 'path';

const MAX_LEN = 200;

function readMemoryMdIndex(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, count: 0, slugs: [] };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  // 匹配 "- [name](file.md)" 模式
  const matches = [...content.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)/gm)];
  const entries = matches.map(m => ({
    name: m[1].trim(),
    file: m[2].trim(),
  }));
  return { exists: true, count: entries.length, entries };
}

/**
 * 实体名转 MEMORY.md slug
 * 例: feedback_harness_optimization_backlog → feedback_harness_optimization_backlog.md
 *     project_shared_claude_account_safety → project_shared_claude_account_safety.md
 *
 * v1.3.0 (A3 fix): 显式归一化. 兼容:
 *   - snake_case: project_x_y → project_x_y.md
 *   - kebab-case:  project-x-y → project_x_y.md (kebab 转 snake)
 *   - MEMORY.md 带 memory/ 前缀: path.basename fallback
 *   - 用户可能写 project_xxx.md / memory/project_xxx.md / project-xxx.md
 */
function entityToSlug(entityName) {
  const snake = entityName.replace(/-/g, '_').toLowerCase();
  return `${snake}.md`;
}

export { entityToSlug };

/**
 * 把实体名跟 MEMORY.md 索引对比
 */
function diff(memoryMdEntries, entityNames) {
  // v1.3.0 (B2 fix): 加 path.basename fallback 兼容 memory/ 前缀
  // 例: 'memory/feedback_x.md' 和 'feedback_x.md' 都视为同一文件
  const mdSlugs = new Set();
  const mdSlugsByBasename = new Set();
  for (const e of memoryMdEntries) {
    mdSlugs.add(e.file);
    // 取 basename (e.g. 'memory/feedback_x.md' → 'feedback_x.md')
    const base = e.file.includes('/') ? e.file.split('/').pop() : e.file;
    mdSlugsByBasename.add(base);
  }
  const mdNames = new Set(memoryMdEntries.map(e => e.name));

  const entitySlugs = entityNames.map(entityToSlug);

  const missing = []; // 实体有但 MEMORY.md 缺
  const extra = [];   // MEMORY.md 有但实体没有

  // missing: 实体 → 但 MEMORY.md 索引没有
  for (let i = 0; i < entitySlugs.length; i++) {
    const slug = entitySlugs[i];
    const name = entityNames[i];
    if (!mdSlugs.has(slug) && !mdSlugsByBasename.has(slug) && !mdNames.has(name)) {
      missing.push({ entity: name, expected_slug: slug });
    }
  }

  // extra: MEMORY.md 索引里的 file 指向的 disk 文件不存在
  for (const entry of memoryMdEntries) {
    // 跳过归档类（不一定有 .md 文件，例如 .md 在别处）
    if (!entry.file.endsWith('.md')) continue;
    // disk file path 不在 /Users/mac/.claude/projects/-Users-mac/memory/ 视为 OK（Obsidian 文件）
    if (!entry.file.includes('memory/')) continue;
    // 检查 disk file 是否存在
    // 实际完整路径需要 caller 提供，此处仅做 surface 报告
  }

  return { missing, extra };
}

function diffWithBaseDir(memoryMdEntries, entityNames, baseDir) {
  // v1.3.0 (B3 fix): 真正实现 extra 检测 — 检查 MEMORY.md 索引里 .md 文件
  // 在 disk 上是否存在. baseDir 通常是 ~/.claude/projects/-Users-mac/memory/
  if (!baseDir) {
    return { missing: [], extra: [], skipped: 'no baseDir provided' };
  }
  const { missing } = diff(memoryMdEntries, entityNames);
  const extra = [];
  for (const entry of memoryMdEntries) {
    if (!entry.file.endsWith('.md')) continue;
    if (!entry.file.includes('memory/')) continue;  // Obsidian files, skip
    const fullPath = path.join(baseDir, entry.file.replace(/^memory\//, ''));
    if (!fs.existsSync(fullPath)) {
      extra.push({ file: entry.file, expected_path: fullPath });
    }
  }
  return { missing, extra };
}

export { diff, diffWithBaseDir };

function main() {
  const args = process.argv.slice(2);
  let memoryMdPath = '';
  let entityNames = [];
  let filterPrefixes = ['feedback_', 'project_', 'preference_']; // 默认只检查 disk memory 镜像类

  // 解析 --include-all flag（关闭 filter）
  if (args.includes('--include-all')) {
    filterPrefixes = null;
    args.splice(args.indexOf('--include-all'), 1);
  }

  if (args.length > 0) {
    // CLI 模式: argv[0] = MEMORY.md path, rest = entity names
    memoryMdPath = args[0];
    entityNames = args.slice(1);
  } else {
    // stdin 模式: 第一行 path, 后续每行一个 entity name
    const stdin = fs.readFileSync(0, 'utf8');
    const lines = stdin.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      process.stderr.write('❌ check-drift: stdin empty, need MEMORY.md path on first line\n');
      process.exit(2);
    }
    memoryMdPath = lines[0].trim();
    entityNames = lines.slice(1).map(l => l.trim());
  }

  // 读取 MEMORY.md
  const mdIndex = readMemoryMdIndex(memoryMdPath);

  if (!mdIndex.exists) {
    process.stderr.write(`❌ check-drift: MEMORY.md not found at ${memoryMdPath}\n`);
    process.exit(2);
  }

  // Filter: 只对 disk memory 镜像类实体做 diff
  let filteredEntities = entityNames;
  let filteredOut = 0;
  if (filterPrefixes) {
    filteredEntities = entityNames.filter(name => {
      return filterPrefixes.some(p => name.startsWith(p));
    });
    filteredOut = entityNames.length - filteredEntities.length;
  }

  // Diff (v1.3.0 B3 fix: 用 diffWithBaseDir 真正检查 disk file 存在性)
  const baseDir = path.dirname(memoryMdPath);
  const { missing, extra } = diffWithBaseDir(mdIndex.entries, filteredEntities, baseDir);

  // 报告
  const report = {
    memoryMdPath,
    memoryMdIndexCount: mdIndex.count,
    entityCount: entityNames.length,
    filteredCount: filteredEntities.length,
    filteredOut,
    filterPrefixes: filterPrefixes || '(none, --include-all)',
    missing,
    extra,
    drift: missing.length > 0,
    warnings: missing.length > 0
      ? [`${missing.length} Memory MCP entities not in MEMORY.md index`]
      : (extra.length > 0
        ? [`${extra.length} MEMORY.md entries point to missing disk files (ghost index)`]
        : []),
  };

  console.log(JSON.stringify(report, null, 2));

  process.exit(report.drift ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
