import { test, expect } from '@playwright/test';
import { TRANSLATIONS } from '../../src/constants/translations';

// Info card copy (#89): the first line says the relationship, verbatim in both
// languages; the science paragraph stays whole as the second line; the tail's
// body is untouched; and no time-speed copy survives the slider's removal.
// Pure translation data, so this runs in the unit project with no browser page.

test.describe('info card first lines (#89)', () => {
  test('the relationship lines are verbatim in both languages', () => {
    expect(TRANSLATIONS.ch.miraAFirstLine).toBe('亮度一直在变。你看到的是这一晚。');
    expect(TRANSLATIONS.en.miraAFirstLine).toBe('The light keeps changing. This is the night you caught.');
    expect(TRANSLATIONS.ch.miraBFirstLine).toBe('它还在旁边。你哪天来，都在。');
    expect(TRANSLATIONS.en.miraBFirstLine).toBe('It is still right beside the other. Any day you come, it is here.');
  });

  test('the science paragraphs stay whole', () => {
    // Mira A keeps the period in the science paragraph — only the first line
    // never counts the 332 days.
    expect(TRANSLATIONS.ch.miraADesc).toContain('332');
    expect(TRANSLATIONS.en.miraADesc).toContain('332');
    // Mira B keeps the nova.
    expect(TRANSLATIONS.ch.miraBDesc).toContain('新星爆发');
    expect(TRANSLATIONS.en.miraBDesc).toContain('nova');
    // The tail's body is unchanged this ticket.
    expect(TRANSLATIONS.ch.tailDesc).toContain('13');
    expect(TRANSLATIONS.en.tailDesc).toContain('13');
  });

  // #91: the tail's card earns its first line — the road sentence — with the
  // science paragraph still whole behind it.
  test('the tail’s first line is the road sentence, verbatim in both languages (#91)', () => {
    expect(TRANSLATIONS.ch.tailFirstLine).toBe('走过的路，留成一条光河。');
    expect(TRANSLATIONS.en.tailFirstLine).toBe('The way we came, left as a river of light.');
    // The first line carries the relationship, not the science numbers.
    expect(TRANSLATIONS.ch.tailFirstLine).not.toContain('13');
    expect(TRANSLATIONS.en.tailFirstLine).not.toContain('13');
  });

  test('the first lines never count the 332-day period', () => {
    expect(TRANSLATIONS.ch.miraAFirstLine).not.toContain('332');
    expect(TRANSLATIONS.en.miraAFirstLine).not.toContain('332');
  });

  test('both languages carry the same key set, with no time-speed copy left', () => {
    expect(Object.keys(TRANSLATIONS.en).sort()).toEqual(Object.keys(TRANSLATIONS.ch).sort());
    expect('timeSpeed' in TRANSLATIONS.en).toBe(false);
    expect('timeSpeed' in TRANSLATIONS.ch).toBe(false);
  });
});
