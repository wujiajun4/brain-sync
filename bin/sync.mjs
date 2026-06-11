/**
 * sync.mjs — v1.4.0 真同步脚本 (C1 fix)
 *
 * 之前 3 个 bin 工具 (compress-obs, check-drift, hot-trigger-audit) 只
 * 检测不执行. 这个脚本产出 plan JSON, LLM 读后执行 Memory MCP 写入.
 *
 * 输入 (stdin):
 *   mcp__memory__read_graph JSON 输出 (或同等结构), e.g.:
 *   { entities: [{name, entityType, observations}], relations: [...] }
 *
 * 输入 (argv):
 *   --obsidian-dir <path>  (默认 ~/obsidian/knowledge-base/)
 *   --apply                (写 plan 到 logs/sync-YYYY-MM-DD-plan.json)
 *   --dry-run              (默认, 仅 stdout 打印 plan)
 *
 * 输出 (stdout 或 logs/):
 *   plan JSON with 3 operation types:
 *   - {op: "add_entity", name, entityType, observations, source_file}
 *   - {op: "update_observations", name, current_obs, new_obs, source_file}
 *   - {op: "add_ghost_note", name, note: "no matching .md file"}
 *
 * 退出码 (per B6 contract):
 *   0 = clean (no diff OR plan written successfully)
 *   1 = dry-run found drift (LLM should review plan)
 *   2 = script error
 *
 * 关键: sync.mjs 不直接写 Memory MCP — LLM 是唯一能调用 mcp__memory__
 * 工具的执行者. 这个脚本只产出可审计的 plan.
 */

import fs from 'node:fs';
import path from 'node:path';

// === CLI args ===
const args = process.argv.slice(2);
const OBSIDIAN_DIR = (() => {
  const idx = args.indexOf('--obsidian-dir');
  return idx >= 0 ? args[idx + 1] : path.join(process.env.HOME, 'obsidian', 'knowledge-base');
})();
const APPLY = args.includes('--apply');
const PROJECT_SUBDIR = path.join(OBSIDIAN_DIR, 'projects');

// === Read Memory dump from stdin ===
let memoryData;
try {
  const stdin = fs.readFileSync(0, 'utf8');
  memoryData = JSON.parse(stdin);
  if (!memoryData.entities || !Array.isArray(memoryData.entities)) {
    throw new Error('stdin JSON must have `entities` array');
  }
} catch (e) {
  process.stderr.write(`❌ sync.mjs: failed to parse stdin as Memory dump: ${e.message}\n`);
  process.stderr.write(`   Expected: { entities: [...], relations: [...] } from mcp__memory__read_graph\n`);
  process.exit(2);
}

// === Scan Obsidian projects/ for matching files ===
function scanObsidian() {
  // Map: basename-without-md → file path
  // 例: study-abroad-planner-v0.3.0-pipeline-notes.md → study-abroad-planner-v0.3.0-pipeline-notes
  const map = new Map();
  if (!fs.existsSync(PROJECT_SUBDIR)) return map;
  for (const file of fs.readdirSync(PROJECT_SUBDIR)) {
    if (!file.endsWith('.md')) continue;
    const base = file.replace(/\.md$/, '');
    map.set(base, path.join(PROJECT_SUBDIR, file));
  }
  return map;
}

// === Heuristic: which entities should have a matching .md file? ===
function entityShouldHaveDoc(entity) {
  // Only sync entities that have a "project_" prefix or are skills/features
  // with multiple observations. Skip "preference_" / simple flag entities.
  const name = entity.name || '';
  if (name.startsWith('project_')) return true;
  if (entity.entityType === 'Tool' || entity.entityType === 'Feature') return true;
  if (entity.entityType === 'Release') return true;
  return false;
}

// === Heuristic: derive .md basename from entity name ===
function entityToMdBase(entityName) {
  // project_study_abroad_planner_v0_3_1_freshness_mechanism
  //   → study-abroad-planner-v0.3.1-freshness-mechanism
  // Logic:
  //   1. Strip prefix (project_/feedback_/preference_)
  //   2. Convert v\d+_\d+_\d+ → v\d+.\d+.\d+ (file naming convention)
  //   3. Convert remaining _ → -
  let name = entityName;
  if (name.startsWith('project_')) name = name.slice('project_'.length);
  if (name.startsWith('feedback_')) name = name.slice('feedback_'.length);
  if (name.startsWith('preference_')) name = name.slice('preference_'.length);
  // Convert version patterns v\d+_\d+_\d+ → v\d+.\d+.\d+
  name = name.replace(/v(\d+)_(\d+)_(\d+)/g, 'v$1.$2.$3');
  return name.replace(/_/g, '-');
}

// === Compute diff ===
function computeDiff(memoryData, obsidianMap) {
  const ops = [];
  const matched = new Set();
  const orphanEntities = [];   // entities without matching .md
  const orphanFiles = [];       // .md files without matching entity

  // 1. Walk entities → look for matching .md
  for (const entity of memoryData.entities) {
    if (!entityShouldHaveDoc(entity)) continue;
    const mdBase = entityToMdBase(entity.name);
    const mdPath = obsidianMap.get(mdBase);
    if (mdPath) {
      matched.add(mdBase);
      // Detect content drift: simple heuristic — read .md frontmatter date vs entity observations
      try {
        const mdContent = fs.readFileSync(mdPath, 'utf8');
        const frontmatterDate = mdContent.match(/^date:\s*(\S+)/m)?.[1];
        const entityObs = (entity.observations || []).join(' ');
        if (frontmatterDate && !entityObs.includes(frontmatterDate)) {
          // File is newer than entity — recommend updating observations
          ops.push({
            op: 'update_observations',
            name: entity.name,
            source_file: mdPath,
            hint: `frontmatter date ${frontmatterDate} not in entity observations`,
          });
        }
      } catch (e) {
        ops.push({
          op: 'add_ghost_note',
          name: entity.name,
          note: `file ${mdPath} exists but cannot read: ${e.message}`,
        });
      }
    } else {
      // No matching .md file
      orphanEntities.push(entity);
    }
  }

  // 2. Walk .md files → look for matching entity
  for (const [mdBase, mdPath] of obsidianMap) {
    if (matched.has(mdBase)) continue;
    // Skip generic / index files
    if (mdBase === 'INDEX' || mdBase === 'README') continue;
    orphanFiles.push({ mdBase, mdPath });
  }

  // 3. Generate ops for orphans
  for (const entity of orphanEntities) {
    ops.push({
      op: 'add_to_obsidian',
      name: entity.name,
      entityType: entity.entityType,
      observations: entity.observations,
      hint: `No .md file found at projects/${entityToMdBase(entity.name)}.md`,
    });
  }
  for (const { mdBase, mdPath } of orphanFiles) {
    ops.push({
      op: 'add_entity',
      source_file: mdPath,
      expected_name: `project_${mdBase.replace(/-/g, '_')}`,
      hint: `Obsidian file not represented in Memory MCP. Suggest creating entity 'project_${mdBase.replace(/-/g, '_')}'`,
    });
  }

  return { ops, orphanEntities, orphanFiles, matched_count: matched.size };
}

// === Main ===
function main() {
  const obsidianMap = scanObsidian();
  const { ops, orphanEntities, orphanFiles, matched_count } = computeDiff(memoryData, obsidianMap);

  const plan = {
    timestamp: new Date().toISOString(),
    obsidian_dir: OBSIDIAN_DIR,
    memory_entity_count: memoryData.entities.length,
    obsidian_md_count: obsidianMap.size,
    matched_count,
    orphan_entity_count: orphanEntities.length,
    orphan_file_count: orphanFiles.length,
    drift_detected: ops.length > 0,
    operations: ops,
  };

  if (APPLY) {
    const logsDir = path.join(process.env.HOME, '.claude', 'skills', 'brain-sync', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const planPath = path.join(logsDir, `sync-${date}-plan.json`);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
    process.stderr.write(`📝 Plan written to ${planPath}\n`);
    process.stderr.write(`   ${ops.length} operations. LLM should review and execute via mcp__memory__ tools.\n`);
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(JSON.stringify(plan, null, 2));
  }

  // B6 contract: 0 clean, 1 drift, 2 error
  process.exit(ops.length > 0 ? 1 : 0);
}

main();
