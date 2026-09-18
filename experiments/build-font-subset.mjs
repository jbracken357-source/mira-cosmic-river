// Build the subset glyph list for the self-hosted fonts: every character used by
// the UI copy (translations.ts values) plus printable ASCII and the few glyphs the
// chrome renders directly (×, 中文/EN toggle, middle dot, ellipsis, quotes).
// Run from the repo root: node experiments/build-font-subset.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync('src/constants/translations.ts', 'utf8');
const noComments = src.replace(/\/\/.*$/gm, '');
const strings = [...noComments.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) =>
  m[1].replace(/\\'/g, "'"),
);

const chars = new Set();
for (const s of strings) for (const ch of s) chars.add(ch);
for (let i = 0x20; i <= 0x7e; i++) chars.add(String.fromCharCode(i));
for (const ch of '×中文EN·…’‘“”—–%') chars.add(ch);

const sorted = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
mkdirSync('public/fonts', { recursive: true });
writeFileSync('public/fonts/subset-glyphs.txt', sorted.join(''), 'utf8');
console.log(`unique glyphs: ${sorted.length} -> public/fonts/subset-glyphs.txt`);
