// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { weightedTotal, rankRotations, nearestScenario } from "../js/scoring.js";

test("weightedTotal follows sum(score*w)/sum(w)", () => {
  const scores = { water: 40, soil: 80, income: 60, erosion: 20 };
  assert.equal(weightedTotal(scores, { water: 1, soil: 1, income: 1, erosion: 1 }), 50);
  assert.equal(weightedTotal(scores, { water: 0, soil: 100, income: 0, erosion: 0 }), 80);
  assert.equal(weightedTotal(scores, { water: 3, soil: 1 }), (40 * 3 + 80) / 4);
});

test("weightedTotal is 0 when all weights are 0", () => {
  assert.equal(weightedTotal({ water: 50 }, { water: 0 }), 0);
});

test("rankRotations sorts best first", () => {
  const rots = [
    { id: "x", scores: { water: 10, income: 90 } },
    { id: "y", scores: { water: 90, income: 10 } },
  ];
  assert.deepEqual(rankRotations(rots, { water: 1, income: 0 }).map((r) => r.rotation.id), ["y", "x"]);
  assert.deepEqual(rankRotations(rots, { water: 0, income: 1 }).map((r) => r.rotation.id), ["x", "y"]);
});

test("nearestScenario picks the closest grid point", () => {
  const grid = [
    { rain_pct: 0, temp_delta: 0 },
    { rain_pct: -20, temp_delta: 1 },
    { rain_pct: -40, temp_delta: 3 },
  ];
  assert.equal(nearestScenario(grid, -18, 1.2), grid[1]);
  assert.equal(nearestScenario(grid, 5, 0), grid[0]);
});
