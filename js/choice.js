// "What do you grow now?": which rotation is the user's current one, and what it is compared with.
// Pure functions (no DOM, no storage), shared by every screen and by tests/choice.test.mjs.
import { rankRotations, weightedTotal, effectiveWeights } from "./scoring.js";

export const DEFAULT_CURRENT = "current";
const ALT_COUNT = 3;

// Rotations the user can say they grow today. Files without can_be_current (data/mock) offer only the default.
// Rotations the user built (custom: true) can always be current.
export function currentOptions(rotations = []) {
  const flagged = rotations.some((r) => r.can_be_current !== undefined && !r.custom);
  return rotations.filter((r) => r.custom || (flagged ? r.can_be_current === true : r.id === DEFAULT_CURRENT));
}

// The current rotation: the stored id if it is still offered, else the default, else the first option.
export function resolveCurrent(rotations = [], storedId) {
  const opts = currentOptions(rotations);
  return opts.find((r) => r.id === storedId) ?? opts.find((r) => r.id === DEFAULT_CURRENT) ?? opts[0] ?? rotations[0] ?? null;
}

// current + the 3 best of the rest for these weights.
// shown: those 4, best first, with `diff` = rounded total - rounded total of the current rotation
// (the same numbers the screens print). currentIsBest: no other rotation scores higher.
export function compareSet(rotations, weights, currentId) {
  const current = resolveCurrent(rotations, currentId);
  const ranked = rankRotations(rotations, weights);
  const cur = ranked.find((x) => x.rotation.id === current?.id);
  const alternatives = ranked.filter((x) => x.rotation.id !== current?.id).slice(0, ALT_COUNT);
  const curRounded = Math.round(cur?.total ?? 0);
  const withDiff = (x) => ({ ...x, isCurrent: x.rotation.id === current?.id, diff: Math.round(x.total) - curRounded });
  const shown = [cur, ...alternatives].filter(Boolean).map(withDiff).sort((a, b) => b.total - a.total || (a.isCurrent ? -1 : 1));
  return {
    current,
    currentTotal: cur?.total ?? 0,
    alternatives: alternatives.map(withDiff),
    shown,
    best: ranked[0] ?? null,
    currentIsBest: !!cur && alternatives.every((a) => a.total <= cur.total),
  };
}

// The same, for one what-if scenario: scores from scenario.criteria (per-criterion, recomputed for that climate)
// weighted with the user's priorities. ids: the rotations to show (from compareSet on today's climate).
// rotations: the full list (decides which criteria are scored, as in rankRotations).
export function scenarioTotals(scenario, ids, weights, rotations = []) {
  const w = rotations.length ? effectiveWeights(rotations, weights) : weights;
  return ids
    .map((id) => {
      const crit = scenario?.criteria?.[id];
      return { id, total: crit ? weightedTotal(crit, w) : Number(scenario?.scores?.[id]) || 0 };
    })
    .sort((a, b) => b.total - a.total);
}
