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

// A crop with rules.bare.value === true (Fallow) is a crop year with bare soil: no calendar, no Kc, no hazard.
export const isBare = (r) => r?.bare?.value === true;

function crop(name, RULES) {
  const r = RULES.crops[name];
  if (!r) throw new Error(`agro_rules.json: no rules for crop "${name}"`);
  if (isBare(r)) {
    const tbd = Object.entries(r).filter(([, v]) => isTBD(v)).map(([k]) => k);
    return { name, rules: r, bare: true, sow: null, harvest: null, cycle: [], tbd };
  }
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
// A bare crop year (Fallow) covers nothing and pushes the next sowing at least 12 months later.
// The cycle starts at the first crop that is not bare (a rotation repeats, so the order is kept).
function timeline(allCrops) {
  const i0 = allCrops.findIndex((cr) => !cr.bare);
  if (i0 < 0) throw new Error("a rotation needs at least one crop that is not fallow");
  const crops = [...allCrops.slice(i0), ...allCrops.slice(0, i0)];
  let t = crops[0].sow - 1;
  const start = t;
  const covered = new Set();
  let prevEnd = -1;
  for (const cr of crops) {
    if (cr.bare) {
      prevEnd += 12;
      continue;
    }
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
  const grown = crops.filter((cr) => !cr.bare);
  const water = grown.map((cr) => {
    const kc = cr.rules.kc.value;
    const rain = cr.cycle.reduce((s, m) => s + monthly.precip_mm[m - 1], 0);
    if (!kc) return { crop: cr.name, months: cr.cycle, ratio: null, rain, need: null };
    const k = monthlyKc(kc, cr.cycle.length);
    const need = cr.cycle.reduce((s, m, i) => s + k[i] * monthly.et0[m - 1], 0);
    return { crop: cr.name, months: cr.cycle, ratio: Math.min(1, rain / need), rain, need };
  });
  const waterVals = water.filter((w) => w.ratio !== null).map((w) => w.ratio);

  // risk resilience: 1 - mean weekly chance of the crop's hazard during its sensitive weeks
  const risk = grown.map((cr) => {
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
    // use_missing_value: false (e.g. Fallow): no value and not counted as missing_value either -> null
    const useFill = INCOME?.crops?.[name]?.use_missing_value !== false;
    return {
      crop: name,
      eur_ha: known ?? (useFill && typeof fill === "number" ? fill : null),
      assumed: known === null,
      years: vals.map((v) => v.year),
      ecrea_crop: vals[0]?.ecrea_crop ?? null,
      note: INCOME?.crops?.[name]?.note ?? null,
    };
  });
  const missing = byCrop.filter((b) => b.assumed).map((b) => b.crop);
  const filled = byCrop.filter((b) => b.assumed && b.eur_ha !== null).length;
  const docs = [...new Set(seq.flatMap((name) => (INCOME?.crops?.[name]?.values || []).map((v) => v.doc)))];
  return {
    eur_ha_year: byCrop.some((b) => b.eur_ha === null) ? null : round(mean(byCrop.map((b) => b.eur_ha)), 1),
    missing_rule: filled ? INCOME?.missing_value?.source ?? null : null,
    metric: "ECREA net margin (margen neto), euro per hectare and year, mean of the crops in the sequence",
    region: INCOME?.region ?? null,
    by_crop: byCrop,
    missing,
    source: "MAPA ECREA 2.0 (RECAN), see pipeline/income_ecrea.json",
    documents: docs.map((d) => ({ id: d, url: INCOME?.documents?.[d] ?? null })),
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
    // income uses regional ECREA net margins, so "no prices" is not accurate
    replaceGaps: { "Market prices not included": "Field-level yields and prices not included (regional ECREA averages used)" },
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
  if (w.length) ev.push(`NASA POWER ${period}: rain in the growing months covers ${w.map((x) => `${Math.round(x.ratio * 100)}% (${x.crop})`).join(", ")} of the crop water need (Kc x ET0).${noKc.length ? ` Not scored for water: ${noKc.join(", ")} (no FAO-56 Kc).` : ""}`);
  else if (noKc.length) ev.push(`Not scored for water: ${noKc.join(", ")} (no FAO-56 Kc).`);
  if (d.risk.length) ev.push(`NASA POWER ${period}: average weekly chance of the main hazard in the sensitive weeks: ${d.risk.map((r) => `${r.crop} ${r.hazard} ${Math.round(r.p * 100)}% (${monthSpan(r.months)})`).join(", ")}.`);
  const bare = d.bareShare.map((b, i) => (b > 0 ? MONTHS[i] : null)).filter(Boolean);
  ev.push(`NASA POWER ${period}: ${Math.round(d.bareRainShare * 100)}% of the year's heavy-rain frequency (days of ${TH.extreme_rain.value} mm or more) falls while this rotation leaves the soil bare${bare.length ? ` (bare in some or all years: ${bare.join(", ")})` : ""}.`);
  return ev.map((fact) => ({ dataset: "NASA POWER", fact, provenance: "derived" }));
}

// Texts of data/mock/rotations.json plus the rotations of pipeline/rotation_catalog.json, each with
// can_be_current (true = a farmer in the area can grow it today; missing = false).
export function rotationTexts(texts, CATALOG) {
  const all = [...texts, ...(CATALOG?.rotations || []).filter((x) => !texts.some((m) => m.id === x.id))];
  return all.map((m) => ({ ...m, can_be_current: CATALOG?.can_be_current?.[m.id]?.value === true }));
}

// Months (1-12) in which the field is bare in at least some years, from bareShare.
const bareMonths = (bare) => bare.map((b, i) => (b > 0 ? i + 1 : null)).filter(Boolean);

// texts: rotationTexts(data/mock/rotations.json, rotation_catalog.json). Returns { rotations, bare } (bare: current rotation's bare-month shares).
export function buildRotations({ texts, monthly, weeks, RULES, TH, INCOME, period, today }) {
  const usedTBD = (d) => d.crops.some((cr) => cr.tbd.length) || isTBD(RULES.kc_stages) || isTBD(INCOME?.score_scale);
  const edit = (id) => TEXT_EDITS[id] || {};
  const results = texts.map((m) => ({ m, ...scoreRotation(m.sequence, monthly, weeks, RULES, INCOME) }));
  const rotations = results.map(({ m, scores, detail }) => ({
    id: m.id,
    name: STRIP(m.name),
    can_be_current: m.can_be_current === true,
    sequence: m.sequence.map(STRIP),
    scores,
    confidence: usedTBD(detail) ? "low" : "medium",
    why: edit(m.id).why ?? STRIP(m.why),
    evidence: evidence(detail, period, TH),
    benefits: m.benefits.map(STRIP).filter((t) => !(edit(m.id).dropBenefits || []).includes(t)),
    gaps: m.gaps.map(STRIP).map((t) => edit(m.id).replaceGaps?.[t] ?? t),
    risks: m.risks.map(STRIP).filter((t) => !(edit(m.id).dropRisks || []).includes(t)),
    pac_eligible: "TBD",
    income: rotationIncome(m.sequence, INCOME),
    bare_months: bareMonths(detail.bareShare),
    bare_months_share: detail.bareShare.map((b) => Math.round(b * 100) / 100),
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
    bare_months: bareMonths(bare),
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
    // Inputs of the scores, so the browser can score a rotation built by the user for this scenario (scenarioClimate).
    const inputs = {
      precip_mm: clim.monthly.precip_mm,
      et0: clim.monthly.et0,
      weeks: Object.fromEntries(["p_frost", "p_heat", "p_extreme_rain"].map((k) => [k, weeks.map((w) => w[k])])),
    };
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
      inputs,
      provenance: "simulated",
      dataset: "NASA POWER",
      method: `Daily NASA POWER ${period}: rain x (1 + rain_pct/100), Tmax and Tmin + temp_delta; ET0, weekly chances and scores recomputed. Ranking = equal weights of ${RANK_KEYS.join(", ")} (income left out: it does not change with climate in this model).`,
    };
  });
}

// { monthly, weeks } of a scenario, in the shape scoreRotation takes. null if the file has no inputs (older files).
export function scenarioClimate(s) {
  const i = s?.inputs;
  if (!i?.precip_mm || !i?.et0 || !i?.weeks?.p_frost) return null;
  return {
    monthly: { precip_mm: i.precip_mm, et0: i.et0 },
    weeks: i.weeks.p_frost.map((_, k) => ({ week: k + 1, p_frost: i.weeks.p_frost[k], p_heat: i.weeks.p_heat[k], p_extreme_rain: i.weeks.p_extreme_rain[k] })),
  };
}

/* ---------- rotations built by the user (browser) ---------- */

// Crops a user can pick: every crop in agro_rules.json (Fallow included).
export const pickableCrops = (RULES) => Object.keys(RULES?.crops || {});

// Same family in two consecutive crop years (the rotation repeats, so the last and the first are consecutive too).
export function sameFamilyInARow(seq, RULES) {
  const fam = seq.map((n) => RULES.crops[n]?.family?.value ?? null);
  return fam.some((f, i) => f !== null && fam.length > 1 && f === fam[(i + 1) % fam.length]);
}

// A rotation built by the user from crops in agro_rules.json, scored with the same formulas as the others.
// Throws (message for the user) if a crop is unknown, everything is fallow, or the calendars do not give one crop per year.
export function buildCustomRotation({ id, sequence, monthly, weeks, RULES, TH, INCOME, period, today }) {
  const unknown = sequence.filter((n) => !RULES.crops[n]);
  if (unknown.length) throw new Error(`No rules for ${unknown.join(", ")}.`);
  if (sequence.every((n) => isBare(RULES.crops[n]))) throw new Error("Add at least one crop that is not fallow.");
  let res;
  try {
    res = scoreRotation(sequence, monthly, weeks, RULES, INCOME);
  } catch (err) {
    if (/cycle/.test(err.message)) throw new Error("With our crop calendars these crops do not fit one crop per year in this order. Try another order.");
    throw err;
  }
  const { scores, detail } = res;
  return {
    id,
    name: `Your rotation: ${sequence.join(" – ")}`,
    sequence: [...sequence],
    custom: true,
    can_be_current: true,
    scores,
    confidence: "low",
    why: "Built by you from crops in our rule table.",
    evidence: evidence(detail, period, TH),
    benefits: [],
    gaps: ["Built from the crop rules only: no texts reviewed by the team"],
    risks: [],
    same_family_in_a_row: sameFamilyInARow(sequence, RULES),
    pac_eligible: "TBD",
    income: rotationIncome(sequence, INCOME),
    bare_months: bareMonths(detail.bareShare),
    bare_months_share: detail.bareShare.map((b) => Math.round(b * 100) / 100),
    water_balance: detail.water.map((x) => ({ crop: x.crop, months: x.months, rain_mm: round(x.rain, 1), need_mm: x.need === null ? null : round(x.need, 1) })),
    provenance: "derived",
    dataset: "NASA POWER",
    method: "pipeline/lib/rotations_core.mjs with pipeline/agro_rules.json, in your browser",
    generated_at: today,
  };
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
