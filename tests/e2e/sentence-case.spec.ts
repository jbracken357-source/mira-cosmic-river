import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { TRANSLATIONS } from '../../src/constants/translations';
import { dragOffMainView, manipulateScene, MID_DECLINE_EPOCH } from './helpers';

// 句首大写 (#110): the English controls — the 顶栏, the 完整开场's own controls,
// the 今晚的 Mira panel, and the 信息卡 keyboard triggers — read in sentence case.
// #90's "今晚的 Mira never all-caps" rule now holds for the whole row: the casing
// is the translations' own, never a CSS rewrite, so the visible words must equal
// the constants letter for letter. Chinese is untouched.
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). The epoch pins tonight off every milestone window, so the lower
// edge (#88) always holds the closing line in these tests.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const EN = TRANSLATIONS.en;
const CH = TRANSLATIONS.ch;

// A control reads as written: no text-transform rewrites its case, and the words
// on screen are the translations' own.
async function readsAsWritten(control: Locator, expected: string) {
  await expect(control).toBeVisible();
  expect(await control.evaluate((el) => getComputedStyle(el).textTransform)).toBe('none');
  await expect(control).toHaveText(expected);
}

async function gotoExplore(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:learned-controls');
  });
  await page.goto(APP);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  // The pose attribute lands at the end of the first completed frame: the scene is
  // really running before any control is measured.
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

async function switchToEnglish(page: Page) {
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

// The graduated 顶栏 with 主视角 up: every control on the reviewed screenshot.
async function gotoFullEnglishBar(page: Page) {
  await gotoExplore(page);
  await switchToEnglish(page);
  await manipulateScene(page);
  await dragOffMainView(page);
  await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
}

test.describe('the English top bar reads in sentence case', () => {
  test('every control keeps the translations casing — no uppercase rewrite', async ({ page }) => {
    await gotoFullEnglishBar(page);

    await readsAsWritten(page.getByTestId('return-to-view'), EN.returnToView);
    await readsAsWritten(page.getByTestId('tonight-save'), EN.tonightSave);
    await readsAsWritten(page.getByTestId('ambient-toggle'), EN.ambientSound);
    await readsAsWritten(page.getByTestId('pause-toggle'), EN.pause);
    await readsAsWritten(page.getByTestId('replay-opening'), EN.replayOpening);
  });
});

test.describe('the full cinematic controls read in sentence case', () => {
  test('「我自己看」 and 环境音 keep the translations casing during the opening', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('mira:seen-opening'));
    await page.goto(APP);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });

    await switchToEnglish(page);
    await readsAsWritten(page.getByTestId('look-myself'), EN.lookMyself);
    await readsAsWritten(page.getByTestId('ambient-toggle'), EN.ambientSound);
    // The language switch names the language to come — its own label, no transform.
    expect(
      await page.getByTestId('language-toggle').evaluate((el) => getComputedStyle(el).textTransform),
    ).toBe('none');
  });
});

test.describe('the 今晚的 Mira panel reads in sentence case', () => {
  test('the panel controls keep the translations casing', async ({ page }) => {
    await gotoExplore(page);
    await switchToEnglish(page);
    await manipulateScene(page);

    await page.getByTestId('tonight-save').click();
    const panel = page.getByTestId('tonight-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-tonight-phase', 'preview');

    await readsAsWritten(page.getByTestId('tonight-close'), EN.tonightClose);
    await readsAsWritten(page.getByTestId('tonight-toggle-date'), EN.tonightAddDate);
    await readsAsWritten(page.getByTestId('tonight-toggle-phrase'), EN.tonightAddPhrase);
    await readsAsWritten(page.getByTestId('tonight-export'), EN.tonightDownload);
  });
});

test.describe('the info card triggers read in sentence case', () => {
  test('the keyboard triggers keep the translations casing once focused', async ({ page }) => {
    await gotoExplore(page);
    await switchToEnglish(page);

    // The triggers are sr-only until tabbed to; focusing one reveals it.
    const miraA = page.getByTestId('star-trigger-miraA');
    await miraA.focus();
    await readsAsWritten(miraA, EN.miraA);

    const miraB = page.getByTestId('star-trigger-miraB');
    await miraB.focus();
    await readsAsWritten(miraB, EN.miraB);

    const tail = page.getByTestId('star-trigger-tail');
    await tail.focus();
    await readsAsWritten(tail, EN.tailLabel);
  });
});

test.describe('the static fallback retry reads in sentence case', () => {
  test('a lost context offers Retry in the translations casing', async ({ page }) => {
    await gotoExplore(page);
    await switchToEnglish(page);

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = (canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')) as
        | (WebGLRenderingContext & { getExtension(name: 'WEBGL_lose_context'): { loseContext(): void } | null })
        | null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    });

    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await readsAsWritten(page.getByTestId('scene-fallback-retry'), EN.sceneRetry);
  });
});

test.describe('Chinese keeps its own appearance', () => {
  test('the 顶栏 and the 今晚的 Mira panel still read the translations words', async ({ page }) => {
    await gotoExplore(page);
    await manipulateScene(page);
    await dragOffMainView(page);
    await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });

    await readsAsWritten(page.getByTestId('return-to-view'), CH.returnToView);
    await readsAsWritten(page.getByTestId('tonight-save'), CH.tonightSave);
    await readsAsWritten(page.getByTestId('ambient-toggle'), CH.ambientSound);
    await readsAsWritten(page.getByTestId('pause-toggle'), CH.pause);
    await readsAsWritten(page.getByTestId('replay-opening'), CH.replayOpening);

    await page.getByTestId('tonight-save').click();
    const panel = page.getByTestId('tonight-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-tonight-phase', 'preview');
    await readsAsWritten(page.getByTestId('tonight-close'), CH.tonightClose);
    await readsAsWritten(page.getByTestId('tonight-toggle-date'), CH.tonightAddDate);
    await readsAsWritten(page.getByTestId('tonight-toggle-phrase'), CH.tonightAddPhrase);
    await readsAsWritten(page.getByTestId('tonight-export'), CH.tonightDownload);
  });
});
