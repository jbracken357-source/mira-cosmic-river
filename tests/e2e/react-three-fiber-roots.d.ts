// The part of @react-three/fiber that daily-sky.spec.ts reads in the page: the
// registry from canvas to root, down to the material uniforms the spec polls.
// The spec imports the dev server's pre-bundled copy, so it gets the module
// instance the app loaded. tsconfig.tests.json maps that URL to this file.
type PolledObject = { material?: { uniforms?: Record<string, { value?: unknown }> } };

export const _roots: Map<
  HTMLCanvasElement,
  { store: { getState: () => { scene: { traverse(callback: (object: PolledObject) => void): void } } } }
>;
