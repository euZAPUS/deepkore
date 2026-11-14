// Weighted ranking, computed in the browser.
// total = sum(scores[criterion] * weight) / sum(weights)
// A criterion whose score is not a number (e.g. income: null, not scored yet) is left out.

export function weightedTotal(scores, weights) {
  let num = 0;
  let den = 0;
  for (const [criterion, w] of Object.entries(weights)) {
    const s = scores[criterion];
    if (typeof s !== "number" || !(w > 0)) continue;
    num += s * w;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

// Returns a new array of {rotation, total} sorted best first.
export function rankRotations(rotations, weights) {
  return rotations
    .map((rotation) => ({ rotation, total: weightedTotal(rotation.scores, weights) }))
    .sort((a, b) => b.total - a.total);
}

// Scenario closest to the requested rain / temperature change.
export function nearestScenario(scenarios, rainPct, tempDelta) {
  let best = null;
  let bestD = Infinity;
  for (const s of scenarios) {
    // 10 % rain is treated as the same "distance" as 1 °C
    const d = ((s.rain_pct - rainPct) / 10) ** 2 + (s.temp_delta - tempDelta) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// True if at least one rotation has a numeric score for this criterion.
export function isScored(rotations, key) {
  return (rotations || []).some((r) => typeof r?.scores?.[key] === "number");
}

export const NOT_SCORED_NOTE = {
  income: "Income: not scored yet (no verified local prices or yields)",
};
export const notScoredNote = (key, label) => NOT_SCORED_NOTE[key] ?? `${label}: not scored yet`;
