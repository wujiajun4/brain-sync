#!/usr/bin/env node
/**
 * compress-obs.mjs — Trust-5 R 限制自动压缩工具
 *
 * 用途：把任意长度的 obs 文本自动拆分成 ≤200 chars 的候选 obs，
 *      用于 Memory MCP add_observations 调用（TRUST 5 R 限制）。
 *
 * 用法：
 *   echo "long text..." | node compress-obs.mjs
 *   node compress-obs.mjs "<text>"
 *   node compress-obs.mjs <file_path>
 *   node compress-obs.mjs --json "<text>"  # 输出 JSON 数组
 *   node compress-obs.mjs --check "<text>"  # 只检查不切，看是否需要
 *
 * 输出：3 条候选 obs（如果输入够长），每条 ≤200 chars
 *
 * 设计：
 *   - 按中英文标点（。！？；.!?;\n）智能切分
 *   - 累计句子到 ≤200 chars
 *   - 截断时优先在标点/空格处断开
 *   - 超过 200 的单个句子自动在 195 字符处 + "..." 截断
 */

import fs from 'fs';
import path from 'path';

const MAX_LEN = 200;
const BREAK_CHARS = new Set(['。', '！', '？', '；', '.', '!', '?', ';', '\n']);

/**
 * 判断一个字符是否是"真正的"句子结束标点
 * 规则：. 紧跟字母 = 文件扩展名/域名，不算
 *       。！？；\n 都算
 *       . + 空格/行尾/中文 = 算
 */
function isSentenceEnd(ch, i, text) {
  if (!BREAK_CHARS.has(ch)) return false;
  if (ch === '.' && i + 1 < text.length && /[a-zA-Z]/.test(text[i + 1])) {
    return false; // .letter = 文件扩展名，跳过
  }
  return true;
}

/**
 * 按中英文标点切分句子（保留标点）
 */
function splitSentences(text) {
  const parts = [];
  let buffer = '';
  for (let i = 0; i < text.length; i++) {
    buffer += text[i];
    if (isSentenceEnd(text[i], i, text)) {
      // 跳过标点后的空白，但保留标点
      while (i + 1 < text.length && /\s/.test(text[i + 1])) {
        i++;
      }
      const trimmed = buffer.trim();
      if (trimmed) parts.push(trimmed);
      buffer = '';
    }
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts;
}

/**
 * 在 ≤ maxLen 处截断，优先在空格/标点处断开
 * 保护规则：不在 .md / .json / .com / .io 等文件扩展名/域名中间断开
 */
function truncateAt(text, maxLen) {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen - 3); // 留 3 字符给 "..."
  const candidates = [
    slice.lastIndexOf(' '),
    slice.lastIndexOf('，'),
    slice.lastIndexOf('、'),
    slice.lastIndexOf('。'),
    slice.lastIndexOf(';'),
    slice.lastIndexOf(','),
  ].filter(i => i > maxLen * 0.6);

  // 保护：跳过会拆开 "X.Y" (文件扩展名/域名) 的位置
  const safe = candidates.filter(i => {
    const next = text[i + 1];
    const prev = text[i - 1];
    if (prev === '.' && /[a-zA-Z]/.test(next)) return false;
    return true;
  });

  if (safe.length > 0) {
    const lastBreak = Math.max(...safe);
    return text.slice(0, lastBreak) + '...';
  }
  return slice + '...';
}

/**
 * 核心：把长文本压缩成 ≤3 条 ≤200 chars 的 obs
 */
export function compress(text, { maxObs = 3, maxLen = MAX_LEN } = {}) {
  if (!text || !text.trim()) return [];

  const sentences = splitSentences(text);
  const candidates = [];
  let current = '';

  for (const s of sentences) {
    const separator = current ? ' ' : '';
    if (current.length + separator.length + s.length <= maxLen) {
      current += separator + s;
    } else {
      if (current) candidates.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        candidates.push(truncateAt(s, maxLen));
        current = '';
      }
    }
  }
  if (current) candidates.push(current);

  return candidates.slice(0, maxObs);
}

/**
 * 检查模式：只返回是否需要切分，不输出
 */
function checkOnly(text) {
  const sentences = splitSentences(text);
  const tooLong = sentences.filter(s => s.length > MAX_LEN);
  const totalLen = text.length;
  return {
    needsCompress: totalLen > MAX_LEN || sentences.length > 3,
    totalLen,
    sentenceCount: sentences.length,
    tooLongCount: tooLong.length,
    reason: totalLen > MAX_LEN
      ? `总长 ${totalLen} > ${MAX_LEN}`
      : sentences.length > 3
        ? `${sentences.length} 句 > 3`
        : 'OK',
  };
}

function main() {
  const args = process.argv.slice(2);
  let isJson = false;
  let isCheck = false;
  if (args[0] === '--json') { isJson = true; args.shift(); }
  if (args[0] === '--check') { isCheck = true; args.shift(); }

  let text = '';
  if (args.length > 0) {
    const input = args[0];
    if (fs.existsSync(input) && fs.statSync(input).isFile()) {
      text = fs.readFileSync(input, 'utf8');
    } else {
      text = args.join(' ');
    }
  } else {
    text = fs.readFileSync(0, 'utf8');
  }

  if (isCheck) {
    const result = checkOnly(text);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.needsCompress ? 1 : 0);
  }

  const candidates = compress(text);

  if (isJson) {
    console.log(JSON.stringify(candidates, null, 2));
  } else {
    console.log(`# Compressed: ${candidates.length} obs (each ≤${MAX_LEN} chars)\n`);
    candidates.forEach((c, i) => {
      const marker = c.length <= MAX_LEN ? '✅' : '❌ OVER';
      console.log(`[${i + 1}] (${c.length} chars) ${marker} ${c}`);
      console.log();
    });
  }
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
