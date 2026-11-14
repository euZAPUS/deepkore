#!/usr/bin/env node
// Runs the browser computation (power_files + rotations_core) for several real points across Andalucía,
// downloading NASA POWER, and checks every output against the data contract. Needs internet.
// Usage: node tools/check_live_points.mjs
import { readFileSync } from "node:fs";
import { downloadPower, buildPowerFiles } from "../pipeline/lib/power_files.mjs";
import * as r from "../pipeline/lib/rotations_core.mjs";
import { VALIDATORS } from "../js/contract.js";
import { provinceAt } from "../js/andalucia.js";

const root = new URL("../", import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const CFG = read("pipeline/config.json");
const TH = read("pipeline/thresholds.json");
const RULES = read("pipeline/agro_rules.json");
const INCOME = read("pipeline/income_ecrea.json");
const texts = read("data/mock/rotations.json");
const period = `${CFG.first_year}-${CFG.last_full_year}`;
const today = new Date().toISOString().slice(0, 10);

const POINTS = [
  ["Campiña de Córdoba", 37.75, -4.75],
  ["Campiña de Sevilla (Écija)", 37.54, -5.08],
  ["Jerez (Cádiz)", 36.69, -6.13],
  ["Huelva, Condado", 37.3, -6.5],
  ["Tabernas (Almería, very dry)", 37.05, -2.39],
  ["Baza (Granada, high plateau)", 37.49, -2.77],
  ["Úbeda (Jaén)", 38.01, -3.37],
  ["Sierra de Cazorla (Jaén, mountain)", 37.91, -2.93],
];

let bad = 0;
for (const [label, lat, lon] of POINTS) {
  const t0 = Date.now();
  try {
    const province = provinceAt(lat, lon);
    if (!province) throw new Error("outside the Andalucía outline");
    const raw = await downloadPower(lat, lon, CFG.first_year, today);
    const files = buildPowerFiles({ raw, cfg: { ...CFG, name: `Selected field (${province})`, lat, lon }, TH, today, eventName: "selected field" });
    const { rotations, bare } = r.buildRotations({ texts, monthly: files.climate.monthly, weeks: files.risk_windows.weeks, RULES, TH, INCOME, period, today });
    files.risk_windows = { ...files.risk_windows, ...r.bareMonthsKeys(bare) };
    const scenarios = r.buildScenarios({ days: files.days, lat, elev: files.meta.elevation_m, y0: CFG.first_year, y1: CFG.last_full_year, TH, RULES, INCOME, texts, period });
    r.checkZeroScenario(scenarios, rotations);
    const out = { parcel: files.parcel, climate: files.climate, risk_windows: files.risk_windows, validation: files.validation, rotations, scenarios };
    const problems = Object.entries(out).flatMap(([k, v]) => VALIDATORS[k](v).map((p) => `${k}: ${p}`));
    const allScored = rotations.every((x) => Object.values(x.scores).every((v) => typeof v === "number" && v >= 0 && v <= 100));
    if (problems.length || !allScored) throw new Error(problems.slice(0, 3).join("; ") || "a score is missing or outside 0-100");
    const sc = rotations.map((x) => `${x.id}[w${x.scores.water} s${x.scores.soil} i${x.scores.income} e${x.scores.erosion} r${x.scores.risk_resilience}]`).join(" ");
    console.log(`✓ ${label} (${province}) ${Math.round((Date.now() - t0) / 1000)}s  rain ${Math.round(files.climate.monthly.precip_mm.reduce((a, b) => a + b, 0))} mm/yr  ${sc}`);
  } catch (err) {
    bad++;
    console.log(`✗ ${label}: ${err.message}`);
  }
}
process.exit(bad ? 1 : 0);
