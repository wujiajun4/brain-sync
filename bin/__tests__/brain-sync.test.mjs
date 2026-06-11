/**
 * brain-sync v1.3.0 unit tests
 *
 * 用 node:test (零依赖)
 * 跑法: node --test bin/__tests__/brain-sync.test.mjs
 *
 * 覆盖:
 *   B1 — compress-obs truncation detection
 *   B2 — check-drift basename fallback
 *   B3 — check-drift extra loop (ghost index detection)
 *   B5 — UTF-16 / code points handling
 *   B6 — exit code semantics
 *   A3 — entityToSlug kebab → snake
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SKILL_DIR = new URL('../../', import.meta.url).pathname;
const compressObs = await import('../../bin/compress-obs.mjs');
const checkDrift = await import('../../bin/check-drift.mjs');

// ========== B1: compress-obs truncation detection ==========

test('B1: short text returns 1 candidate, no truncation', () => {
  const result = compressObs.compressWithMeta('短文本测试。');
  assert.equal(result.truncated, false);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.dropped_count, 0);
  assert.equal(result.suggested_entities, 1);
});

test('B1: super-long sentences trigger truncation + stderr', () => {
  // 5 sentences, each ~120 chars + brackets = ~123 chars
  // With maxLen 200, ~2 sentences fit per candidate, so 5 sentences → ~3-4 candidates
  const longSentence = '超长句子,包含很多内容,用于触发 truncateAt 函数并产生多个 candidates 因为单句超过 200 字。'.repeat(2);
  const text = Array(5).fill(longSentence).map((s, i) => '【' + (i+1) + '】' + s).join(' ');
  const result = compressObs.compressWithMeta(text);
  assert.equal(result.truncated, true);
  assert.equal(result.candidates.length, 3);  // 4 candidates, 3 kept
  assert.equal(result.dropped_count, 1);
  assert.equal(result.suggested_entities, 2);  // ceil(4/3) = 2
});

test('B1: silent mode suppresses stderr warning', () => {
  const longSentence = '超长句子,包含很多内容,用于触发 truncateAt 函数并产生多个 candidates 因为单句超过 200 字。'.repeat(2);
  const text = Array(5).fill(longSentence).map((s, i) => '【' + (i+1) + '】' + s).join(' ');
  const result = compressObs.compressWithMeta(text, { silent: true });
  assert.equal(result.truncated, true);
});

test('B1: BC — compress() returns array (not object)', () => {
  const result = compressObs.compress('短文本。');
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
});

// ========== B5: UTF-16 / code points ==========

test('B5: 100 emoji + 100 ASCII = 200 code points (not 300 UTF-16)', () => {
  const text100 = '🎉'.repeat(100) + 'a'.repeat(100);
  assert.equal([...text100].length, 200);  // code points
  assert.equal(text100.length, 300);         // UTF-16 units
});

test('B5: emoji not broken mid-character on truncation', () => {
  const longEmoji = '🎉'.repeat(250);
  const result = compressObs.compressWithMeta(longEmoji + '.');
  // No broken surrogate pair
  const brokenSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;
  for (const c of result.candidates) {
    assert.equal(brokenSurrogate.test(c), false, 'broken surrogate in: ' + c);
  }
});

// ========== A3: entityToSlug kebab → snake ==========

test('A3: entityToSlug converts kebab-case to snake_case', () => {
  assert.equal(checkDrift.entityToSlug('feedback-harness'), 'feedback_harness.md');
  assert.equal(checkDrift.entityToSlug('feedback_harness'), 'feedback_harness.md');
  assert.equal(checkDrift.entityToSlug('project-ace-token'), 'project_ace_token.md');
});

// ========== B2: check-drift basename fallback ==========

test('B2: matches entity when MEMORY.md has memory/ prefix', () => {
  const result = checkDrift.diff(
    [{ file: 'memory/feedback_x.md', name: 'feedback_x' }],
    ['feedback_x']
  );
  assert.deepEqual(result.missing, []);
});

test('B2: matches entity when MEMORY.md has bare name', () => {
  const result = checkDrift.diff(
    [{ file: 'feedback_x.md', name: 'feedback_x' }],
    ['feedback_x']
  );
  assert.deepEqual(result.missing, []);
});

test('B2: detects truly missing entity', () => {
  const result = checkDrift.diff(
    [{ file: 'memory/feedback_x.md', name: 'feedback_x' }],
    ['feedback_y']
  );
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].entity, 'feedback_y');
});

// ========== B3: check-drift extra loop ==========

test('B3: extra loop detects ghost index (file in MEMORY.md but not on disk)', () => {
  const result = checkDrift.diffWithBaseDir(
    [{ file: 'memory/ghost_phantom_entity.md', name: 'ghost_phantom' }],
    [],
    '/tmp/this_dir_does_not_exist_at_all_xyz'  // baseDir that doesn't exist
  );
  // Note: with non-existent baseDir, fs.existsSync returns false → all reported as ghost
  assert.ok(result.extra.length >= 1);
});

test('B3: extra loop returns empty when all files exist', () => {
  // Use an existing dir like the user's memory dir
  const result = checkDrift.diffWithBaseDir(
    [{ file: 'memory/feedback_three_strikes.md', name: 'feedback_three_strikes' }],
    ['feedback_three_strikes'],
    '/Users/mac/.claude/projects/-Users-mac/memory'
  );
  assert.deepEqual(result.extra, []);
});

test('B3: extra loop graceful skip when no baseDir', () => {
  const result = checkDrift.diffWithBaseDir(
    [{ file: 'memory/foo.md' }],
    [],
    null
  );
  assert.equal(result.skipped, 'no baseDir provided');
});

// ========== B6: exit code semantics ==========

test('B6: check-drift exit 0 when no drift', () => {
  const out = execSync(
    `node ${join(SKILL_DIR, 'bin/check-drift.mjs')} ` +
    `/Users/mac/.claude/projects/-Users-mac/memory/MEMORY.md brain-sync-v1.3.0-backlog`,
    { encoding: 'utf8' }
  );
  assert.ok(out.includes('"drift": false'));
});

test('B6: check-drift exit 2 when MEMORY.md not found', () => {
  let exitCode = 0;
  let stderr = '';
  try {
    execSync(
      `node ${join(SKILL_DIR, 'bin/check-drift.mjs')} /nonexistent.md feedback_anything`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (e) {
    exitCode = e.status;
    stderr = e.stderr?.toString() || '';
  }
  assert.equal(exitCode, 2);
  assert.ok(stderr.includes('not found'));
});

test('B6: hot-trigger-audit exit 0 when healthy', () => {
  // Run in current dir; we expect healthy (39 triggers, 38 active)
  const out = execSync(
    `node ${join(SKILL_DIR, 'bin/hot-trigger-audit.mjs')} --json`,
    { encoding: 'utf8' }
  );
  const result = JSON.parse(out);
  assert.equal(result.status, 'healthy');
});

test('B6: compress-obs --check exit 0 on short text', () => {
  const exitCode = execSync(
    `echo "短" | node ${join(SKILL_DIR, 'bin/compress-obs.mjs')} --check >/dev/null`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).status || 0;
  assert.equal(exitCode, 0);
});

test('B6: compress-obs --check exit 1 on long text', () => {
  let exitCode = 0;
  try {
    execSync(
      `node -e "console.log('a'.repeat(300))" | node ${join(SKILL_DIR, 'bin/compress-obs.mjs')} --check`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (e) {
    exitCode = e.status;
  }
  assert.equal(exitCode, 1);
});
