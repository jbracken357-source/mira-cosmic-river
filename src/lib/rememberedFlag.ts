// One-shot and preference flags in localStorage: the `'1'` sentinel, wrapped so
// private mode and blocked storage stay silent. Four call sites used to copy
// the same try/catch.

export function rememberedFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function rememberFlag(key: string, on: boolean = true): void {
  try {
    globalThis.localStorage?.setItem(key, on ? '1' : '0');
  } catch {
    // Private mode / blocked storage: the session still works, it just won't remember.
  }
}
