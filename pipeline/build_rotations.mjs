// DeepKore: score the rotations and the what-if scenarios from the NASA POWER files.
// Usage:  node pipeline/build_rotations.mjs   (run after pipeline/build_power_data.mjs)
// Reads:  data/climate.json, data/risk_windows.json, pipeline/raw/power_daily.json,
//         pipeline/agro_rules.json, pipeline/thresholds.json, pipeline/config.json,
//         pipeline/income_ecrea.json,
//         data/mock/rotations.json (texts only: id, name, sequence, why, benefits, gaps, risks),
//         pipeline/rotation_catalog.json (extra rotations and can_be_current)
// Writes: data/rotations.json, data/scenarios.json, and merges bare_months into data/risk_windows.json
// The formulas live in pipeline/lib/rotations_core.mjs (shared with the browser).
import { readFile, writeFile, rename } from "node:fs/promises";
import * as c from "./lib/power_core.mjs";
import * as r from "./lib/rotations_core.mjs";

const ROOT = new URL("../", import.meta.url);
const readJson = async (rel) => JSON.parse(await readFile(new URL(rel, ROOT), "utf8"));
async function writeJson(rel, obj) {
  const tmp = new URL(rel + ".tmp", ROOT);
  await writeFile(tmp, JSON.stringify(obj, null, 2) + "\n");
  await rename(tmp, new URL(rel, ROOT));
  console.log("wrote", rel);
}

const CFG = await readJson("pipeline/config.json");
const TH = await readJson("pipeline/thresholds.json");
const RULES = await readJson("pipeline/agro_rules.json");
const INCOME = await readJson("pipeline/income_ecrea.json");
const climate = await readJson("data/climate.json");
const riskWindows = await readJson("data/risk_windows.json");
const texts = r.rotationTexts(await readJson("data/mock/rotations.json"), await readJson("pipeline/rotation_catalog.json"));
const today = new Date().toISOString().slice(0, 10);
const period = `${CFG.first_year}-${CFG.last_full_year}`;

const { rotations, bare } = r.buildRotations({ texts, monthly: climate.monthly, weeks: riskWindows.weeks, RULES, TH, INCOME, period, today });
await writeJson("data/rotations.json", rotations);
await writeJson("data/risk_windows.json", { ...(await readJson("data/risk_windows.json")), ...r.bareMonthsKeys(bare) });

const raw = await readJson("pipeline/raw/power_daily.json");
const { days, meta } = c.toDays(raw.responses);
const scenarios = r.buildScenarios({ days, lat: CFG.lat, elev: meta.elevation_m, y0: CFG.first_year, y1: CFG.last_full_year, TH, RULES, INCOME, texts, period });
const zero = r.checkZeroScenario(scenarios, rotations);
console.log("check: scenario (0,0) reproduces rotations.json exactly");
await writeJson("data/scenarios.json", scenarios);

console.log("\nSCORES (water, soil, erosion, risk_resilience -> total) | income EUR/ha/yr:");
for (const x of rotations) console.log(` ${x.id.padEnd(8)} ${r.RANK_KEYS.map((k) => x.scores[k]).join(", ")} -> ${zero.scores[x.id]}  [${x.confidence}] | ${x.income.eur_ha_year ?? `missing: ${x.income.missing.join(", ")}`}`);
for (const x of rotations) x.evidence.forEach((e) => console.log(` ${x.id}: ${e.fact}`));
