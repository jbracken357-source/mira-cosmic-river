import { test, expect } from '@playwright/test';
import { rememberFlag, rememberedFlag } from '../../src/lib/rememberedFlag';

function withStorage(value: unknown, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test.describe('remembered flag', () => {
  test('reads the 1 sentinel and writes 1 / 0', () => {
    const memory = new Map<string, string>();
    withStorage(
      {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
      },
      () => {
        expect(rememberedFlag('mira:test')).toBe(false);
        rememberFlag('mira:test');
        expect(memory.get('mira:test')).toBe('1');
        expect(rememberedFlag('mira:test')).toBe(true);
        rememberFlag('mira:test', false);
        expect(memory.get('mira:test')).toBe('0');
        expect(rememberedFlag('mira:test')).toBe(false);
      },
    );
  });

  test('blocked storage stays silent and unread', () => {
    withStorage(
      {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
      () => {
        expect(rememberedFlag('mira:test')).toBe(false);
        expect(() => rememberFlag('mira:test')).not.toThrow();
      },
    );
  });
});
