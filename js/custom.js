// Rotations built by the user ("Build your own…" in My field), scored in the browser with the same code as the
// pipeline (pipeline/lib/rotations_core.mjs), for the pilot field or a field picked on the map.
// The data files on disk never change: the rotations are added to a copy of the data handed to the screens.
import * as core from "../pipeline/lib/rotations_core.mjs";

export const BUILD_VALUE = "__build";
export const MIN_CROPS = 2;
export const MAX_CROPS = 4;

const RULE_FILES = { RULES: "pipeline/agro_rules.json", INCOME: "pipeline/income_ecrea.json", TH: "pipeline/thresholds.json" };

// Rule files used by the scores. Resolves with { RULES, INCOME, TH } or null (offline, blocked).
export async function loadRules(base = new URL("../", import.meta.url)) {
  try {
    const entries = await Promise.all(Object.entries(RULE_FILES).map(async ([k, p]) => {
      const res = await fetch(new URL(p, base), { cache: "no-cache" });
      if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
      return [k, await res.json()];
    }));
    return Object.fromEntries(entries);
  } catch (err) {
    console.info("DeepKore: rotations built by the user are not available:", err.message);
    return null;
  }
}

// True if these data can score a user rotation everywhere (today's climate and every what-if scenario).
export function canBuild(data, rules) {
  return !!(rules && data?.rotations && data?.climate?.monthly && data?.risk_windows?.weeks && Array.isArray(data?.scenarios)
    && data.scenarios.length && data.scenarios.every((s) => core.scenarioClimate(s)));
}

export const cropOptions = (rules) => core.pickableCrops(rules?.RULES);

// Builds one rotation for today's climate. Throws an Error whose message can be shown to the user.
export function buildOne(data, rules, { id, sequence }) {
  return core.buildCustomRotation({
    id, sequence, monthly: data.climate.monthly, weeks: data.risk_windows.weeks,
    RULES: rules.RULES, TH: rules.TH, INCOME: rules.INCOME, period: data.parcel?.period ?? "", today: new Date().toISOString().slice(0, 10),
  });
}

// Copy of data with the user's rotations added to rotations.json and to every scenario (criteria, total, ranking),
// exactly as pipeline/lib/rotations_core.mjs buildScenarios scores them. Rotations that cannot be scored are left out.
export function withCustom(data, rules, customs = []) {
  if (!customs.length || !canBuild(data, rules)) return data;
  const built = [];
  for (const c of customs) {
    try { built.push(buildOne(data, rules, c)); } catch { /* not scorable with these rules: left out */ }
  }
  if (!built.length) return data;
  const scenarios = data.scenarios.map((s) => {
    const clim = core.scenarioClimate(s);
    const criteria = { ...s.criteria };
    for (const r of built) criteria[r.id] = core.scoreRotation(r.sequence, clim.monthly, clim.weeks, rules.RULES, rules.INCOME).scores;
    const scores = { ...s.scores, ...Object.fromEntries(built.map((r) => [r.id, core.totalScore(criteria[r.id])])) };
    return { ...s, criteria, scores, ranking: Object.keys(scores).sort((a, b) => scores[b] - scores[a]) };
  });
  return { ...data, rotations: [...data.rotations, ...built], scenarios };
}

// Store patch that deletes one of the user's rotations; if it was the current one, back to the default.
export function removeCustomPatch(state, id) {
  return {
    custom_rotations: (state.custom_rotations || []).filter((c) => c.id !== id),
    current_rotation: state.current_rotation === id ? "current" : state.current_rotation,
  };
}

// First free id custom-1..custom-max.
export function nextCustomId(customs, max) {
  for (let i = 1; i <= max; i++) if (!customs.some((c) => c.id === `custom-${i}`)) return `custom-${i}`;
  return null;
}
