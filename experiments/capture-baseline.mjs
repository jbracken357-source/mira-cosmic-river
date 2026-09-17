// Capture a labelled screenshot baseline set.
//
//   node experiments/capture-baseline.mjs <label>
//
// Writes docs/design-audit-2026-09-17/baselines/<label>/ with one PNG per view plus a
// manifest.json (epoch, seeds, camera poses, viewport, dpr, quality tier, git commit).
// Boots its own dev server on a free port; safe to run while nothing else is running.
// Reproduce a set by re-running with the same label at the same git commit.
import path from 'node:path';
import {
  VIEWS,
  buildManifest,
  captureViews,
  freePort,
  startDevServer,
  writeManifest,
} from './baseline-harness.mjs';

const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) {
  console.error('usage: node experiments/capture-baseline.mjs <label> (lowercase letters, digits, dashes)');
  process.exit(2);
}

const outDir = path.join('docs', 'design-audit-2026-09-17', 'baselines', label);
const port = await freePort();
const server = await startDevServer(port);
try {
  console.log(`capturing "${label}" from ${server.baseUrl} into ${outDir}`);
  const views = await captureViews({ baseUrl: server.baseUrl, outDir, views: VIEWS });
  const manifest = buildManifest({ label, views });
  await writeManifest(outDir, manifest);
  for (const view of views) {
    const notes = [];
    if (!view.texturesReady) notes.push('texture readiness not confirmed (fell back to timed wait)');
    if (view.pageErrors.length) notes.push(`page errors: ${view.pageErrors.join('; ')}`);
    console.log(`  ${view.file}${notes.length ? ' — ' + notes.join(' — ') : ''}`);
  }
  console.log(`baseline "${label}" captured at ${manifest.gitCommit ?? 'unknown commit'}`);
} finally {
  server.child.kill();
}
