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
  need(e, list.some((r) => r.id === "current"), 'rotations: one rotation must have id "current"');
  list.forEach((r, i) => {
    const tag = `rotations[${i}]${r && r.id ? ` (${r.id})` : ""}`;
    need(e, isStr(r.id) && isStr(r.name), `${tag}: id and name expected`);
    need(e, isArr(r.sequence), `${tag}.sequence: array expected`);
    for (const k of CRITERIA) {
      need(e, r.scores && isNum(r.scores[k]), `${tag}.scores.${k}: number expected`);
    }
    for (const k of ["evidence", "benefits", "gaps", "risks"]) {
      need(e, isArr(r[k]), `${tag}.${k}: array expected`);
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

export const VALIDATORS = {
  parcel: validateParcel,
  climate: validateClimate,
  risk_windows: validateRiskWindows,
  rotations: validateRotations,
  scenarios: validateScenarios,
};
