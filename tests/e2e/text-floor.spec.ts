import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MIRA_MAXIMUM_EPOCH_MS } from '../../src/lib/starClock';
import {
  dragOffMainView,
  expectTextFloor,
  IDLE_FAST,
  manipulateScene,
  MID_DECLINE_EPOCH,
  openStarCardViaKeyboard,
  openTailCardViaKeyboard,
} from './helpers';

// 文字底线 (#113): 中文文字不小于 12px，文字颜色不透明度不低于 0.55。The two
// floors are traversed, not spot-checked: for every interface state the viewer
// can sit in, every visible Chinese-bearing text node is measured (the shared
// collector and its decorative-separator exemption live in helpers.ts), and
// each node must clear both floors. 焦点 (#113): the info card as a program
// focus target carries no browser default outline (its own border already says
// where it is); the shared purple button ring stays (interface.spec's pin).
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). The epoch pins tonight off every milestone window, so the lower
// edge (#88) always holds the closing line in these tests.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const SEEN_KEY = 'mira:seen-opening';

// Entrance fades start at opacity 0, and the collector's visibility filter
// drops anything under 0.05 — a surface collected mid-fade would be silently
// absent from the measured set. Each animated surface is settled to opacity 1
// before its traversal (computed style, on the element that carries the fade).
async function expectSettled(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toHaveCSS('opacity', '1', { timeout: 10000 });
}

async function gotoExplore(page: Page, url = APP) {
  await page.addInitScript(
    ({ seenKey }) => {
      localStorage.setItem(seenKey, '1');
      localStorage.removeItem('mira:learned-controls');
    },
    { seenKey: SEEN_KEY },
  );
  await page.goto(url);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  // A keypress restamps the shared idle clock so the idle takeover never fires
  // mid-assertion on slow software rendering (same guard as top-bar.spec) — and
  // it keeps the keyboard context that focus decisions read.
  await page.keyboard.press('Shift');
}

test.describe('文字底线：自由观看 (desktop)', () => {
  test('第一眼：顶栏、操作提示与下缘的终幕那句', async ({ page }) => {
    await gotoExplore(page);
    await expect(page.getByTestId('interaction-hint')).toBeVisible();
    await expectSettled(page, 'interaction-hint');
    await expectTextFloor(page, '自由观看第一眼');
  });

  test('毕业后与离开主视角的顶栏', async ({ page }) => {
    await gotoExplore(page);
    await manipulateScene(page);
    await expect(page.getByTestId('tonight-save')).toBeVisible();
    await expectTextFloor(page, '自由观看毕业后');

    await dragOffMainView(page);
    await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
    await expectTextFloor(page, '自由观看离开主视角');
  });

  test('结语浮现时，结语本身清底线', async ({ page }) => {
    await gotoExplore(page, `${APP}${IDLE_FAST}`);
    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    await expectSettled(page, 'epilogue-text');
    await expectTextFloor(page, '结语');
  });

  test('周期最亮/最暗提示借住下缘时也清底线', async ({ page }) => {
    // The maximum epoch arms the milestone hint on entry (the same seam
    // lower-edge.spec pins); 本周期最亮 borrows the lower edge for ~8s.
    await gotoExplore(
      page,
      `/?quality=low&epoch=${Math.round(MIRA_MAXIMUM_EPOCH_MS / 1000)}`,
    );
    const hint = page.getByTestId('milestone-hint');
    await expect(hint).toBeVisible({ timeout: 15000 });
    await expectSettled(page, 'milestone-hint');
    await expectTextFloor(page, '周期最亮提示');
  });

  test('键盘入口的三枚触发器（聚焦后可见）', async ({ page }) => {
    await gotoExplore(page);
    // Focusing one trigger reveals all three (focus-within lifts the sr-only
    // wrapper) — the state a tabbing viewer actually sees.
    await page.getByTestId('star-trigger-miraA').focus();
    await expect(page.getByTestId('star-trigger-miraA')).toBeVisible();
    await expectTextFloor(page, '键盘触发器');
  });
});

test.describe('文字底线：信息卡', () => {
  for (const star of ['miraA', 'miraB', 'tail'] as const) {
    test(`三张信息卡都清底线 (${star})`, async ({ page }) => {
      await gotoExplore(page);
      if (star === 'tail') {
        await openTailCardViaKeyboard(page);
      } else {
        await openStarCardViaKeyboard(page, star);
      }
      await expectSettled(page, 'info-card');
      await expectTextFloor(page, `信息卡 ${star}`);
    });
  }
});

test.describe('文字底线：今晚的 Mira 面板', () => {
  test('预览面板：标题、选项与动作', async ({ page }) => {
    await gotoExplore(page);
    await manipulateScene(page);
    await page.getByTestId('tonight-save').click();
    const panel = page.getByTestId('tonight-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-tonight-phase', 'preview');
    await expect(page.getByTestId('tonight-preview')).toBeVisible({ timeout: 15000 });
    await expectSettled(page, 'tonight-panel');
    await expectTextFloor(page, '今晚面板预览');
  });
});

// 双星出画 (#114): the offscreen row rides the 竖屏长卷's framing — there a
// plain drag swings the pair out; on the wide desktop framing the same gesture
// keeps both stars in, so the notice never shows there (tonight-save.spec's
// finding). The drag is probe-driven: the canvas's dev probes say when a star
// center is really out.
const centerOutOfFrame = (point: [number, number] | null) =>
  point !== null && (point[0] < 0 || point[0] > 100 || point[1] < 0 || point[1] > 100);

async function dragStarsOffscreen(page: Page) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas has no box');
  const centers = () =>
    page.locator('canvas').evaluate((el) => {
      const read = (name: string): [number, number] | null => {
        const raw = el.getAttribute(name);
        if (!raw) return null;
        const [x, y] = raw.split(',').map(Number);
        return [x, y];
      };
      return [read('data-mira-a-screen'), read('data-mira-b-screen')];
    });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cx = box.x + box.width * 0.7;
    const cy = box.y + box.height * 0.3;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 220 + attempt * 140, cy + 40, { steps: 8 });
    await page.mouse.up();
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const [a, b] = await centers();
      if (centerOutOfFrame(a) || centerOutOfFrame(b)) return;
      await page.waitForTimeout(200);
    }
  }
  throw new Error('the drag never carried a star center out of the frame');
}

test.describe('文字底线：完整开场与入场', () => {
  test('入场静帧的说明', async ({ page }) => {
    // The materials hang, so the gate holds the recorded still and its caption
    // — the entry moment a first-time viewer actually reads.
    await page.route('**/materials/*.webp', () => new Promise(() => {}));
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    const loading = page.getByTestId('loading');
    await expect(loading).toBeVisible();
    await expectTextFloor(page, '入场静帧');
  });

  test('三句字幕、终幕标题与右上角控制', async ({ page }) => {
    // cinematic-scale 0.4 stretches the 15s sequence to ~37s, so each caption
    // holds its window long enough to be caught settled.
    await page.addInitScript((key) => localStorage.removeItem(key), SEEN_KEY);
    await page.goto(`${APP}&cinematic-scale=0.4`);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 30000 });
    await expectTextFloor(page, '完整开场控制');

    const captions = [
      '在浩瀚宇宙里，我们遇见彼此。',
      '彼此牵引，一起走向更远。',
      '走过的路，留成一条光河。',
    ];
    for (const caption of captions) {
      await expect(page.getByText(caption)).toBeVisible({ timeout: 30000 });
      // The caption's own fade is ≤0.75s wall clock (unscaled); the container
      // carries no testid, so the settle is a wait past the fade's end.
      await page.waitForTimeout(900);
      await expectTextFloor(page, `完整开场字幕 ${caption.slice(0, 6)}`);
    }
    await expect(page.getByTestId('final-title')).toBeVisible({ timeout: 30000 });
    await expectSettled(page, 'final-title');
    await expectTextFloor(page, '完整开场终幕标题');
  });
});

test.describe('文字底线：静态后备页', () => {
  test('WebGL 不可用时的如实文案', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, '1'), SEEN_KEY);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return original.call(this, type, ...args);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expectTextFloor(page, '静态后备页');
  });
});

test.describe('文字底线：390×844 竖屏', () => {
  test.beforeEach(({ page }) => {
    page.setViewportSize({ width: 390, height: 844 });
  });

  test('compact 顶栏与「更多」面板', async ({ page }) => {
    await gotoExplore(page);
    await manipulateScene(page);
    await expect(page.getByTestId('tonight-save')).toBeVisible();
    await expectTextFloor(page, '390 compact 顶栏');

    await page.getByTestId('more-toggle').click();
    await expectSettled(page, 'more-panel');
    await expectTextFloor(page, '390 「更多」面板');
  });

  test('信息卡（下缘 sheet）与今晚面板', async ({ page }) => {
    await gotoExplore(page);
    await openTailCardViaKeyboard(page);
    await expectSettled(page, 'info-card');
    await expectTextFloor(page, '390 信息卡 sheet');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('info-card')).toHaveCount(0);
    await manipulateScene(page);
    await page.getByTestId('tonight-save').click();
    await expect(page.getByTestId('tonight-panel')).toHaveAttribute('data-tonight-phase', 'preview');
    await expectSettled(page, 'tonight-panel');
    await expectTextFloor(page, '390 今晚面板');
  });

  test('出画说明行（双星不在画面里）', async ({ page }) => {
    await gotoExplore(page);
    await dragStarsOffscreen(page);
    await page.getByTestId('tonight-save').click();
    const panel = page.getByTestId('tonight-panel');
    await expect(panel).toHaveAttribute('data-tonight-phase', 'preview');
    await expect(page.getByTestId('tonight-offscreen')).toBeVisible({ timeout: 15000 });
    await expectSettled(page, 'tonight-panel');
    await expectTextFloor(page, '390 今晚面板出画行');
  });
});

test.describe('compact 顶栏在 12px 中文下仍是一行（#111 × #113）', () => {
  // The 12px Chinese floor meets #111's one-row compact bar. zh at its fullest
  // — 主视角, 今晚的 Mira, 环境音, 「更多」 — must still top out on one line at both
  // phone frames; the bar keeps the quiet first look's height. (en keeps
  // #111's 10px via compact-label: at 12px the en labels cannot hold the row —
  // 「Ambient sound」 alone measures 103px — and en with 主视角 at 320 was already
  // two-line at 10px in #111's own baseline, so no en one-row claim is made
  // here beyond #111's pins in more-menu.spec.)
  async function expectOneRow(page: Page, testIds: string[], quietHeight: number) {
    const tops: number[] = [];
    const bottoms: number[] = [];
    for (const testId of testIds) {
      const box = await page.getByTestId(testId).boundingBox();
      expect(box, `${testId} has a box`).toBeTruthy();
      tops.push(Math.round(box!.y));
      bottoms.push(Math.round(box!.y + box!.height));
    }
    expect(new Set(tops).size, `[${testIds}] top out on one line`).toBe(1);
    expect(new Set(bottoms).size, `[${testIds}] bottom out on one line`).toBe(1);
    const bar = await page.getByTestId('top-bar').boundingBox();
    expect(Math.round(bar!.height), 'graduation does not grow the compact bar').toBe(
      Math.round(quietHeight),
    );
  }

  for (const frame of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    test(`zh：离开主视角的满行仍是一行 (${frame.width}×${frame.height})`, async ({ page }) => {
      await page.setViewportSize(frame);
      await gotoExplore(page);
      const quietHeight = await page.getByTestId('top-bar').boundingBox().then((b) => b!.height);

      await dragOffMainView(page);
      await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
      await expectOneRow(
        page,
        ['return-to-view', 'tonight-save', 'ambient-toggle', 'more-toggle'],
        quietHeight,
      );
    });
  }
});

test.describe('信息卡的程序焦点 (#113)', () => {
  test('键盘打开后，卡片容器不带浏览器默认轮廓', async ({ page }) => {
    await gotoExplore(page);
    await openStarCardViaKeyboard(page, 'miraA');
    const card = page.getByTestId('info-card');
    await expect(card).toBeFocused();
    // The card's own border says where it is; the browser default outline must
    // not double it. Computed style, not class names.
    const outline = await card.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('none');

    // The shared ring still belongs to real buttons: the card's close control
    // keeps the interface's focus voice.
    const close = page.getByTestId('info-card-close');
    await close.focus();
    const closeOutline = await close.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(closeOutline).toBe('solid');
  });
});

// Evidence captures: the after shots of the 文字底线 (before-*.png pairs in the
// same folder were taken on the #111 baseline), kept as living tests so the
// proof re-renders whenever the interface changes.
const EVIDENCE = 'docs/evidence-113';

test.describe('evidence captures (#113)', () => {
  test('after: desktop explore graduated', async ({ page }) => {
    await gotoExplore(page);
    await manipulateScene(page);
    await expect(page.getByTestId('tonight-save')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${EVIDENCE}/after-desktop-1280x720-explore.png` });
  });

  test('after: desktop info card (keyboard-opened, no default outline)', async ({ page }) => {
    await gotoExplore(page);
    await openTailCardViaKeyboard(page);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${EVIDENCE}/after-desktop-1280x720-info-card.png` });
  });

  test('after: desktop tonight panel', async ({ page }) => {
    await gotoExplore(page);
    await manipulateScene(page);
    await page.getByTestId('tonight-save').click();
    await expect(page.getByTestId('tonight-preview')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${EVIDENCE}/after-desktop-1280x720-tonight-panel.png` });
  });

  test('after: 390 graduated bar + more panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoExplore(page);
    await manipulateScene(page);
    await expect(page.getByTestId('tonight-save')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${EVIDENCE}/after-mobile-390x844-bar.png` });
    await page.getByTestId('more-toggle').click();
    await expect(page.getByTestId('more-panel')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${EVIDENCE}/after-mobile-390x844-more-panel.png` });
  });

  test('after: 390 info card sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoExplore(page);
    await openTailCardViaKeyboard(page);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${EVIDENCE}/after-mobile-390x844-info-card.png` });
  });
});
