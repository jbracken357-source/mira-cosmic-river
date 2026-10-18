import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Shared e2e seams. Not a spec (helpers.ts matches no testMatch pattern).

// The pinned mid-decline date: no milestone window, so the lower edge (#88) always
// holds the closing line in specs that assert it (the same date integration-journey
// pins for the same reason).
export const MID_DECLINE_EPOCH = '2026-09-12T00%3A00%3A00Z';

// The dev-only idle overrides that compress the 30s/60s viewer-control rules into
// seconds (gated like ?epoch=; production ignores them). Same values as
// viewer-control.spec's SCALED set.
export const IDLE_FAST = '&idle-resume=1000&idle-ramp=800&idle-epilogue=4000&idle-lead=800';

// The tail's keyboard entry (#88): with the treasure-hunt hint gone from the lower
// edge, the scene itself and this sr-only trigger are the tail's doors.
export async function openTailCardViaKeyboard(page: Page) {
  const trigger = page.getByTestId('star-trigger-tail');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('info-card')).toBeVisible();
}

// A star's keyboard entry, same gesture as the tail's.
export async function openStarCardViaKeyboard(page: Page, star: 'miraA' | 'miraB') {
  const trigger = page.getByTestId(`star-trigger-${star}`);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('info-card')).toBeVisible();
}

// 第一次拖拽或缩放 (#90): a wheel-zoom on the canvas counts as scene manipulation —
// it graduates the quiet top bar (暂停 and 今晚的 Mira appear) and retires the
// gesture hint. Presses on UI controls never count, which is why the specs drive
// the canvas itself.
export async function manipulateScene(page: Page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
}

// 镜头离开主视角 (#90): a real drag that carries the camera off the main view, so
// 「主视角」 appears. Starts from empty sky (upper right) so no click target opens
// a card on the way.
export async function dragOffMainView(page: Page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  const cx = box.x + box.width * 0.8;
  const cy = box.y + box.height * 0.25;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 160, cy + 40, { steps: 8 });
  await page.mouse.up();
}

// 文字底线 (#113): the two floors every visible Chinese-bearing text node must
// clear — 中文 ≥ 12px, 文字颜色 alpha ≥ 0.55 (spec #107's 文字底线).
export const MIN_FONT_PX = 12;
export const MIN_COLOR_ALPHA = 0.55;

export interface TextSample {
  text: string;
  testid: string;
  tag: string;
  fontSize: number;
  alpha: number;
}

// The 文字底线 traversal's in-page collector: one pass over the live DOM,
// returning every visible Chinese text node with the two measured numbers.
// Only nodes whose text carries CJK are collected — the size floor is about
// Chinese strokes going muddy below 12px, and that is also the exemption for
// pure-decorative separators: a 「·」 that carries no reading content holds no
// CJK glyph, so it never enters the measured set (today the dots ride inside
// sentence strings like 拖拽旋转 · 滚轮缩放, measured with their dots as reading
// rhythm). If a standalone decorative node ever appears, keeping it non-CJK (or
// aria-hidden) keeps it out of the floor.
export const TEXT_FLOOR_COLLECTOR = (): TextSample[] => {
  const CJK = /[\u3400-\u9FFF\uF900-\uFAFF\u3001-\u303F\uFF01-\uFF5E]/;
  const alphaOf = (color: string): number => {
    // rgba(r, g, b, a) — the legacy comma form.
    const legacy = /rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(color);
    if (legacy) return Number(legacy[1]);
    // Modern forms carry the alpha behind a slash: color(srgb … / a),
    // oklab(… / a), oklch(… / a). No slash → fully opaque.
    const slash = /\/\s*([\d.]+)\s*%?\)/.exec(color);
    if (slash) return Number(slash[1]);
    return 1;
  };
  const visible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node instanceof Element) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      // The epilogue hush and mid-exit fades drop whole regions below sight.
      if (Number(cs.opacity) < 0.05) return false;
      node = node.parentElement;
    }
    return true;
  };
  const samples: TextSample[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = (node.nodeValue ?? '').trim();
    if (!text || !CJK.test(text)) continue;
    const el = node.parentElement;
    if (!el || el.closest('script, style, noscript, canvas')) continue;
    if (!visible(el)) continue;
    // sr-only affordances are not viewer-visible until focus reveals them
    // (Tailwind's focus-within:not-sr-only) — a Range's layout rect ignores the
    // 1px clip, so the reveal state itself is the tell.
    const srOnlyHost = el.closest('.sr-only');
    if (srOnlyHost && !srOnlyHost.matches(':focus-within')) continue;
    const cs = getComputedStyle(el);
    samples.push({
      text: text.slice(0, 16),
      testid: el.closest('[data-testid]')?.getAttribute('data-testid') ?? '',
      tag: el.tagName,
      fontSize: Number.parseFloat(cs.fontSize),
      alpha: alphaOf(cs.color),
    });
  }
  return samples;
};

export async function collectTextSamples(page: Page): Promise<TextSample[]> {
  return page.evaluate(TEXT_FLOOR_COLLECTOR);
}

// Both floors against one state's samples. The message names the offending
// node so a failure points at the copy, not a class.
export async function expectTextFloor(page: Page, state: string): Promise<number> {
  const samples = await collectTextSamples(page);
  expect(samples.length, `${state}: no Chinese text nodes collected`).toBeGreaterThan(0);
  for (const s of samples) {
    expect(
      s.fontSize,
      `${state}: 「${s.text}」 (${s.testid || s.tag}) falls under the ${MIN_FONT_PX}px Chinese floor`,
    ).toBeGreaterThanOrEqual(MIN_FONT_PX - 0.05);
    expect(
      s.alpha,
      `${state}: 「${s.text}」 (${s.testid || s.tag}) text alpha falls under ${MIN_COLOR_ALPHA}`,
    ).toBeGreaterThanOrEqual(MIN_COLOR_ALPHA - 0.001);
  }
  return samples.length;
}
