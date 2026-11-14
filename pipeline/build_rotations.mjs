// DeepKore: score the rotations and the what-if scenarios from the NASA POWER files.
// Usage:  node pipeline/build_rotations.mjs   (run after pipeline/build_power_data.mjs)
// Reads:  data/climate.json, data/risk_windows.json, pipeline/raw/power_daily.json,
//         pipeline/agro_rules.json, pipeline/thresholds.json, pipeline/config.json,
//         data/mock/rotations.json (texts only: id, name, sequence, why, benefits, gaps, risks)
// Writes: data/rotations.json, data/scenarios.json, and merges bare_months into data/risk_windows.json
import { readFile, writeFile, rename } from "node:fs/promises";
import * as c from "./lib/power_core.mjs";

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
const climate = await readJson("data/climate.json");
const riskWindows = await readJson("data/risk_windows.json");
const mockRotations = await readJson("data/mock/rotations.json");
const today = new Date().toISOString().slice(0, 10);
const PERIOD = `${CFG.first_year}-${CFG.last_full_year}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HAZARD_KEY = { frost: "p_frost", heat: "p_heat" };
const isTBD = (v) => typeof v?.source === "string" && v.source.trim().toUpperCase().startsWith("TBD");

/* ---------- helpers ---------- */

// Week -> month, same rule as js/views/risks.js (non-leap reference year, day 4 of the week).
const weekMonth = (w) => new Date(Date.UTC(2025, 0, 1 + (w - 1) * 7 + 3)).getUTCMonth() + 1;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const monthsFromTo = (a, b) => {
  const out = [];
  for (let m = a; ; m = (m % 12) + 1) {
    out.push(m);
    if (m === b) return out;
  }
};
const monthSpan = (ms) => (ms.length === 1 ? MONTHS[ms[0] - 1] : `${MONTHS[ms[0] - 1]}-${MONTHS[ms.at(-1) - 1]}`);

function crop(name) {
  const r = RULES.crops[name];
  if (!r) throw new Error(`agro_rules.json: no rules for crop "${name}"`);
  const sow = r.sow_months.value[0];
  const harvest = r.harvest_months.value.at(-1);
  const tbd = Object.entries(r).filter(([, v]) => isTBD(v)).map(([k]) => k);
  return { name, rules: r, sow, harvest, cycle: monthsFromTo(sow, harvest), tbd };
}

// Kc for each growing month: 4 equal stages (initial, development, mid, late), see agro_rules.kc_stages.
function monthlyKc(kc, n) {
  return Array.from({ length: n }, (_, i) => {
    const x = (i + 0.5) / n;
    if (x < 0.25) return kc.ini;
    if (x < 0.5) return kc.ini + (kc.mid - kc.ini) * ((x - 0.25) / 0.25);
    if (x < 0.75) return kc.mid;
    return kc.mid + (kc.end - kc.mid) * ((x - 0.75) / 0.25);
  });
}

// Place the crops one after another on a month timeline. Each crop is sown at the first
// occurrence of its sowing month after the previous harvest. Returns the cycle length in
// years and, for each calendar month, the share of cycle years in which the field is bare.
function timeline(crops) {
  let t = crops[0].sow - 1;
  const start = t;
  const covered = new Set();
  let prevEnd = -1;
  for (const cr of crops) {
    while ((t % 12) + 1 !== cr.sow || t <= prevEnd) t++;
    for (let k = 0; k < cr.cycle.length; k++) covered.add(t + k);
    prevEnd = t + cr.cycle.length - 1;
  }
  let end = prevEnd + 1;
  while ((end % 12) + 1 !== crops[0].sow) end++;
  const years = (end - start) / 12;
  const bareShare = Array(12).fill(0);
  for (let k = start; k < end; k++) if (!covered.has(k)) bareShare[k % 12] += 1 / years;
  return { years, bareShare };
}

/* ---------- scores (0-100, higher is better, absolute formulas) ---------- */

function scoreRotation(seq, monthly, weeks) {
  const crops = seq.map(crop);
  const years = seq.length;
  const tl = timeline(crops);
  if (tl.years !== years) throw new Error(`${seq.join(" > ")}: crop calendar gives a ${tl.years}-year cycle, sequence has ${years} crops`);

  // water: rain of growing months / (Kc x ET0 of those months), capped at 1, mean of the crops with a Kc
  const water = crops.map((cr) => {
    const kc = cr.rules.kc.value;
    if (!kc) return { crop: cr.name, ratio: null };
    const k = monthlyKc(kc, cr.cycle.length);
    const rain = cr.cycle.reduce((s, m) => s + monthly.precip_mm[m - 1], 0);
    const need = cr.cycle.reduce((s, m, i) => s + k[i] * monthly.et0[m - 1], 0);
    return { crop: cr.name, ratio: Math.min(1, rain / need), rain, need };
  });
  const waterVals = water.filter((w) => w.ratio !== null).map((w) => w.ratio);

  // risk resilience: 1 - mean weekly chance of the crop's hazard during its sensitive weeks
  const risk = crops.map((cr) => {
    const s = cr.rules.sensitive.value;
    const key = HAZARD_KEY[s.hazard];
    if (!key) throw new Error(`${cr.name}: hazard "${s.hazard}" has no weekly probability in risk_windows.weeks`);
    const p = mean(weeks.filter((w) => s.months.includes(weekMonth(w.week))).map((w) => w[key]));
    return { crop: cr.name, hazard: s.hazard, months: s.months, p };
  });

  // erosion: 1 - (bare months weighted by heavy-rain frequency of that month / sum of that frequency)
  const rainFreq = MONTHS.map((_, i) => mean(weeks.filter((w) => weekMonth(w.week) === i + 1).map((w) => w.p_extreme_rain)));
  const totalFreq = rainFreq.reduce((s, v) => s + v, 0);
  const bareRain = tl.bareShare.reduce((s, b, i) => s + b * rainFreq[i], 0);
  const erosion = totalFreq > 0 ? 1 - bareRain / totalFreq : 1;

  // soil: mean of (years with a legume / years) and (distinct families / years); unknown values count as no
  const legumeYears = crops.filter((cr) => cr.rules.legume.value === true).length;
  const families = new Set(crops.map((cr) => cr.rules.family.value).filter(Boolean)).size;
  const soil = (legumeYears / years + families / years) / 2;

  const pct = (v) => Math.round(v * 100);
  return {
    scores: {
      water: pct(mean(waterVals)),
      soil: pct(soil),
      income: null,
      erosion: pct(erosion),
      risk_resilience: pct(1 - mean(risk.map((r) => r.p))),
    },
    detail: { crops, water, risk, bareShare: tl.bareShare, bareRainShare: totalFreq > 0 ? bareRain / totalFreq : 0, legumeYears, families, years },
  };
}

// Equal weights, income left out (no verified prices or yields).
const RANK_KEYS = ["water", "soil", "erosion", "risk_resilience"];
const total = (s) => Math.round(mean(RANK_KEYS.map((k) => s[k])) * 10) / 10;

/* ---------- rotations.json ---------- */

const usedTBD = (d) => d.crops.some((cr) => cr.tbd.length) || isTBD(RULES.kc_stages);

function evidence(d) {
  const ev = [];
  const w = d.water.filter((x) => x.ratio !== null);
  const noKc = d.water.filter((x) => x.ratio === null).map((x) => x.crop);
  ev.push(`NASA POWER ${PERIOD}: rain in the growing months covers ${w.map((x) => `${Math.round(x.ratio * 100)}% (${x.crop})`).join(", ")} of the crop water need (Kc x ET0).${noKc.length ? ` Not scored for water: ${noKc.join(", ")} (no FAO-56 Kc).` : ""}`);
  ev.push(`NASA POWER ${PERIOD}: average weekly chance of the main hazard in the sensitive weeks: ${d.risk.map((r) => `${r.crop} ${r.hazard} ${Math.round(r.p * 100)}% (${monthSpan(r.months)})`).join(", ")}.`);
  const bare = d.bareShare.map((b, i) => (b > 0 ? MONTHS[i] : null)).filter(Boolean);
  ev.push(`NASA POWER ${PERIOD}: ${Math.round(d.bareRainShare * 100)}% of the year's heavy-rain frequency (days of ${TH.extreme_rain.value} mm or more) falls while this rotation leaves the soil bare${bare.length ? ` (bare in some or all years: ${bare.join(", ")})` : ""}.`);
  return ev.map((fact) => ({ dataset: "NASA POWER", fact, provenance: "derived" }));
}

const STRIP = (s) => String(s).replace(/\[MOCK\]\s*/g, "");

// Mock texts the data do not support. Each edit says why.
const TEXT_EDITS = {
  current: {
    // income is not scored (no verified prices or yields)
    dropBenefits: ["Good income in average years"],
  },
  B: {
    // income is not scored (no verified prices or yields)
    dropRisks: ["Lower income in the vetch year"],
  },
  C: {
    // with the cover crop after chickpea (sequence order), the soil is bare in autumn in some years
    // and the erosion score is not better than the current rotation's
    why: "Keeps the familiar crops but adds a legume and a winter cover crop.",
    dropBenefits: ["Strong protection against erosion"],
  },
};
const edit = (id) => TEXT_EDITS[id] || {};

const results = mockRotations.map((m) => ({ m, ...scoreRotation(m.sequence, climate.monthly, riskWindows.weeks) }));

const rotations = results.map(({ m, scores, detail }) => ({
  id: m.id,
  name: STRIP(m.name),
  sequence: m.sequence.map(STRIP),
  scores,
  confidence: usedTBD(detail) ? "low" : "medium",
  why: edit(m.id).why ?? STRIP(m.why),
  evidence: evidence(detail),
  benefits: m.benefits.map(STRIP).filter((t) => !(edit(m.id).dropBenefits || []).includes(t)),
  gaps: m.gaps.map(STRIP),
  risks: m.risks.map(STRIP).filter((t) => !(edit(m.id).dropRisks || []).includes(t)),
  pac_eligible: "TBD",
  provenance: "derived",
  dataset: "NASA POWER",
  method: "pipeline/build_rotations.mjs with pipeline/agro_rules.json; see pipeline/README.md",
  generated_at: today,
}));
await writeJson("data/rotations.json", rotations);

/* ---------- bare_months in risk_windows.json (merge) ---------- */

const cur = results.find((r) => r.m.id === "current").detail;
await writeJson("data/risk_windows.json", {
  ...(await readJson("data/risk_windows.json")),
  bare_months: cur.bareShare.map((b, i) => (b > 0 ? i + 1 : null)).filter(Boolean),
  bare_months_share: cur.bareShare.map((b) => Math.round(b * 100) / 100),
  bare_months_source: "crop calendar (TBD), not satellite-observed",
});

/* ---------- scenarios.json ---------- */

const raw = await readJson("pipeline/raw/power_daily.json");
const { days: baseDays, meta } = c.toDays(raw.responses);
const th = { frost_tmin_c: TH.frost.value, heat_tmax_c: TH.heat.value, extreme_rain_mm_day: TH.extreme_rain.value };
const y0 = CFG.first_year;
const y1 = CFG.last_full_year;
const add = (v, d) => (v === null ? null : v + d);

function scenario(rainPct, dT) {
  const f = 1 + rainPct / 100;
  const days = baseDays.map((r) => ({
    ...r,
    PRECTOTCORR: r.PRECTOTCORR === null ? null : r.PRECTOTCORR * f,
    T2M_MAX: add(r.T2M_MAX, dT),
    T2M_MIN: add(r.T2M_MIN, dT),
    T2M: add(r.T2M, dT),
  }));
  c.addEt0(days, CFG.lat, meta.elevation_m);
  const clim = c.buildClimate(days, y0, y1, th);
  const weeks = c.buildWeeks(days, y0, y1, th);
  const scored = Object.fromEntries(mockRotations.map((m) => [m.id, scoreRotation(m.sequence, clim.monthly, weeks).scores]));
  const totals = Object.fromEntries(Object.entries(scored).map(([id, s]) => [id, total(s)]));
  return {
    rain_pct: rainPct,
    temp_delta: dT,
    frost_days: Math.round(mean(clim.trends.frost_days)),
    heat_days: Math.round(mean(clim.trends.heat_days)),
    ranking: Object.keys(totals).sort((a, b) => totals[b] - totals[a]),
    scores: totals,
    criteria: scored,
    provenance: "simulated",
    dataset: "NASA POWER",
    method: `Daily NASA POWER ${PERIOD}: rain x (1 + rain_pct/100), Tmax and Tmin + temp_delta; ET0, weekly chances and scores recomputed. Ranking = equal weights of ${RANK_KEYS.join(", ")} (income not scored).`,
  };
}

const scenarios = [];
for (let rp = -40; rp <= 20; rp += 10) for (let dT = 0; dT <= 3; dT++) scenarios.push(scenario(rp, dT));

// The (0, 0) scenario must reproduce rotations.json exactly.
const zero = scenarios.find((s) => s.rain_pct === 0 && s.temp_delta === 0);
for (const r of rotations) {
  for (const k of Object.keys(r.scores)) {
    if (zero.criteria[r.id][k] !== r.scores[k]) throw new Error(`Scenario (0,0) does not match rotations.json: ${r.id}.${k} ${zero.criteria[r.id][k]} vs ${r.scores[k]}`);
  }
}
console.log("check: scenario (0,0) reproduces rotations.json exactly");
await writeJson("data/scenarios.json", scenarios);

console.log("\nSCORES (water, soil, erosion, risk_resilience -> total):");
for (const r of rotations) console.log(` ${r.id.padEnd(8)} ${RANK_KEYS.map((k) => r.scores[k]).join(", ")} -> ${zero.scores[r.id]}  [${r.confidence}]`);
for (const r of rotations) r.evidence.forEach((e) => console.log(` ${r.id}: ${e.fact}`));
