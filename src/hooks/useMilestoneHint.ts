// 最亮/最暗提示 (#88): once per cycle the milestone hint borrows the lower edge
// (下缘) for about eight seconds, then the closing line returns. The arm decision
// is pure (lib/lowerEdge's armMilestone); this shell is the hint's own small
// store so LowerEdge can stay a pure render — the localStorage read, the
// remembered-flag write and the ~8s timer are external systems, and they live
// here in callbacks instead of a render body or an effect body (the same split
// useTonightSave keeps between its machine and its shell).

import { create } from 'zustand';
import { MILESTONE_HINT_MS } from '../constants/animation';
import { armMilestone } from '../lib/lowerEdge';
import type { MilestoneKind } from '../lib/lowerEdge';
import { milestoneStorageKey, phaseMilestone } from '../lib/starClock';
import { rememberFlag, rememberedFlag } from '../lib/rememberedFlag';
import { useBinaryStar } from './useBinaryStar';

interface MilestoneHintStore {
  armed: MilestoneKind | null;
  dismissed: boolean;
}

export const useMilestoneHint = create<MilestoneHintStore>(() => ({
  armed: null,
  dismissed: false,
}));

let initialized = false;

// Idempotent (module scope below; HMR re-evaluates): subscribe the arm check to
// the star store and run it once now, so a direct entry at a milestone epoch arms
// the hint before the lower edge's first render — the closing line never flashes
// in ahead of it.
function initMilestoneHint() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const check = () => {
    const { introComplete, sky } = useBinaryStar.getState();
    const { armed, dismissed } = useMilestoneHint.getState();
    const milestone = phaseMilestone(sky);
    const kind = armMilestone({
      introComplete,
      milestone,
      shownBefore: milestone === 'none' ? false : rememberedFlag(milestoneStorageKey(milestone, sky)),
      armed: armed !== null,
      dismissed,
    });
    if (!kind) return;
    useMilestoneHint.setState({ armed: kind });
    // The once-per-cycle memory is written at arm time (not at dismiss), so a
    // reload inside the window never fires the hint twice.
    rememberFlag(milestoneStorageKey(kind, sky));
    window.setTimeout(() => useMilestoneHint.setState({ dismissed: true }), MILESTONE_HINT_MS);
  };
  useBinaryStar.subscribe((state, prev) => {
    // The sky is re-read when the tab returns to the foreground; the arm guards
    // (armed / shownBefore) make a re-check a no-op once the window has run.
    if (state.introComplete !== prev.introComplete || state.sky !== prev.sky) check();
  });
  check();
}

initMilestoneHint();
