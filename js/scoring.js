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

// Weights with every criterion that is not scored for all these rotations set to 0 (see isScored),
// so no rotation is ranked on a criterion the others do not have.
export function effectiveWeights(rotations, weights) {
  return Object.fromEntries(Object.entries(weights || {}).map(([k, w]) => [k, isScored(rotations, k) ? w : 0]));
}

// Returns a new array of {rotation, total} sorted best first.
export function rankRotations(rotations, weights) {
  const w = effectiveWeights(rotations, weights);
  return rotations
    .map((rotation) => ({ rotation, total: weightedTotal(rotation.scores, w) }))
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

// True if every rotation has a numeric score for this criterion (a criterion scored for only some
// rotations would make the ranking unfair, so it stays out until all have it).
export function isScored(rotations, key) {
  return (rotations || []).length > 0 && rotations.every((r) => typeof r?.scores?.[key] === "number");
}

export function notScoredNote(key, label, rotations = []) {
  if (key === "income") {
    const withMargin = rotations.filter((r) => typeof r?.income?.eur_ha_year === "number").length;
    return withMargin
      ? `Income: not in the ranking yet (verified net margins for ${withMargin} of ${rotations.length} rotations; see each rotation)`
      : "Income: not scored yet (no verified local prices or yields)";
  }
  return `${label}: not scored yet`;
}
