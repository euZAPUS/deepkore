// DeepKore: download NASA POWER daily data for the pilot parcel and write the real JSON files.
// Usage:  node pipeline/build_power_data.mjs            (downloads, caches in pipeline/raw/)
//         node pipeline/build_power_data.mjs --offline  (reuses pipeline/raw/power_daily.json)
// Writes: data/parcel.json, data/climate.json, data/risk_windows.json, data/validation.json
// It keeps any keys other scripts added to those files (it merges, it does not wipe).
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as c from "./lib/power_core.mjs";

const CFG = JSON.parse(await readFile(new URL("./config.json", import.meta.url), "utf8"));
const TH = JSON.parse(await readFile(new URL("./thresholds.json", import.meta.url), "utf8"));
const ROOT = new URL("../", import.meta.url);
const RAW = new URL("pipeline/raw/power_daily.json", ROOT);
const OFFLINE = process.argv.includes("--offline");
const today = new Date().toISOString().slice(0, 10);

async function download() {
  const end = today.replaceAll("-", "");
  const chunks = c.yearChunks(CFG.first_year, Number(today.slice(0, 4)), end);
  const out = [];
  for (const [a, b] of chunks) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(c.powerUrl(CFG.lat, CFG.lon, a, b));
      if (res.ok) {
        out.push(await res.json());
        console.log(`POWER ${a}-${b}: OK`);
        break;
      }
      if (attempt === 3) throw new Error(`POWER ${a}-${b}: HTTP ${res.status} ${await res.text()}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  await mkdir(new URL("pipeline/raw/", ROOT), { recursive: true });
  await writeFile(RAW, JSON.stringify({ downloaded: today, responses: out }));
  return { downloaded: today, responses: out };
}

async function readJson(rel) {
  const u = new URL(rel, ROOT);
  return existsSync(u) ? JSON.parse(await readFile(u, "utf8")) : {};
}
async function writeJson(rel, obj) {
  const u = new URL(rel, ROOT);
  const tmp = new URL(rel + ".tmp", ROOT);
  await writeFile(tmp, JSON.stringify(obj, null, 2) + "\n");
  await rename(tmp, u);
  console.log("wrote", rel);
}

const raw = OFFLINE ? JSON.parse(await readFile(RAW, "utf8")) : await download();
const { days, meta } = c.toDays(raw.responses);
c.addEt0(days, CFG.lat, meta.elevation_m);
const y0 = CFG.first_year;
const y1 = CFG.last_full_year;
const th = { frost_tmin_c: TH.frost.value, heat_tmax_c: TH.heat.value, extreme_rain_mm_day: TH.extreme_rain.value };

const ext = c.describeExtremes(days, y0, y1);
const clim = c.buildClimate(days, y0, y1, th);
const weeks = c.buildWeeks(days, y0, y1, th);
const smRoot = c.soilMoistureNow(days, y0, y1, "GWETROOT");
const smTop = c.soilMoistureNow(days, y0, y1, "GWETTOP");
if (Object.values(ext.missing).some((n) => n > 0)) console.warn("Missing days in base period:", ext.missing);
if (clim.skipped.length) console.warn("Month-variables skipped (<90 % valid days):", clim.skipped);

const POWER_SOURCE = {
  id: "nasa-power",
  dataset: "NASA POWER Daily API (Agroclimatology community)",
  provider: "NASA Langley Research Center",
  url: "https://power.larc.nasa.gov/",
  api_url: c.powerUrl(CFG.lat, CFG.lon, `${y0}0101`, `${y1}1231`),
  version: `API ${meta.api_version}; inputs ${meta.sources.join(", ")}`,
  accessed: raw.downloaded,
  resolution: "Native resolution of its inputs (about 0.5° x 0.625° for MERRA-2 meteorology, 1° for SYN1deg solar): one grid cell covers far more than one field",
  coverage: `Daily, ${y0}-01-01 to latest available day`,
  license: "NASA open data. Acknowledgement requested: \"These data were obtained from the NASA Langley Research Center POWER Project funded through the NASA Earth Science Directorate Applied Science Program.\"",
  variables: Object.entries(meta.units).map(([k, u]) => `${k} (${u})`).join(", "),
  role: "Weekly frost, extreme-heat and heavy-rain frequency; monthly rain, temperature and reference evapotranspiration (FAO-56); root-zone soil wetness now; dry-year check (2023).",
  provenance: "derived",
  limits: "Model and satellite-based reanalysis, not a weather station on the field. Root-zone wetness (GWETROOT) is a model output, 0 = dry, 1 = saturated, not volumetric moisture.",
};

// parcel.json
const parcel = await readJson("data/parcel.json");
const otherSources = (parcel.sources || []).filter((s) => s.id !== "nasa-power");
await writeJson("data/parcel.json", {
  ...parcel,
  name: CFG.name,
  lat: CFG.lat,
  lon: CFG.lon,
  elevation_m_power: meta.elevation_m,
  period: `${y0}-${y1}`,
  provenance: "derived",
  generated_at: today,
  sources: [POWER_SOURCE, ...otherSources],
});

// climate.json
await writeJson("data/climate.json", {
  ...(await readJson("data/climate.json")),
  monthly: clim.monthly,
  trends: clim.trends,
  units: { precip_mm: "mm per month", tmax: "°C, mean of daily max", tmin: "°C, mean of daily min", et0: "mm per month (FAO-56 Penman-Monteith)" },
  thresholds: TH,
  source: "NASA POWER",
  provenance: "derived",
  generated_at: today,
});

// risk_windows.json (keeps bare_months and any other keys written by other scripts)
const rw = await readJson("data/risk_windows.json");
await writeJson("data/risk_windows.json", {
  ...rw,
  weeks,
  n_years: y1 - y0 + 1,
  period: `${y0}-${y1}`,
  method: "Share of years in which at least one day of that week met the rule.",
  thresholds: TH,
  datasets: { p_frost: "NASA POWER", p_heat: "NASA POWER", p_extreme_rain: "NASA POWER" },
  soil_moisture_now:
    rw.soil_moisture_now && rw.soil_moisture_now.provenance === "observed"
      ? rw.soil_moisture_now
      : {
          value: smRoot.value,
          unit: "root-zone wetness, 0-1",
          anomaly_pct: smRoot.anomaly_pct,
          percentile: smRoot.percentile,
          median_same_season: smRoot.median_same_season,
          date: smRoot.date,
          source: "NASA POWER GWETROOT (model-based root-zone soil wetness)",
          dataset: "NASA POWER",
          provenance: "derived",
          surface: { value: smTop.value, anomaly_pct: smTop.anomaly_pct, percentile: smTop.percentile, source: "NASA POWER GWETTOP" },
        },
  bare_months: rw.bare_months || [],
  provenance: "derived",
  generated_at: today,
});

// validation.json: dry year 2022-23. Base = hydrological years 2002-2022 (the test year is left out).
const rain = c.rainBacktest(days, 2023, 2002, 2022);
const soil = c.soilBacktest(days, { key: "GWETROOT", from: "20220901", to: "20230831", baseY0: y0, baseY1: 2021, threshold: TH.soil_alert.percentile, runDays: TH.soil_alert.run_days });
const spring = c.seasonRanking(days, y0, y1, [3, 4, 5], 2023);
const april = rain.find((r) => r.month === "2023-04");
await writeJson("data/validation.json", {
  event: "Dry 2022-23 season, pilot parcel (Vega de Antequera)",
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
});

console.log("\nCHECK VALUES (compare with the run of 14 Nov 2026):");
console.log(" days:", days.length, "| api:", meta.api_version, "| elevation:", meta.elevation_m);
console.log(" Tmax p95:", ext.tmax_p95, "(35.2)  wet-day p95:", ext.wet_day_p95_mm, "(21.9)");
console.log(" 2023 annual rain:", clim.trends.annual_precip[clim.trends.years.indexOf(2023)], "(233)");
console.log(" soil now:", smRoot.date, smRoot.value, smRoot.anomaly_pct + "%", "(2026-11-11 0.47 -10% on that run)");
console.log(" spring 2023:", spring.rain_mm, "mm, rank", spring.rain_rank_driest, "(61 mm, rank 1)");
