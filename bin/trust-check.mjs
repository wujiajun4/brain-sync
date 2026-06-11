/**
 * trust-check.mjs — v1.4.0 TRUST 5 全 exit code 化
 *
 * 把 TRUST 5 每个维度都落成脚本, 各自 exit 0/1:
 *   T Tested:    跑 node --test bin/__tests__/*.mjs, 全部通过 = 0
 *   R Readable:  读 stdin Memory dump, 验证每条 obs ≤ 200 chars = 0
 *   U Unified:   委托 check-drift (0 drift = 0)
 *   S Secure:    扫 stdin Memory dump 看是否有密钥 / 高熵串 = 0
 *   T Trackable: 验证 logs/sync-*.json 存在 (sync.mjs 跑过) = 0
 *
 * 用法:
 *   # argv 模式: --memory-dump <path>  --memory-md <path>  --entity-name <name>...
 *   # stdin 模式: read_graph JSON
 *   node bin/trust-check.mjs --memory-md /Users/mac/.../MEMORY.md
 *
 * 退出码:
 *   0 = 全部通过
 *   1 = 至少一维不通过
 *   2 = 脚本错
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const TESTS_DIR = path.join(__dirname, '__tests__');
const LOGS_DIR = path.join(SKILL_DIR, 'logs');

// === CLI args ===
const args = process.argv.slice(2);
const MEMORY_DUMP = (() => {
  const idx = args.indexOf('--memory-dump');
  return idx >= 0 ? args[idx + 1] : null;
})();
const MEMORY_MD = (() => {
  const idx = args.indexOf('--memory-md');
  return idx >= 0 ? args[idx + 1] : path.join(process.env.HOME, '.claude', 'projects', '-Users-mac', 'memory', 'MEMORY.md');
})();
const ENTITY_NAMES = args.filter(a => !a.startsWith('--') && a !== MEMORY_MD).concat(
  args.slice(args.indexOf('--entity-name') + 1).filter(Boolean)
);

// === Load Memory dump ===
function loadMemory() {
  if (MEMORY_DUMP) {
    return JSON.parse(fs.readFileSync(MEMORY_DUMP, 'utf8'));
  }
  // Try stdin
  try {
    const stdin = fs.readFileSync(0, 'utf8').trim();
    if (stdin) return JSON.parse(stdin);
  } catch {}
  return { entities: [], relations: [] };
}

// === T: Tested ===
function checkTested() {
  if (!fs.existsSync(TESTS_DIR)) {
    return { pass: false, reason: `no tests/ dir at ${TESTS_DIR}` };
  }
  const testFiles = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.test.mjs'));
  if (testFiles.length === 0) {
    return { pass: false, reason: 'no .test.mjs files' };
  }
  try {
    const out = execSync(`node --test ${testFiles.map(f => path.join(TESTS_DIR, f)).join(' ')}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    // Parse TAP output for pass/fail count
    const passMatch = out.match(/tests\s+(\d+)/);
    const failMatch = out.match(/fail\s+(\d+)/);
    return {
      pass: !failMatch || failMatch[1] === '0',
      reason: `${passMatch?.[1] || 0} tests, ${failMatch?.[1] || 0} fail`,
    };
  } catch (e) {
    return { pass: false, reason: e.message };
  }
}

// === R: Readable ===
function checkReadable(memory) {
  const violations = [];
  for (const entity of memory.entities || []) {
    for (const obs of entity.observations || []) {
      if (obs.length > 200) {
        violations.push({ entity: entity.name, length: obs.length, sample: obs.substring(0, 50) });
      }
    }
  }
  return {
    pass: violations.length === 0,
    reason: violations.length === 0
      ? `all observations ≤ 200 chars (checked ${memory.entities?.length || 0} entities)`
      : `${violations.length} observations > 200 chars: ${violations[0]?.entity} (${violations[0]?.length} chars)`,
  };
}

// === U: Unified (delegate to check-drift) ===
function checkUnified() {
  if (!fs.existsSync(MEMORY_MD)) {
    return { pass: true, reason: 'no MEMORY.md path provided, skipped' };
  }
  try {
    const out = execSync(
      `node ${path.join(__dirname, 'check-drift.mjs')} ${MEMORY_MD} ${ENTITY_NAMES.join(' ')}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(out);
    return {
      pass: !result.drift,
      reason: result.drift
        ? `drift: ${result.missing.length} missing`
        : `${result.missing.length || 0} missing / ${result.extra?.length || 0} extra`,
    };
  } catch (e) {
    return { pass: false, reason: e.message };
  }
}

// === S: Secure ===
const SECRET_PATTERNS = [
  { name: 'GitHub PAT', re: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'GitHub OAuth', re: /gho_[A-Za-z0-9]{36}/g },
  { name: 'GitHub fine-grained', re: /github_pat_[A-Za-z0-9_]{82}/g },
  { name: 'OpenAI/DeepSeek key', re: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'Anthropic key', re: /sk-ant-[A-Za-z0-9-]{20,}/g },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'Slack token', re: /xox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: 'PEM private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Chinese ID card (18 digits)', re: /\b[0-9]{17}[0-9Xx]\b/g },
];

function checkSecure(memory) {
  const findings = [];
  const blob = JSON.stringify(memory);
  for (const { name, re } of SECRET_PATTERNS) {
    const matches = blob.match(re);
    if (matches) {
      findings.push({ pattern: name, count: matches.length, sample: matches[0].substring(0, 30) + '...' });
    }
  }
  return {
    pass: findings.length === 0,
    reason: findings.length === 0
      ? `no secrets found in ${memory.entities?.length || 0} entities`
      : `${findings.length} secret pattern(s): ${findings[0].pattern}`,
  };
}

// === T: Trackable (logs/ has recent sync) ===
function checkTrackable() {
  if (!fs.existsSync(LOGS_DIR)) {
    return { pass: false, reason: `no logs/ dir at ${LOGS_DIR} — sync.mjs never ran` };
  }
  const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('sync-') && f.endsWith('.json'));
  if (files.length === 0) {
    return { pass: false, reason: 'no sync-*.json in logs/' };
  }
  // Most recent file
  const latest = files.sort().pop();
  return { pass: true, reason: `${files.length} sync log(s); latest: ${latest}` };
}

// === Main ===
function main() {
  const memory = loadMemory();
  const results = {
    T: checkTested(),
    R: checkReadable(memory),
    U: checkUnified(),
    S: checkSecure(memory),
    T_track: checkTrackable(),
  };

  const allPass = Object.values(results).every(r => r.pass);
  const anyFail = Object.values(results).some(r => !r.pass);

  const report = {
    timestamp: new Date().toISOString(),
    mode: 'TRUST 5 all-exit-code',
    results,
    verdict: allPass ? '✅ 5/5 PASS' : `❌ FAIL: ${Object.entries(results).filter(([k,v]) => !v.pass).map(([k]) => k).join(', ')}`,
  };

  console.log(JSON.stringify(report, null, 2));

  // B6 contract: 0 all pass, 1 fail, 2 script error
  process.exit(anyFail ? 1 : 0);
}

try {
  main();
} catch (e) {
  process.stderr.write(`❌ trust-check: ${e.message}\n`);
  process.exit(2);
}
