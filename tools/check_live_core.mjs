#!/usr/bin/env node
// Checks that the browser code path (pipeline/lib/power_files.mjs + rotations_core.mjs, used when the
// user picks a field on the map) gives exactly the files in /data for the pilot field.
// Usage: node tools/check_live_core.mjs
import { readFileSync } from "node:fs";
import { buildPowerFiles } from "../pipeline/lib/power_files.mjs";
import * as r from "../pipeline/lib/rotations_core.mjs";

const root = new URL("../", import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const CFG = read("pipeline/config.json");
const TH = read("pipeline/thresholds.json");
const RULES = read("pipeline/agro_rules.json");
const INCOME = read("pipeline/income_ecrea.json");
const texts = read("data/mock/rotations.json");
const raw = read("pipeline/raw/power_daily.json");
const period = `${CFG.first_year}-${CFG.last_full_year}`;

const files = buildPowerFiles({ raw, cfg: CFG, TH, today: "X", eventName: "pilot parcel (Vega de Antequera)" });
const { rotations, bare } = r.buildRotations({ texts, monthly: files.climate.monthly, weeks: files.risk_windows.weeks, RULES, TH, INCOME, period, today: "X" });
files.risk_windows = { ...files.risk_windows, ...r.bareMonthsKeys(bare) };
const scenarios = r.buildScenarios({ days: files.days, lat: CFG.lat, elev: files.meta.elevation_m, y0: CFG.first_year, y1: CFG.last_full_year, TH, RULES, texts, period });

// generated_at is the run date; key order does not matter.
const norm = (v) => {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).filter((k) => k !== "generated_at").sort().map((k) => [k, norm(v[k])]));
  return v;
};
let bad = 0;
for (const [name, mine] of Object.entries({ parcel: files.parcel, climate: files.climate, risk_windows: files.risk_windows, validation: files.validation, rotations, scenarios })) {
  const same = JSON.stringify(norm(mine)) === JSON.stringify(norm(read(`data/${name}.json`)));
  if (!same) bad++;
  console.log(`${same ? "✓" : "✗"} ${name}.json ${same ? "identical" : "DIFFERS"}`);
}
process.exit(bad ? 1 : 0);
