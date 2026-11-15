// Rotations built by the user ("Build your own…"): same formulas as the pipeline. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as core from "../pipeline/lib/rotations_core.mjs";
import { withCustom, buildOne, canBuild, cropOptions, removeCustomPatch, nextCustomId } from "../js/custom.js";
import { compareSet, resolveCurrent, scenarioTotals } from "../js/choice.js";
import { validateScenariosCover } from "../js/contract.js";
import { cleanCustom } from "../js/store.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const rules = { RULES: read("pipeline/agro_rules.json"), INCOME: read("pipeline/income_ecrea.json"), TH: read("pipeline/thresholds.json") };
const data = Object.fromEntries(["parcel", "climate", "risk_windows", "rotations", "scenarios"].map((f) => [f, read(`data/${f}.json`)]));
const W = { water: 70, soil: 70, income: 50, erosion: 60 };

test("the pilot data can score user rotations; Fallow is a pickable crop", () => {
  assert.ok(canBuild(data, rules));
  assert.ok(cropOptions(rules).includes("Fallow"));
  assert.ok(cropOptions(rules).every((c) => rules.RULES.crops[c]));
});

test("every scenario keeps the inputs that reproduce its scores", () => {
  for (const s of data.scenarios) {
    const clim = core.scenarioClimate(s);
    assert.ok(clim, `${s.rain_pct},${s.temp_delta}`);
    for (const r of data.rotations) assert.deepEqual(core.scoreRotation(r.sequence, clim.monthly, clim.weeks, rules.RULES, rules.INCOME).scores, s.criteria[r.id]);
  }
});

test("a user rotation equal to an existing one gets exactly the same scores (today and every scenario)", () => {
  for (const r of data.rotations) {
    const customs = [{ id: "custom-1", sequence: r.sequence }];
    const merged = withCustom(data, rules, customs);
    const mine = merged.rotations.find((x) => x.id === "custom-1");
    assert.deepEqual(mine.scores, r.scores, r.id);
    assert.deepEqual(mine.income.eur_ha_year, r.income.eur_ha_year, r.id);
    for (const s of merged.scenarios) {
      assert.deepEqual(s.criteria["custom-1"], s.criteria[r.id]);
      assert.equal(s.scores["custom-1"], s.scores[r.id]);
    }
  }
});

test("2 and 4 crops work; fallow does not break water or income", () => {
  const merged = withCustom(data, rules, [
    { id: "custom-1", sequence: ["Barley", "Chickpea"] },
    { id: "custom-2", sequence: ["Durum wheat", "Chickpea", "Barley", "Sunflower"] },
    { id: "custom-3", sequence: ["Barley", "Fallow"] },
  ]);
  assert.equal(merged.rotations.length, data.rotations.length + 3);
  assert.deepEqual(validateScenariosCover(merged.scenarios, merged.rotations), []);
  const byId = Object.fromEntries(merged.rotations.map((r) => [r.id, r]));
  assert.equal(byId["custom-1"].name, "Your rotation: Barley – Chickpea");
  for (const id of ["custom-1", "custom-2", "custom-3"]) {
    const r = byId[id];
    for (const k of ["water", "soil", "erosion", "risk_resilience"]) assert.equal(typeof r.scores[k], "number", `${id}.${k}`);
    assert.equal(r.confidence, "low");
    assert.equal(r.why, "Built by you from crops in our rule table.");
    assert.equal(r.provenance, "derived");
    assert.ok(r.evidence.length >= 2);
  }
  const fallow = byId["custom-3"];
  // fallow is a year with no sales: counted as 0 EUR/ha (listed as missing, value TBD)
  assert.equal(typeof fallow.scores.income, "number");
  assert.equal(typeof fallow.income.eur_ha_year, "number");
  assert.deepEqual(fallow.income.missing, ["Fallow"]);
  assert.deepEqual(fallow.water_balance.map((w) => w.crop), ["Barley"]);
  // the chosen rotation can be one built by the user; totals match the what-if baseline
  const set = compareSet(merged.rotations, W, "custom-3");
  assert.equal(set.current.id, "custom-3");
  assert.equal(set.alternatives.length, 3);
  assert.ok(set.alternatives.every((a) => a.rotation.id !== "custom-3"));
  const zero = merged.scenarios.find((s) => s.rain_pct === 0 && s.temp_delta === 0);
  scenarioTotals(zero, set.shown.map((x) => x.rotation.id), W, merged.rotations).forEach((x, i) => assert.equal(x.total, set.shown[i].total));
});

test("calendars that do not give one crop per year, unknown crops and all-fallow are refused with a message", () => {
  assert.throws(() => buildOne(data, rules, { id: "custom-1", sequence: ["Sunflower", "Winter cover crop"] }), /one crop per year/);
  assert.throws(() => buildOne(data, rules, { id: "custom-1", sequence: ["Fallow", "Fallow"] }), /not fallow/);
  assert.throws(() => buildOne(data, rules, { id: "custom-1", sequence: ["Quinoa", "Barley"] }), /No rules for Quinoa/);
  // and they are left out of the merged data instead of breaking it
  assert.equal(withCustom(data, rules, [{ id: "custom-1", sequence: ["Sunflower", "Winter cover crop"] }]).rotations.length, data.rotations.length);
});

test("same crop family two years in a row is flagged", () => {
  assert.equal(core.sameFamilyInARow(["Durum wheat", "Barley"], rules.RULES), true);
  assert.equal(core.sameFamilyInARow(["Durum wheat", "Chickpea", "Barley"], rules.RULES), true); // Barley -> Durum wheat when it repeats
  assert.equal(core.sameFamilyInARow(["Durum wheat", "Chickpea"], rules.RULES), false);
  assert.equal(core.sameFamilyInARow(["Durum wheat", "Fallow"], rules.RULES), false);
});

test("deleting the user rotation that was current goes back to the default", () => {
  const state = { current_rotation: "custom-2", custom_rotations: [{ id: "custom-1", sequence: ["Barley", "Chickpea"] }, { id: "custom-2", sequence: ["Barley", "Fallow"] }] };
  const patch = removeCustomPatch(state, "custom-2");
  assert.equal(patch.current_rotation, "current");
  assert.deepEqual(patch.custom_rotations.map((c) => c.id), ["custom-1"]);
  const merged = withCustom(data, rules, patch.custom_rotations);
  assert.equal(resolveCurrent(merged.rotations, patch.current_rotation).id, "current");
  // a stale stored id (rotation deleted elsewhere) also falls back
  assert.equal(resolveCurrent(merged.rotations, "custom-2").id, "current");
  assert.equal(removeCustomPatch(state, "custom-1").current_rotation, "custom-2");
});

test("at most 3 user rotations; ids custom-1..3; broken stored lists are cleaned", () => {
  assert.equal(nextCustomId([], 3), "custom-1");
  assert.equal(nextCustomId([{ id: "custom-1" }, { id: "custom-3" }], 3), "custom-2");
  assert.equal(nextCustomId([{ id: "custom-1" }, { id: "custom-2" }, { id: "custom-3" }], 3), null);
  const cleaned = cleanCustom([
    { id: "custom-1", sequence: ["Barley", "Chickpea"] },
    { id: "custom-1", sequence: ["Barley", "Chickpea"] },
    { id: "x", sequence: ["Barley", "Chickpea"] },
    { id: "custom-2", sequence: ["Barley"] },
    { id: "custom-3", sequence: ["A", "B", "C", "D", "E"] },
    null,
    { id: "custom-4", sequence: ["Barley", "Fallow"] },
    { id: "custom-5", sequence: ["Barley", "Lentil"] },
    { id: "custom-6", sequence: ["Barley", "Sunflower"] },
  ]);
  assert.deepEqual(cleaned.map((c) => c.id), ["custom-1", "custom-4", "custom-5"]);
  assert.deepEqual(cleanCustom("nope"), []);
});
