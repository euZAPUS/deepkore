// DeepKore data pipeline: pure functions for NASA POWER daily data.
// No Node-only imports here, so the same code runs in Node and in a browser.
// References: FAO Irrigation and Drainage Paper 56 (Allen et al., 1998) for ET0.

export const PARAMS = ["T2M_MAX", "T2M_MIN", "T2M", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "WS2M", "RH2M", "GWETROOT", "GWETTOP"];
export const API = "https://power.larc.nasa.gov/api/temporal/daily/point";

export function powerUrl(lat, lon, start, end) {
  return `${API}?parameters=${PARAMS.join(",")}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
}

// [[YYYYMMDD, YYYYMMDD], ...] in blocks of `size` years; the last block ends at endDate.
export function yearChunks(startYear, endYear, endDate, size = 5) {
  const out = [];
  for (let y = startYear; y <= endYear; y += size) {
    const y2 = Math.min(y + size - 1, endYear);
    out.push([`${y}0101`, y2 === endYear ? endDate : `${y2}1231`]);
  }
  return out;
}

export function dayOfYear(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}
export function weekOf(doy) {
  return Math.min(Math.floor((doy - 1) / 7) + 1, 52);
}
export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Merge raw API responses into one sorted list of day records. Fill values become null.
export function toDays(responses) {
  const map = new Map();
  let meta = null;
  for (const j of responses) {
    const fill = j.header.fill_value;
    if (!meta) {
      meta = {
        api_version: j.header.api.version,
        sources: j.header.sources,
        fill_value: fill,
        elevation_m: j.geometry.coordinates[2],
        units: Object.fromEntries(Object.entries(j.parameters).map(([k, v]) => [k, v.units])),
      };
    }
    const p = j.properties.parameter;
    for (const date of Object.keys(p[PARAMS[0]])) {
      const rec = { date, y: +date.slice(0, 4), m: +date.slice(4, 6), d: +date.slice(6, 8) };
      for (const k of PARAMS) {
        const v = p[k] ? p[k][date] : undefined;
        rec[k] = v === undefined || v === null || v === fill ? null : v;
      }
      rec.doy = dayOfYear(rec.y, rec.m, rec.d);
      map.set(date, rec);
    }
  }
  const days = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { days, meta };
}

// FAO-56 Penman-Monteith reference evapotranspiration, mm/day.
// rs in MJ/m2/day, u2 in m/s, rh in %, temperatures in degC, elev in m, lat in degrees.
export function et0PM({ tmax, tmin, rh, u2, rs, lat, elev, doy, eaOverride }) {
  const need = [tmax, tmin, u2, rs];
  if (eaOverride === undefined) need.push(rh);
  if (need.some((v) => v === null || v === undefined || Number.isNaN(v))) return null;
  const T = (tmax + tmin) / 2;
  const e0 = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
  const es = (e0(tmax) + e0(tmin)) / 2;
  const ea = eaOverride !== undefined ? eaOverride : (rh / 100) * es;
  const delta = (4098 * e0(T)) / (T + 237.3) ** 2;
  const P = 101.3 * ((293 - 0.0065 * elev) / 293) ** 5.26;
  const gamma = 0.000665 * P;
  const phi = (lat * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const dec = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(dec));
  const Ra = ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
  const Rso = (0.75 + 2e-5 * elev) * Ra;
  const Rns = 0.77 * rs;
  const rel = Math.min(rs / Rso, 1);
  const Rnl = 4.903e-9 * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * rel - 0.35);
  const Rn = Rns - Rnl;
  const num = 0.408 * delta * Rn + gamma * (900 / (T + 273)) * u2 * (es - ea);
  const den = delta + gamma * (1 + 0.34 * u2);
  return Math.max(0, num / den);
}

export function addEt0(days, lat, elev) {
  for (const r of days) {
    r.ET0 = et0PM({ tmax: r.T2M_MAX, tmin: r.T2M_MIN, rh: r.RH2M, u2: r.WS2M, rs: r.ALLSKY_SFC_SW_DWN, lat, elev, doy: r.doy });
  }
  return days;
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const round = (v, n = 1) => (v === null ? null : Math.round(v * 10 ** n) / 10 ** n);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

// Monthly climatology and yearly trends for years y0..y1 (inclusive).
// A year-month is used only if at least 90 % of its days are valid for that variable.
export function buildClimate(days, y0, y1, th) {
  const inRange = days.filter((r) => r.y >= y0 && r.y <= y1);
  const monthly = { precip_mm: [], tmax: [], tmin: [], et0: [] };
  const skipped = [];
  for (let m = 1; m <= 12; m++) {
    const acc = { precip_mm: [], tmax: [], tmin: [], et0: [] };
    for (let y = y0; y <= y1; y++) {
      const recs = inRange.filter((r) => r.y === y && r.m === m);
      const n = daysInMonth(y, m);
      const pick = (k) => recs.map((r) => r[k]).filter((v) => v !== null && v !== undefined);
      const use = (key, k, total) => {
        const v = pick(k);
        if (v.length < 0.9 * n) {
          skipped.push(`${y}-${String(m).padStart(2, "0")} ${k}`);
          return;
        }
        acc[key].push(total ? mean(v) * n : mean(v));
      };
      use("precip_mm", "PRECTOTCORR", true);
      use("et0", "ET0", true);
      use("tmax", "T2M_MAX", false);
      use("tmin", "T2M_MIN", false);
    }
    monthly.precip_mm.push(round(mean(acc.precip_mm), 1));
    monthly.et0.push(round(mean(acc.et0), 1));
    monthly.tmax.push(round(mean(acc.tmax), 1));
    monthly.tmin.push(round(mean(acc.tmin), 1));
  }
  const trends = { years: [], frost_days: [], heat_days: [], annual_precip: [] };
  for (let y = y0; y <= y1; y++) {
    const recs = inRange.filter((r) => r.y === y);
    trends.years.push(y);
    trends.frost_days.push(recs.filter((r) => r.T2M_MIN !== null && r.T2M_MIN < th.frost_tmin_c).length);
    trends.heat_days.push(recs.filter((r) => r.T2M_MAX !== null && r.T2M_MAX >= th.heat_tmax_c).length);
    trends.annual_precip.push(round(recs.reduce((s, r) => s + (r.PRECTOTCORR || 0), 0), 0));
  }
  return { monthly, trends, skipped };
}

// Historical weekly frequency: share of years in which at least one day of that week met the rule.
export function buildWeeks(days, y0, y1, th) {
  const tests = {
    p_frost: (r) => (r.T2M_MIN === null ? null : r.T2M_MIN < th.frost_tmin_c),
    p_heat: (r) => (r.T2M_MAX === null ? null : r.T2M_MAX >= th.heat_tmax_c),
    p_extreme_rain: (r) => (r.PRECTOTCORR === null ? null : r.PRECTOTCORR >= th.extreme_rain_mm_day),
  };
  const weeks = [];
  for (let w = 1; w <= 52; w++) {
    const row = { week: w };
    for (const [key, test] of Object.entries(tests)) {
      let hit = 0;
      let valid = 0;
      for (let y = y0; y <= y1; y++) {
        const flags = days.filter((r) => r.y === y && weekOf(r.doy) === w).map(test).filter((f) => f !== null);
        if (!flags.length) continue;
        valid++;
        if (flags.some(Boolean)) hit++;
      }
      row[key] = valid ? round(hit / valid, 2) : 0;
    }
    weeks.push(row);
  }
  return weeks;
}

// Latest valid value of `key`, compared with the same time of year (+-halfWindow days) in y0..y1,
// leaving out the year of the latest value.
export function soilMoistureNow(days, y0, y1, key = "GWETROOT", halfWindow = 15) {
  let last = null;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i][key] !== null && days[i][key] !== undefined) {
      last = days[i];
      break;
    }
  }
  if (!last) return null;
  const dist = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 365 - d);
  };
  const ref = days
    .filter((r) => r.y >= y0 && r.y <= y1 && r.y !== last.y && r[key] !== null && dist(r.doy, last.doy) <= halfWindow)
    .map((r) => r[key])
    .sort((a, b) => a - b);
  const median = quantile(ref, 0.5);
  const below = ref.filter((v) => v < last[key]).length;
  return {
    value: last[key],
    date: `${last.date.slice(0, 4)}-${last.date.slice(4, 6)}-${last.date.slice(6, 8)}`,
    median_same_season: round(median, 3),
    anomaly_pct: Math.round(((last[key] - median) / median) * 100),
    percentile: Math.round((below / ref.length) * 100),
    n_reference_days: ref.length,
  };
}

// Data-driven alternatives printed next to the fixed rules, so the team can choose and cite.
export function describeExtremes(days, y0, y1) {
  const inRange = days.filter((r) => r.y >= y0 && r.y <= y1);
  const tmax = inRange.map((r) => r.T2M_MAX).filter((v) => v !== null).sort((a, b) => a - b);
  const tmin = inRange.map((r) => r.T2M_MIN).filter((v) => v !== null).sort((a, b) => a - b);
  const wet = inRange.map((r) => r.PRECTOTCORR).filter((v) => v !== null && v >= 1).sort((a, b) => a - b);
  const count = (k) => inRange.filter((r) => r[k] === null).length;
  return {
    n_days: inRange.length,
    missing: Object.fromEntries(PARAMS.map((k) => [k, count(k)])),
    tmax_p95: round(quantile(tmax, 0.95), 1),
    tmax_max: round(tmax[tmax.length - 1], 1),
    tmin_p05: round(quantile(tmin, 0.05), 1),
    tmin_min: round(tmin[0], 1),
    wet_day_p95_mm: round(quantile(wet, 0.95), 1),
    wet_day_p99_mm: round(quantile(wet, 0.99), 1),
    max_daily_rain_mm: round(wet[wet.length - 1], 1),
    wet_days_per_year: round(wet.length / (y1 - y0 + 1), 0),
  };
}

/* ---------- 2022-23 drought check (validation) ---------- */

const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
export const HYDRO_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

// Cumulative rain since 1 October for the hydrological year ending in `h` (Oct h-1 .. Aug h).
export function cumulativeRain(days, h) {
  let s = 0;
  return HYDRO_MONTHS.map((m) => {
    const y = m >= 10 ? h - 1 : h;
    s += days.filter((r) => r.y === y && r.m === m).reduce((a, r) => a + (r.PRECTOTCORR || 0), 0);
    return s;
  });
}

// Test year against base hydrological years baseFirstH..baseLastH (the test year is not in the base).
export function rainBacktest(days, testH, baseFirstH, baseLastH) {
  const base = [];
  for (let h = baseFirstH; h <= baseLastH; h++) base.push(cumulativeRain(days, h));
  const test = cumulativeRain(days, testH);
  return HYDRO_MONTHS.map((m, i) => {
    const col = base.map((b) => b[i]).sort((a, b) => a - b);
    return {
      month: `${m >= 10 ? testH - 1 : testH}-${String(m).padStart(2, "0")}`,
      cum_mm: Math.round(test[i]),
      base_median: Math.round(quantile(col, 0.5)),
      base_p20: Math.round(quantile(col, 0.2)),
      drier_base_years: col.filter((v) => v < test[i]).length,
      n_base_years: col.length,
    };
  });
}

export function rollingMean(days, key, n = 14, minValid = 10) {
  return days.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, i - n + 1); k <= i; k++) {
      const v = days[k][key];
      if (v !== null && v !== undefined) {
        s += v;
        c++;
      }
    }
    return c >= minValid ? s / c : null;
  });
}

// Percentile of series[i] among values of the same time of year (+-halfWindow days) in years y0..y1.
export function seasonalPercentile(days, series, i, y0, y1, halfWindow = 15) {
  const v = series[i];
  if (v === null) return null;
  const doy = days[i].doy;
  const ref = [];
  for (let k = 0; k < days.length; k++) {
    const r = days[k];
    if (r.y < y0 || r.y > y1 || series[k] === null) continue;
    const d = Math.abs(r.doy - doy);
    if (Math.min(d, 365 - d) <= halfWindow) ref.push(series[k]);
  }
  return ref.length ? Math.round((ref.filter((x) => x < v).length / ref.length) * 100) : null;
}

// Rule fixed in advance: alert when the percentile stays below `threshold` for `runDays` days in a row.
export function soilBacktest(days, { key = "GWETROOT", from, to, baseY0, baseY1, threshold = 20, runDays = 14 }) {
  const series = rollingMean(days, key);
  const points = [];
  const alertDates = [];
  let run = 0;
  let below = 0;
  let n = 0;
  for (let i = 0; i < days.length; i++) {
    const r = days[i];
    if (r.date < from || r.date > to) continue;
    const p = seasonalPercentile(days, series, i, baseY0, baseY1);
    if (p === null) continue;
    n++;
    if (r.d === 1 || r.d === 15) points.push({ date: iso(r.date), value: round(series[i], 3), percentile: p });
    if (p < threshold) {
      run++;
      below++;
      if (run === runDays) alertDates.push(iso(r.date));
    } else run = 0;
  }
  return { points, alert_dates: alertDates, days_below_threshold: below, n_days: n };
}

// Rank of testYear among y0..y1 for rain total and mean soil wetness over the given months (1 = lowest).
export function seasonRanking(days, y0, y1, months, testYear) {
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    const s = days.filter((r) => r.y === y && months.includes(r.m));
    const wet = s.map((r) => r.GWETROOT).filter((v) => v !== null);
    rows.push({ y, rain: s.reduce((a, r) => a + (r.PRECTOTCORR || 0), 0), wet: mean(wet) });
  }
  const t = rows.find((r) => r.y === testYear);
  return {
    year: testYear,
    months,
    n_years: rows.length,
    rain_mm: Math.round(t.rain),
    rain_rank_driest: rows.filter((r) => r.rain < t.rain).length + 1,
    rain_median_mm: Math.round(quantile(rows.map((r) => r.rain).sort((a, b) => a - b), 0.5)),
    root_wetness_mean: round(t.wet, 3),
    root_wetness_rank_lowest: rows.filter((r) => r.wet < t.wet).length + 1,
  };
}
