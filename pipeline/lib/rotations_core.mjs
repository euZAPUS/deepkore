// DeepKore: rotation scores, income and what-if scenarios. Pure functions (no Node-only imports),
// shared by pipeline/build_rotations.mjs and the browser worker (js/live/worker.js).
// Inputs are the parsed JSON files: agro_rules.json, thresholds.json, income_ecrea.json,
// the rotation texts (data/mock/rotations.json) and the climate / weekly risk data.
import * as c from "./power_core.mjs";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HAZARD_KEY = { frost: "p_frost", heat: "p_heat" };
// Equal weights, income left out (see pipeline/README.md).
export const RANK_KEYS = ["water", "soil", "erosion", "risk_resilience"];

export const isTBD = (v) => typeof v?.source === "string" && v.source.trim().toUpperCase().startsWith("TBD");
// Week -> month, same rule as js/views/risks.js (non-leap reference year, day 4 of the week).
export const weekMonth = (w) => new Date(Date.UTC(2025, 0, 1 + (w - 1) * 7 + 3)).getUTCMonth() + 1;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const round = (v, n = 1) => (v === null ? null : Math.round(v * 10 ** n) / 10 ** n);
const monthsFromTo = (a, b) => {
  const out = [];
  for (let m = a; ; m = (m % 12) + 1) {
    out.push(m);
    if (m === b) return out;
  }
};
export const monthSpan = (ms) => (ms.length === 1 ? MONTHS[ms[0] - 1] : `${MONTHS[ms[0] - 1]}-${MONTHS[ms.at(-1) - 1]}`);

function crop(name, RULES) {
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

export function scoreRotation(seq, monthly, weeks, RULES, INCOME) {
  const crops = seq.map((n) => crop(n, RULES));
  const years = seq.length;
  const tl = timeline(crops);
  if (tl.years !== years) throw new Error(`${seq.join(" > ")}: crop calendar gives a ${tl.years}-year cycle, sequence has ${years} crops`);

  // water: rain of growing months / (Kc x ET0 of those months), capped at 1, mean of the crops with a Kc
  const water = crops.map((cr) => {
    const kc = cr.rules.kc.value;
    const rain = cr.cycle.reduce((s, m) => s + monthly.precip_mm[m - 1], 0);
    if (!kc) return { crop: cr.name, months: cr.cycle, ratio: null, rain, need: null };
    const k = monthlyKc(kc, cr.cycle.length);
    const need = cr.cycle.reduce((s, m, i) => s + k[i] * monthly.et0[m - 1], 0);
    return { crop: cr.name, months: cr.cycle, ratio: Math.min(1, rain / need), rain, need };
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
      income: incomeScore(rotationIncome(seq, INCOME), INCOME),
      erosion: pct(erosion),
      risk_resilience: pct(1 - mean(risk.map((r) => r.p))),
    },
    detail: { crops, water, risk, bareShare: tl.bareShare, bareRainShare: totalFreq > 0 ? bareRain / totalFreq : 0, legumeYears, families, years },
  };
}

export const totalScore = (s) => Math.round(mean(RANK_KEYS.map((k) => s[k])) * 10) / 10;

/* ---------- income (ECREA net margin, informative; not in the ranking) ---------- */

// Mean net margin per hectare and year over the crops of the sequence. A crop without a verified value
// counts as INCOME.missing_value.eur_ha (TBD) and is listed in `missing`.
// eur_ha_year is null only if income_ecrea.json has no missing_value rule.
export function rotationIncome(seq, INCOME) {
  const fill = INCOME?.missing_value?.eur_ha;
  const byCrop = seq.map((name) => {
    const vals = INCOME?.crops?.[name]?.values || [];
    const known = vals.length ? round(mean(vals.map((v) => v.eur_ha)), 1) : null;
    return {
      crop: name,
      eur_ha: known ?? (typeof fill === "number" ? fill : null),
      assumed: known === null,
      years: vals.map((v) => v.year),
      ecrea_crop: vals[0]?.ecrea_crop ?? null,
      note: INCOME?.crops?.[name]?.note ?? null,
    };
  });
  const missing = byCrop.filter((b) => b.assumed).map((b) => b.crop);
  const docs = [...new Set(seq.flatMap((name) => (INCOME?.crops?.[name]?.values || []).map((v) => v.doc)))];
  return {
    eur_ha_year: byCrop.some((b) => b.eur_ha === null) ? null : round(mean(byCrop.map((b) => b.eur_ha)), 1),
    missing_rule: missing.length ? INCOME?.missing_value?.source ?? null : null,
    metric: "ECREA net margin (margen neto), euro per hectare and year, mean of the crops in the sequence",
    region: INCOME?.region ?? null,
    by_crop: byCrop,
    missing,
    source: "MAPA ECREA 2.0 (RECAN), see pipeline/income_ecrea.json",
    documents: docs.map((d) => ({ id: d, url: INCOME.documents[d] })),
    accessed: INCOME?.accessed ?? null,
  };
}

// 0-100: linear between score_scale.zero_eur_ha (0) and score_scale.full_eur_ha (100), clamped. null without a scale.
export function incomeScore(income, INCOME) {
  const sc = INCOME?.score_scale;
  if (!sc || income?.eur_ha_year === null || income?.eur_ha_year === undefined) return null;
  const k = (income.eur_ha_year - sc.zero_eur_ha) / (sc.full_eur_ha - sc.zero_eur_ha);
  return Math.round(Math.max(0, Math.min(1, k)) * 100);
}

/* ---------- rotations ---------- */

// Mock texts the data do not support. Each edit says why.
export const TEXT_EDITS = {
  current: {
    // income is not scored (no verified prices or yields at the time); the ECREA net margin is shown separately
    dropBenefits: ["Good income in average years"],
  },
  B: {
    // income is not scored; vetch as forage / green manure has no verified net margin
    dropRisks: ["Lower income in the vetch year"],
  },
  C: {
    // with the cover crop after chickpea (sequence order), the soil is bare in autumn in some years
    // and the erosion score is not better than the current rotation's
    why: "Keeps the familiar crops but adds a legume and a winter cover crop.",
    dropBenefits: ["Strong protection against erosion"],
  },
};
const STRIP = (s) => String(s).replace(/\[MOCK\]\s*/g, "");

function evidence(d, period, TH) {
  const ev = [];
  const w = d.water.filter((x) => x.ratio !== null);
  const noKc = d.water.filter((x) => x.ratio === null).map((x) => x.crop);
  ev.push(`NASA POWER ${period}: rain in the growing months covers ${w.map((x) => `${Math.round(x.ratio * 100)}% (${x.crop})`).join(", ")} of the crop water need (Kc x ET0).${noKc.length ? ` Not scored for water: ${noKc.join(", ")} (no FAO-56 Kc).` : ""}`);
  ev.push(`NASA POWER ${period}: average weekly chance of the main hazard in the sensitive weeks: ${d.risk.map((r) => `${r.crop} ${r.hazard} ${Math.round(r.p * 100)}% (${monthSpan(r.months)})`).join(", ")}.`);
  const bare = d.bareShare.map((b, i) => (b > 0 ? MONTHS[i] : null)).filter(Boolean);
  ev.push(`NASA POWER ${period}: ${Math.round(d.bareRainShare * 100)}% of the year's heavy-rain frequency (days of ${TH.extreme_rain.value} mm or more) falls while this rotation leaves the soil bare${bare.length ? ` (bare in some or all years: ${bare.join(", ")})` : ""}.`);
  return ev.map((fact) => ({ dataset: "NASA POWER", fact, provenance: "derived" }));
}

// texts: data/mock/rotations.json. Returns { rotations, bare } (bare: current rotation's bare-month shares).
export function buildRotations({ texts, monthly, weeks, RULES, TH, INCOME, period, today }) {
  const usedTBD = (d) => d.crops.some((cr) => cr.tbd.length) || isTBD(RULES.kc_stages) || isTBD(INCOME?.score_scale);
  const edit = (id) => TEXT_EDITS[id] || {};
  const results = texts.map((m) => ({ m, ...scoreRotation(m.sequence, monthly, weeks, RULES, INCOME) }));
  const rotations = results.map(({ m, scores, detail }) => ({
    id: m.id,
    name: STRIP(m.name),
    sequence: m.sequence.map(STRIP),
    scores,
    confidence: usedTBD(detail) ? "low" : "medium",
    why: edit(m.id).why ?? STRIP(m.why),
    evidence: evidence(detail, period, TH),
    benefits: m.benefits.map(STRIP).filter((t) => !(edit(m.id).dropBenefits || []).includes(t)),
    gaps: m.gaps.map(STRIP),
    risks: m.risks.map(STRIP).filter((t) => !(edit(m.id).dropRisks || []).includes(t)),
    pac_eligible: "TBD",
    income: rotationIncome(m.sequence, INCOME),
    water_balance: detail.water.map((x) => ({ crop: x.crop, months: x.months, rain_mm: round(x.rain, 1), need_mm: x.need === null ? null : round(x.need, 1) })),
    provenance: "derived",
    dataset: "NASA POWER",
    method: "pipeline/lib/rotations_core.mjs with pipeline/agro_rules.json; see pipeline/README.md",
    generated_at: today,
  }));
  const bare = results.find((r) => r.m.id === "current").detail.bareShare;
  return { rotations, bare };
}

// Keys merged into risk_windows.json for the current rotation's bare months.
export function bareMonthsKeys(bare) {
  return {
    bare_months: bare.map((b, i) => (b > 0 ? i + 1 : null)).filter(Boolean),
    bare_months_share: bare.map((b) => Math.round(b * 100) / 100),
    bare_months_source: "crop calendar (TBD), not satellite-observed",
  };
}

/* ---------- scenarios ---------- */

// days: output of power_core.toDays (without ET0 or with it; ET0 is recomputed). onProgress(i, n) optional.
// Income does not depend on climate here (no yield model), so it is the same in every scenario and is left
// out of the scenario ranking (equal weights of RANK_KEYS).
export function buildScenarios({ days: baseDays, lat, elev, y0, y1, TH, RULES, INCOME, texts, period, onProgress }) {
  const th = { frost_tmin_c: TH.frost.value, heat_tmax_c: TH.heat.value, extreme_rain_mm_day: TH.extreme_rain.value };
  const add = (v, d) => (v === null ? null : v + d);
  const grid = [];
  for (let rp = -40; rp <= 20; rp += 10) for (let dT = 0; dT <= 3; dT++) grid.push([rp, dT]);
  return grid.map(([rainPct, dT], i) => {
    const f = 1 + rainPct / 100;
    const days = baseDays.map((r) => ({
      ...r,
      PRECTOTCORR: r.PRECTOTCORR === null ? null : r.PRECTOTCORR * f,
      T2M_MAX: add(r.T2M_MAX, dT),
      T2M_MIN: add(r.T2M_MIN, dT),
      T2M: add(r.T2M, dT),
    }));
    c.addEt0(days, lat, elev);
    const clim = c.buildClimate(days, y0, y1, th);
    const weeks = c.buildWeeks(days, y0, y1, th);
    const scored = Object.fromEntries(texts.map((m) => [m.id, scoreRotation(m.sequence, clim.monthly, weeks, RULES, INCOME).scores]));
    const totals = Object.fromEntries(Object.entries(scored).map(([id, s]) => [id, totalScore(s)]));
    onProgress?.(i + 1, grid.length);
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
      method: `Daily NASA POWER ${period}: rain x (1 + rain_pct/100), Tmax and Tmin + temp_delta; ET0, weekly chances and scores recomputed. Ranking = equal weights of ${RANK_KEYS.join(", ")} (income left out: it does not change with climate in this model).`,
    };
  });
}

// Throws if the (0, 0) scenario does not reproduce the rotation scores exactly.
export function checkZeroScenario(scenarios, rotations) {
  const zero = scenarios.find((s) => s.rain_pct === 0 && s.temp_delta === 0);
  for (const r of rotations) {
    for (const k of Object.keys(r.scores)) {
      if (zero.criteria[r.id][k] !== r.scores[k]) throw new Error(`Scenario (0,0) does not match rotations: ${r.id}.${k} ${zero.criteria[r.id][k]} vs ${r.scores[k]}`);
    }
  }
  return zero;
}
