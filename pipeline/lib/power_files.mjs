// DeepKore: build parcel / climate / risk_windows / validation objects from NASA POWER daily data.
// Pure functions, used by the browser worker (js/live/worker.js) for a field chosen on the map.
// Mirrors pipeline/build_power_data.mjs; tools/check_live_core.mjs checks both give the same output
// for the pilot field.
import * as c from "./power_core.mjs";

// Downloads the daily series in 5-year blocks, `concurrency` requests at a time. onChunk(done, total).
export async function downloadPower(lat, lon, firstYear, today, onChunk, { fetchFn = fetch, concurrency = 3 } = {}) {
  const end = today.replaceAll("-", "");
  const chunks = c.yearChunks(firstYear, Number(today.slice(0, 4)), end);
  const out = new Array(chunks.length);
  let next = 0;
  let done = 0;
  const one = async ([a, b]) => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetchFn(c.powerUrl(lat, lon, a, b));
      if (res.ok) return res.json();
      if (attempt === 3) throw new Error(`NASA POWER ${a}-${b}: HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  };
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      out[i] = await one(chunks[i]);
      onChunk?.(++done, chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
  return { downloaded: today, responses: out };
}

export function powerSource(lat, lon, y0, y1, meta, accessed) {
  return {
    id: "nasa-power",
    dataset: "NASA POWER Daily API (Agroclimatology community)",
    provider: "NASA Langley Research Center",
    url: "https://power.larc.nasa.gov/",
    api_url: c.powerUrl(lat, lon, `${y0}0101`, `${y1}1231`),
    version: `API ${meta.api_version}; inputs ${meta.sources.join(", ")}`,
    accessed,
    resolution: "Native resolution of its inputs (about 0.5° x 0.625° for MERRA-2 meteorology, 1° for SYN1deg solar): one grid cell covers far more than one field",
    coverage: `Daily, ${y0}-01-01 to latest available day`,
    license: "NASA open data. Acknowledgement requested: \"These data were obtained from the NASA Langley Research Center POWER Project funded through the NASA Earth Science Directorate Applied Science Program.\"",
    variables: Object.entries(meta.units).map(([k, u]) => `${k} (${u})`).join(", "),
    role: "Weekly frost, extreme-heat and heavy-rain frequency; monthly rain, temperature and reference evapotranspiration (FAO-56); root-zone soil wetness now; dry-year check (2023).",
    provenance: "derived",
    limits: "Model and satellite-based reanalysis, not a weather station on the field. Root-zone wetness (GWETROOT) is a model output, 0 = dry, 1 = saturated, not volumetric moisture.",
  };
}

// cfg: { name, lat, lon, first_year, last_full_year }; TH: thresholds.json; raw: { downloaded, responses }.
// eventName: label of the place in validation.json.
export function buildPowerFiles({ raw, cfg, TH, today, eventName }) {
  const { days, meta } = c.toDays(raw.responses);
  c.addEt0(days, cfg.lat, meta.elevation_m);
  const y0 = cfg.first_year;
  const y1 = cfg.last_full_year;
  const th = { frost_tmin_c: TH.frost.value, heat_tmax_c: TH.heat.value, extreme_rain_mm_day: TH.extreme_rain.value };
  const clim = c.buildClimate(days, y0, y1, th);
  const weeks = c.buildWeeks(days, y0, y1, th);
  const smRoot = c.soilMoistureNow(days, y0, y1, "GWETROOT");
  const smTop = c.soilMoistureNow(days, y0, y1, "GWETTOP");

  const parcel = {
    name: cfg.name,
    lat: cfg.lat,
    lon: cfg.lon,
    elevation_m_power: meta.elevation_m,
    period: `${y0}-${y1}`,
    provenance: "derived",
    generated_at: today,
    sources: [powerSource(cfg.lat, cfg.lon, y0, y1, meta, raw.downloaded)],
  };

  const climate = {
    monthly: clim.monthly,
    trends: clim.trends,
    units: { precip_mm: "mm per month", tmax: "°C, mean of daily max", tmin: "°C, mean of daily min", et0: "mm per month (FAO-56 Penman-Monteith)" },
    thresholds: TH,
    source: "NASA POWER",
    provenance: "derived",
    generated_at: today,
  };

  const risk_windows = {
    weeks,
    n_years: y1 - y0 + 1,
    period: `${y0}-${y1}`,
    method: "Share of years in which at least one day of that week met the rule.",
    thresholds: TH,
    datasets: { p_frost: "NASA POWER", p_heat: "NASA POWER", p_extreme_rain: "NASA POWER" },
    soil_moisture_now: smRoot && {
      value: smRoot.value,
      unit: "root-zone wetness, 0-1",
      anomaly_pct: smRoot.anomaly_pct,
      percentile: smRoot.percentile,
      median_same_season: smRoot.median_same_season,
      date: smRoot.date,
      source: "NASA POWER GWETROOT (model-based root-zone soil wetness)",
      dataset: "NASA POWER",
      provenance: "derived",
      surface: smTop && { value: smTop.value, anomaly_pct: smTop.anomaly_pct, percentile: smTop.percentile, source: "NASA POWER GWETTOP" },
    },
    bare_months: [],
    provenance: "derived",
    generated_at: today,
  };

  // Dry year 2022-23. Base = hydrological years 2002-2022 (the test year is left out).
  const rain = c.rainBacktest(days, 2023, 2002, 2022);
  const soil = c.soilBacktest(days, { key: "GWETROOT", from: "20220901", to: "20230831", baseY0: y0, baseY1: 2021, threshold: TH.soil_alert.percentile, runDays: TH.soil_alert.run_days });
  const spring = c.seasonRanking(days, y0, y1, [3, 4, 5], 2023);
  const april = rain.find((r) => r.month === "2023-04");
  const validation = {
    event: `Dry 2022-23 season, ${eventName}`,
    question: "Do NASA data show the 2023 drought clearly at this location, and when?",
    rain_since_october: rain,
    spring_ranking: spring,
    soil_signal: { indicator: "NASA POWER GWETROOT, 14-day mean, percentile for the time of year", rule: `alert when below percentile ${TH.soil_alert.percentile} for ${TH.soil_alert.run_days} days in a row`, rule_source: TH.soil_alert.source, base_years: `${y0}-2021`, ...soil },
    headline: `Rain since 1 October 2022 was ${april.cum_mm} mm by the end of April 2023, against a usual ${april.base_median} mm; ${april.drier_base_years === 0 ? `drier than all ${april.n_base_years} reference years` : `${april.drier_base_years} of ${april.n_base_years} reference years were drier`}. March-May 2023 had ${spring.rain_mm} mm (rank ${spring.rain_rank_driest} driest of ${spring.n_years}).`,
    limits: [
      "One event at one location.",
      "Checks that the data show the drought, not crop yields or the outcome of any rotation.",
      "GWETROOT stays near its dry floor every summer, so the soil percentile is low every July-October; read the autumn and spring part.",
      "Grid cells are tens of km wide.",
    ],
    provenance: "derived",
    generated_at: today,
  };

  return { days, meta, parcel, climate, risk_windows, validation };
}
