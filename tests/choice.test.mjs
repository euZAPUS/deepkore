// "What do you grow now?": current rotation, alternatives, scenarios and stored choice.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { currentOptions, resolveCurrent, compareSet, scenarioTotals, DEFAULT_CURRENT } from "../js/choice.js";
import { rankRotations } from "../js/scoring.js";
import { validateRotations, validateScenarios, validateScenariosCover } from "../js/contract.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const rotations = read("data/rotations.json");
const scenarios = read("data/scenarios.json");
const before = read("tests/fixtures/scores_before_catalog.json").scores;
const DEFAULT_WEIGHTS = { water: 70, soil: 70, income: 50, erosion: 60 };
const byId = Object.fromEntries(rotations.map((r) => [r.id, r]));

test("data files pass the contract and scenarios cover every rotation", () => {
  assert.deepEqual(validateRotations(rotations), []);
  assert.deepEqual(validateScenarios(scenarios), []);
  assert.deepEqual(validateScenariosCover(scenarios, rotations), []);
});

test("default current rotation and default priorities: current 51, best reported", () => {
  const set = compareSet(rotations, DEFAULT_WEIGHTS, DEFAULT_CURRENT);
  assert.equal(set.current.id, "current");
  assert.deepEqual(set.current.sequence, ["Durum wheat", "Sunflower"]);
  assert.equal(Math.round(set.currentTotal), 51);
  console.log(`  default best: ${set.best.rotation.id} (${set.best.rotation.name}) ${Math.round(set.best.total)} vs current ${Math.round(set.currentTotal)}`);
  // The pitch says 51 -> 68 (B: Barley - Vetch - Durum wheat). B still scores 68, but since F (Durum wheat - Lentil)
  // was added it ranks first with 70 (see NIGHT_REPORT.md). Asserted so any later change is noticed.
  assert.equal(Math.round(rankRotations(rotations, DEFAULT_WEIGHTS).find((x) => x.rotation.id === "B").total), 68);
  assert.equal(set.best.rotation.id, "F");
  assert.equal(Math.round(set.best.total), 70);
});

test("scores of the 4 original rotations did not change", () => {
  for (const [id, scores] of Object.entries(before)) assert.deepEqual(byId[id].scores, scores, id);
});

test("every rotation has can_be_current; the default can be current", () => {
  for (const r of rotations) assert.equal(typeof r.can_be_current, "boolean", r.id);
  assert.equal(byId.current.can_be_current, true);
  assert.ok(currentOptions(rotations).length >= 2);
});

for (const weights of [DEFAULT_WEIGHTS, { water: 100, soil: 0, income: 0, erosion: 0 }, { water: 0, soil: 100, income: 0, erosion: 20 }, { water: 10, soil: 10, income: 100, erosion: 90 }]) {
  test(`alternatives for every possible current rotation (weights ${JSON.stringify(weights)})`, () => {
    for (const cur of currentOptions(rotations)) {
      const set = compareSet(rotations, weights, cur.id);
      assert.equal(set.current.id, cur.id);
      assert.equal(set.alternatives.length, 3, cur.id);
      assert.ok(set.alternatives.every((a) => a.rotation.id !== cur.id), `${cur.id} repeated as alternative`);
      for (let i = 1; i < set.alternatives.length; i++) assert.ok(set.alternatives[i - 1].total >= set.alternatives[i].total);
      for (let i = 1; i < set.shown.length; i++) assert.ok(set.shown[i - 1].total >= set.shown[i].total);
      for (const a of set.alternatives) assert.equal(a.diff, Math.round(a.total) - Math.round(set.currentTotal));
      // the alternatives are the 3 best of the rest
      const rest = rankRotations(rotations, weights).filter((x) => x.rotation.id !== cur.id).slice(0, 3).map((x) => x.rotation.id);
      assert.deepEqual(set.alternatives.map((a) => a.rotation.id), rest);
      assert.equal(new Set(set.shown.map((x) => x.rotation.id)).size, 4);
    }
  });
}

test("current rotation already ranks first: flag set, next 3 as alternatives, no repeat", () => {
  // Durum wheat - Chickpea has the highest soil score: with soil only it ranks first
  const weights = { water: 0, soil: 100, income: 0, erosion: 0 };
  const set = compareSet(rotations, weights, "A");
  assert.equal(set.currentIsBest, true);
  assert.equal(set.shown[0].rotation.id, "A");
  assert.ok(set.alternatives.every((a) => a.rotation.id !== "A" && a.diff <= 0));
  assert.equal(compareSet(rotations, DEFAULT_WEIGHTS, "current").currentIsBest, false);
});

test("scenarios: every scenario scores all rotations; (0 %, +0 °C) equals rotations.json", () => {
  const ids = rotations.map((r) => r.id).sort();
  for (const s of scenarios) {
    assert.deepEqual(Object.keys(s.scores).sort(), ids);
    assert.deepEqual(Object.keys(s.criteria).sort(), ids);
    assert.deepEqual([...s.ranking].sort(), ids);
  }
  const zero = scenarios.find((s) => s.rain_pct === 0 && s.temp_delta === 0);
  for (const r of rotations) assert.deepEqual(zero.criteria[r.id], r.scores, r.id);
});

test("What-if at today's climate shows the same totals as Compare rotations", () => {
  const zero = scenarios.find((s) => s.rain_pct === 0 && s.temp_delta === 0);
  for (const cur of currentOptions(rotations)) {
    const set = compareSet(rotations, DEFAULT_WEIGHTS, cur.id);
    const ids = set.shown.map((x) => x.rotation.id);
    const wi = scenarioTotals(zero, ids, DEFAULT_WEIGHTS, rotations);
    assert.deepEqual(wi.map((x) => x.id), ids);
    wi.forEach((x, i) => assert.equal(x.total, set.shown[i].total));
  }
});

test("unknown stored id falls back to the default rotation", () => {
  assert.equal(resolveCurrent(rotations, "does-not-exist").id, "current");
  assert.equal(resolveCurrent(rotations, undefined).id, "current");
  assert.equal(resolveCurrent(rotations, "B").id, "current", "B cannot be current");
  assert.equal(resolveCurrent(rotations, "D").id, "D");
  // files without can_be_current (data/mock): only the default is offered
  const mock = read("data/mock/rotations.json");
  assert.deepEqual(currentOptions(mock).map((r) => r.id), ["current"]);
});

// store.js reads localStorage when imported: import a fresh copy per case.
let n = 0;
async function freshStore(storage) {
  globalThis.localStorage = storage;
  const mod = await import(`../js/store.js?case=${n++}`);
  delete globalThis.localStorage;
  return mod.store;
}
const fakeStorage = (value) => ({ getItem: () => value, setItem() {}, removeItem() {} });

test("store: broken JSON, unknown id, blocked storage -> default rotation, no error", async () => {
  for (const storage of [
    fakeStorage("{not json"),
    fakeStorage(JSON.stringify({ weights: { water: 1 }, current_rotation: "zzz", custom_rotations: "nope" })),
    fakeStorage(JSON.stringify({ weights: {}, current_rotation: 42 })),
    fakeStorage(null),
    { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } },
    undefined,
  ]) {
    const store = await freshStore(storage);
    const st = store.get();
    assert.ok(Array.isArray(st.custom_rotations));
    assert.equal(resolveCurrent(rotations, st.current_rotation).id, "current");
    store.set({ current_rotation: "D" }); // must not throw even if storage is blocked
  }
});

test("store: a valid stored choice is kept", async () => {
  const store = await freshStore(fakeStorage(JSON.stringify({ weights: DEFAULT_WEIGHTS, current_rotation: "E" })));
  assert.equal(resolveCurrent(rotations, store.get().current_rotation).id, "E");
});
