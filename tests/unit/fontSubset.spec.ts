import { test, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';

// Font subset guard (#20): the self-hosted woff2 files are built from
// public/fonts/subset-glyphs.txt (experiments/build-font-subset.mjs). If UI copy
// gains a character that the subset lacks, the text silently falls back to a
// system font — this test fails first, telling you to rebuild the subsets.

function copyCharacters(): Set<string> {
  const src = readFileSync('src/constants/translations.ts', 'utf8');
  const noComments = src.replace(/\/\/.*$/gm, '');
  const strings = [...noComments.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) =>
    m[1].replace(/\\'/g, "'"),
  );
  const chars = new Set<string>();
  for (const s of strings) for (const ch of s) chars.add(ch);
  return chars;
}

test.describe('font subset coverage', () => {
  const glyphs = new Set(readFileSync('public/fonts/subset-glyphs.txt', 'utf8'));

  test('every character in the UI copy is covered by the subset list', () => {
    const missing = [...copyCharacters()].filter((ch) => !glyphs.has(ch));
    expect(
      missing,
      `subset-glyphs.txt is missing ${missing.length} glyph(s) — rerun node experiments/build-font-subset.mjs and rebuild the woff2 files`,
    ).toEqual([]);
  });

  test('glyphs the chrome renders outside translations are covered', () => {
    for (const ch of '×中文EN·…') {
      expect(glyphs.has(ch), `missing chrome glyph ${JSON.stringify(ch)}`).toBe(true);
    }
  });

  test('the woff2 subsets exist and stay small', () => {
    for (const file of ['public/fonts/mira-serif-sc.woff2', 'public/fonts/mira-wenkai.woff2']) {
      const { size } = statSync(file);
      expect(size, `${file} is empty`).toBeGreaterThan(10_000);
      // Guard against accidentally shipping an unsubscribed full CJK font.
      expect(size, `${file} looks unsubscribed`).toBeLessThan(500_000);
    }
  });
});
