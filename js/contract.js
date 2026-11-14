// Data contract checks. Shared by the browser app and tools/validate_data.mjs.
// Each validator returns a list of human-readable problems ([] = OK).

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string";
const isArr = Array.isArray;
const isObj = (v) => v !== null && typeof v === "object" && !isArr(v);

function need(problems, cond, msg) {
  if (!cond) problems.push(msg);
}

export const CRITERIA = ["water", "soil", "income", "erosion", "risk_resilience"];

export function validateParcel(p) {
  const e = [];
  need(e, isObj(p), "parcel: must be an object");
  if (!isObj(p)) return e;
  need(e, isStr(p.name), "parcel.name: string expected");
  need(e, isNum(p.lat) && isNum(p.lon), "parcel.lat/lon: numbers expected");
  need(e, p.period !== undefined, "parcel.period: missing");
  need(e, isArr(p.sources), "parcel.sources: array expected");
  (p.sources || []).forEach((s, i) => {
    for (const k of ["dataset", "url", "version", "resolution", "license", "role"]) {
      need(e, s && s[k] !== undefined, `parcel.sources[${i}].${k}: missing`);
    }
  });
  return e;
}

export function validateClimate(c) {
  const e = [];
  need(e, isObj(c), "climate: must be an object");
  if (!isObj(c)) return e;
  const m = c.monthly || {};
  for (const k of ["precip_mm", "tmax", "tmin", "et0"]) {
    need(e, isArr(m[k]) && m[k].length === 12 && m[k].every(isNum), `climate.monthly.${k}: 12 numbers expected`);
  }
  const t = c.trends || {};
  need(e, isArr(t.years), "climate.trends.years: array expected");
  for (const k of ["frost_days", "heat_days", "annual_precip"]) {
    need(e, isArr(t[k]) && isArr(t.years) && t[k].length === t.years.length, `climate.trends.${k}: same length as years expected`);
  }
  need(e, c.provenance !== undefined, "climate.provenance: missing");
  return e;
}

export function validateRiskWindows(r) {
  const e = [];
  need(e, isObj(r), "risk_windows: must be an object");
  if (!isObj(r)) return e;
  need(e, isArr(r.weeks) && r.weeks.length === 52, "risk_windows.weeks: 52 items expected");
  (r.weeks || []).forEach((w, i) => {
    for (const k of ["p_frost", "p_heat", "p_extreme_rain"]) {
      need(e, isNum(w[k]) && w[k] >= 0 && w[k] <= 1, `risk_windows.weeks[${i}].${k}: probability 0-1 expected`);
    }
  });
  const s = r.soil_moisture_now;
  need(e, isObj(s) && isNum(s.value) && isNum(s.anomaly_pct), "risk_windows.soil_moisture_now: {value, anomaly_pct, date, source} expected");
  need(e, isArr(r.bare_months), "risk_windows.bare_months: array expected");
  return e;
}

export function validateRotations(list) {
  const e = [];
  need(e, isArr(list) && list.length >= 3, "rotations: array with at least 3 rotations expected");
  if (!isArr(list)) return e;
  need(e, list.some((r) => r.id === "current"), 'rotations: one rotation must have id "current" (the default current rotation)');
  // can_be_current: true = a farmer in the area can grow it today (offered in "What do you grow now?").
  // Older files (data/mock) have no can_be_current at all: then only "current" is offered.
  const withFlag = list.filter((r) => r && r.can_be_current !== undefined).length;
  need(e, withFlag === 0 || withFlag === list.length, "rotations: can_be_current must be set on every rotation or on none");
  if (withFlag) need(e, list.some((r) => r.id === "current" && r.can_be_current === true), 'rotations: the "current" rotation must have can_be_current: true');
  list.forEach((r, i) => {
    const tag = `rotations[${i}]${r && r.id ? ` (${r.id})` : ""}`;
    need(e, isStr(r.id) && isStr(r.name), `${tag}: id and name expected`);
    need(e, isArr(r.sequence), `${tag}.sequence: array expected`);
    for (const k of CRITERIA) {
      // income may be null: not scored yet (no verified local prices or yields)
      const ok = r.scores && (isNum(r.scores[k]) || (k === "income" && r.scores[k] === null));
      need(e, ok, `${tag}.scores.${k}: number expected${k === "income" ? " (or null)" : ""}`);
    }
    for (const k of ["evidence", "benefits", "gaps", "risks"]) {
      need(e, isArr(r[k]), `${tag}.${k}: array expected`);
    }
    need(e, r.can_be_current === undefined || typeof r.can_be_current === "boolean", `${tag}.can_be_current: true or false expected`);
    // income is optional; when present its yearly and per-crop margins are numbers or null (no verified value)
    if (r.income !== undefined) {
      need(e, isObj(r.income) && (isNum(r.income.eur_ha_year) || r.income.eur_ha_year === null), `${tag}.income.eur_ha_year: number or null expected`);
      need(e, isArr(r.income?.by_crop) && r.income.by_crop.every((b) => isStr(b?.crop) && (isNum(b.eur_ha) || b.eur_ha === null)), `${tag}.income.by_crop: [{crop, eur_ha: number or null}] expected`);
      need(e, isArr(r.income?.missing), `${tag}.income.missing: array expected`);
    }
    need(e, r.why !== undefined, `${tag}.why: missing`);
    need(e, r.confidence !== undefined, `${tag}.confidence: missing`);
    need(e, r.pac_eligible !== undefined, `${tag}.pac_eligible: missing`);
  });
  return e;
}

export function validateScenarios(list) {
  const e = [];
  need(e, isArr(list) && list.length > 0, "scenarios: non-empty array expected");
  if (!isArr(list)) return e;
  list.forEach((s, i) => {
    const tag = `scenarios[${i}]`;
    need(e, isNum(s.rain_pct) && isNum(s.temp_delta), `${tag}: rain_pct and temp_delta numbers expected`);
    need(e, isArr(s.ranking), `${tag}.ranking: array expected`);
    need(e, isObj(s.scores), `${tag}.scores: object {id: total} expected`);
  });
  return e;
}

export function validateValidation(v) {
  const e = [];
  need(e, isObj(v), "validation: must be an object");
  if (!isObj(v)) return e;
  need(e, isStr(v.headline), "validation.headline: string expected");
  need(e, isArr(v.rain_since_october) && v.rain_since_october.length > 0, "validation.rain_since_october: non-empty array expected");
  (v.rain_since_october || []).forEach((r, i) => {
    need(e, isStr(r.month) && isNum(r.cum_mm) && isNum(r.base_median) && isNum(r.base_p20), `validation.rain_since_october[${i}]: {month, cum_mm, base_median, base_p20} expected`);
  });
  need(e, v.limits === undefined || isArr(v.limits), "validation.limits: array expected");
  need(e, v.provenance !== undefined, "validation.provenance: missing");
  return e;
}

// Cross-file check: every scenario scores and ranks every rotation.
export function validateScenariosCover(scenarios, rotations) {
  const e = [];
  if (!isArr(scenarios) || !isArr(rotations)) return e;
  const ids = rotations.map((r) => r.id);
  scenarios.forEach((s, i) => {
    const miss = ids.filter((id) => !isNum(s?.scores?.[id]) || !(s?.ranking || []).includes(id));
    need(e, !miss.length, `scenarios[${i}]: no score or ranking for ${miss.join(", ")}`);
  });
  return e;
}

export const VALIDATORS = {
  parcel: validateParcel,
  climate: validateClimate,
  risk_windows: validateRiskWindows,
  rotations: validateRotations,
  scenarios: validateScenarios,
  validation: validateValidation,
};
