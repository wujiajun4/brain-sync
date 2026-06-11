#!/usr/bin/env node
/**
 * hot-trigger-audit.mjs — 被动静态审计 hot-trigger list
 *
 * 用途：无需 hook 恢复、无需运行时数据，纯静态分析 CLAUDE.md hot-trigger 表格。
 *      检查项：总数 / 活项 / 引用 dead skill / 重复 trigger / 列表膨胀。
 *
 * 用法：
 *   # 默认：人类可读输出
 *   node ~/.claude/skills/brain-sync/bin/hot-trigger-audit.mjs
 *
 *   # JSON 输出（CI / 程序消费）
 *   node ~/.claude/skills/brain-sync/bin/hot-trigger-audit.mjs --json
 *
 *   # 静默：只在有问题时输出（适合 SessionStart stderr）
 *   node ~/.claude/skills/brain-sync/bin/hot-trigger-audit.mjs --quiet
 *
 * 输出维度：
 *   1. total：表格中编号总数（含 reserved / 空行）
 *   2. active：实际有 skill 名的项
 *   3. dead_skills：引用的 skill 目录不存在
 *   4. duplicates：trigger 词重复
 *   5. bloat_warning：总数 > 45 触发膨胀警告
 *
 * 不依赖：runtime trigger 数据、hook 恢复
 */

import fs from 'fs';
import { existsSync } from 'fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_MD = join(homedir(), '.claude', 'CLAUDE.md');
const HOT_TRIGGER_LIST = join(homedir(), '.claude', 'hot-trigger-list.md');
const SKILLS_DIR = join(homedir(), '.claude', 'skills');
const BLOAT_THRESHOLD = 45;

/**
 * 解析 hot-trigger 表格
 * 优先读新独立文件 ~/.claude/hot-trigger-list.md
 * Fallback 旧位置 ~/.claude/CLAUDE.md（向后兼容）
 */
function parseHotTriggerList() {
  // 优先新文件
  let mdPath = HOT_TRIGGER_LIST;
  let source = 'hot-trigger-list.md';
  if (!existsSync(HOT_TRIGGER_LIST)) {
    // Fallback 到 CLAUDE.md
    mdPath = CLAUDE_MD;
    source = 'CLAUDE.md (legacy)';
  }

  if (!existsSync(mdPath)) {
    return { exists: false, source, rows: [] };
  }
  const content = fs.readFileSync(mdPath, 'utf8');

  // 找 "Hot Trigger List" / "Hot-Trigger List" 到 "If none of the" 之间的内容
  // 兼容 h1 (#) 和 h2 (##) 标题
  const startMatch = content.match(/^#{1,3}\s+.*(?:Hot[ -]?Trigger List|Hot[ -]?trigger).*$/im);
  const endMatch = content.match(/\*\*If none of the \d+ match:/);
  if (!startMatch || !endMatch) {
    return { exists: true, source, rows: [], error: 'hot-trigger section not found' };
  }

  const section = content.slice(startMatch.index, endMatch.index);

  // 匹配表格行
  const rowRegex = /^\|\s*(\d+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm;
  const rows = [];
  let m;
  while ((m = rowRegex.exec(section)) !== null) {
    const [, num, triggerCell, skillCell, descCell] = m;
    const triggerText = triggerCell.trim();
    const skillCellRaw = skillCell.trim();
    const desc = descCell.trim();

    // 提取 skill 名
    let skillName = skillCellRaw;
    const boldMatch = skillCellRaw.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      skillName = boldMatch[1].trim();
    }

    // 跳过 reserved / 空 skill
    const isReserved = triggerText === '(reserved)' || skillName === 'reserved' || skillName === '';
    if (isReserved) {
      continue;
    }

    // 提取 trigger 词
    const triggers = triggerText
      .split(/[·|]/)
      .map(t => t.trim().replace(/^["']|["']$/g, ''))
      .filter(t => t.length > 0);

    rows.push({
      num: parseInt(num, 10),
      triggers,
      triggerRaw: triggerText,
      skill: skillName,
      desc,
    });
  }

  return { exists: true, source, rows };
}

/**
 * 检查 skill 是否真的安装
 * 注：skill 名可能在 skills 目录下有 .skill 后缀或者直接是目录
 */
function checkSkillExists(skillName) {
  if (!skillName) return { exists: false, reason: 'no skill name' };
  // 形式 1: 完整路径名 (e.g., "baoyu-post-to-wechat" 在 skills 目录)
  if (existsSync(join(SKILLS_DIR, skillName))) {
    return { exists: true, path: join(SKILLS_DIR, skillName) };
  }
  // 形式 2: 多个 skill 共享一个 trigger (e.g., "security-review / cso")
  if (skillName.includes('/')) {
    const parts = skillName.split('/').map(s => s.trim());
    const results = parts.map(p => ({
      skill: p,
      exists: existsSync(join(SKILLS_DIR, p)),
    }));
    const allExist = results.every(r => r.exists);
    return {
      exists: allExist,
      reason: allExist ? null : `one or more missing: ${results.filter(r => !r.exists).map(r => r.skill).join(', ')}`,
      details: results,
    };
  }
  return { exists: false, reason: `not found in ${SKILLS_DIR}` };
}

/**
 * 主审计逻辑
 */
function audit() {
  const result = {
    source: '',
    skillsDir: SKILLS_DIR,
    total: 0,
    active: 0,
    deadSkills: [],
    duplicates: [],
    bloatWarning: null,
    suggestions: [],
  };

  const parsed = parseHotTriggerList();

  if (!parsed.exists) {
    result.error = `neither ${HOT_TRIGGER_LIST} nor ${CLAUDE_MD} found`;
    return result;
  }
  if (parsed.error) {
    result.error = parsed.error;
    result.source = parsed.source;
    return result;
  }
  result.source = parsed.source;

  // 算总数（包括 reserved）
  const allRowCount = (() => {
    const mdPath = parsed.source === 'CLAUDE.md (legacy)' ? CLAUDE_MD : HOT_TRIGGER_LIST;
    const content = fs.readFileSync(mdPath, 'utf8');
    const startMatch = content.match(/^#{1,3}\s+.*(?:Hot[ -]?Trigger List|Hot[ -]?trigger).*$/im);
    const endMatch = content.match(/\*\*If none of the \d+ match:/);
    if (!startMatch || !endMatch) return 0;
    const section = content.slice(startMatch.index, endMatch.index);
    return (section.match(/^\|\s*\d+\s*\|/gm) || []).length;
  })();
  result.total = allRowCount;
  result.active = parsed.rows.length;

  // 检查每个 skill 是否安装
  for (const row of parsed.rows) {
    const check = checkSkillExists(row.skill);
    if (!check.exists) {
      result.deadSkills.push({
        num: row.num,
        skill: row.skill,
        reason: check.reason,
      });
    }
  }

  // 检查 trigger 词重复
  const triggerMap = new Map(); // trigger -> [row nums]
  for (const row of parsed.rows) {
    for (const t of row.triggers) {
      const normalized = t.toLowerCase().trim();
      if (!normalized) continue;
      if (!triggerMap.has(normalized)) triggerMap.set(normalized, []);
      triggerMap.get(normalized).push(row.num);
    }
  }
  for (const [trigger, nums] of triggerMap) {
    if (nums.length > 1) {
      result.duplicates.push({ trigger, rows: nums });
    }
  }

  // 膨胀警告
  if (result.total > BLOAT_THRESHOLD) {
    result.bloatWarning = `hot-trigger list has ${result.total} items (>${BLOAT_THRESHOLD}). Consider cleanup.`;
    result.suggestions.push('Run /skill-lens to check coverage; consider removing dead triggers');
  }

  // 健康建议
  if (result.deadSkills.length > 0) {
    result.suggestions.push(`${result.deadSkills.length} dead skill reference(s) found — either install the skill or remove the trigger row`);
  }
  if (result.duplicates.length > 0) {
    result.suggestions.push(`${result.duplicates.length} trigger word(s) used in multiple rows — may cause confusion`);
  }

  // 整体状态
  result.status = (result.deadSkills.length === 0 && result.duplicates.length === 0 && !result.bloatWarning)
    ? 'healthy'
    : (result.deadSkills.length > 0 || result.bloatWarning) ? 'needs-attention' : 'minor-warnings';

  return result;
}

/**
 * 输出格式
 */
function formatHuman(result) {
  const lines = [];
  lines.push('━'.repeat(60));
  lines.push('🔍 Hot-Trigger Audit (passive, no hook required)');
  lines.push('━'.repeat(60));
  lines.push('');

  if (result.error) {
    lines.push(`❌ Error: ${result.error}`);
    return lines.join('\n');
  }

  // 摘要
  const statusIcon = result.status === 'healthy' ? '✅' : result.status === 'minor-warnings' ? '🟡' : '🔴';
  lines.push(`${statusIcon} Status: ${result.status}`);
  lines.push('');
  lines.push(`📊 Totals:`);
  lines.push(`   total (incl. reserved): ${result.total}`);
  lines.push(`   active (has skill):     ${result.active}`);
  lines.push(`   dead skill refs:       ${result.deadSkills.length}`);
  lines.push(`   duplicate triggers:    ${result.duplicates.length}`);
  if (result.bloatWarning) {
    lines.push(`   ⚠️  bloat: ${result.bloatWarning}`);
  }
  lines.push('');

  // Dead skills
  if (result.deadSkills.length > 0) {
    lines.push('🔴 Dead skill references:');
    for (const d of result.deadSkills) {
      lines.push(`   #${d.num} → **${d.skill}** (${d.reason})`);
    }
    lines.push('');
  }

  // Duplicates
  if (result.duplicates.length > 0) {
    lines.push('🟡 Duplicate triggers:');
    for (const dup of result.duplicates.slice(0, 10)) {
      lines.push(`   "${dup.trigger}" → rows ${dup.rows.join(', ')}`);
    }
    if (result.duplicates.length > 10) {
      lines.push(`   ...${result.duplicates.length - 10} more`);
    }
    lines.push('');
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    lines.push('💡 Suggestions:');
    for (const s of result.suggestions) {
      lines.push(`   - ${s}`);
    }
    lines.push('');
  }

  // Healthy 状态总结
  if (result.status === 'healthy') {
    lines.push('✅ No issues found. hot-trigger list is well-maintained.');
  }

  lines.push('━'.repeat(60));
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const isQuiet = args.includes('--quiet');

  const result = audit();

  // v1.3.0 (B6 fix): exit code 契约
  //   0 = OK (healthy or minor-warnings)
  //   1 = needs action (errors / dead skills)
  //   2 = script error (parse failed, file not found, etc.)
  if (result.parseError || result.fileNotFound) {
    process.exit(2);
  }

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (isQuiet) {
    // 静默：只在有问题时输出
    if (result.status !== 'healthy') {
      console.error(`hot-trigger-audit: ${result.status} (${result.deadSkills.length} dead, ${result.duplicates.length} dup, total=${result.total})`);
      process.exit(1);
    }
    // healthy 时不输出（适合 SessionStart stderr）
  } else {
    console.log(formatHuman(result));
  }

  process.exit(result.status === 'healthy' ? 0 : (result.status === 'minor-warnings' ? 0 : 1));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
