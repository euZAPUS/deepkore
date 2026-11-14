// Web Worker: builds every data file for a field chosen on the map, in the browser.
// Downloads NASA POWER for (lat, lon) and runs the same code as the pipeline
// (pipeline/lib/power_files.mjs + rotations_core.mjs; tools/check_live_core.mjs checks they match).
// Modules are loaded with the app's version in the URL, so a browser never mixes old cached code with new data.
const V = new URL(import.meta.url).searchParams.get("v") || "0";
const modules = Promise.all([
  import(new URL(`../../pipeline/lib/power_files.mjs?v=${V}`, import.meta.url)),
  import(new URL(`../../pipeline/lib/rotations_core.mjs?v=${V}`, import.meta.url)),
]);

const BASE = new URL("../../", import.meta.url);
const getJson = async (path) => {
  const res = await fetch(new URL(path, BASE), { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};
const progress = (stage, done, total) => self.postMessage({ type: "progress", stage, done, total });

self.onmessage = async ({ data: { lat, lon, name, eventName } }) => {
  try {
    const [{ downloadPower, buildPowerFiles }, r] = await modules;
    const [CFG, TH, RULES, INCOME, mockTexts, CATALOG] = await Promise.all(
      ["pipeline/config.json", "pipeline/thresholds.json", "pipeline/agro_rules.json", "pipeline/income_ecrea.json", "data/mock/rotations.json", "pipeline/rotation_catalog.json"].map(getJson)
    );
    const texts = r.rotationTexts(mockTexts, CATALOG);
    const today = new Date().toISOString().slice(0, 10);
    const period = `${CFG.first_year}-${CFG.last_full_year}`;
    progress("download", 0, 1);
    const raw = await downloadPower(lat, lon, CFG.first_year, today, (d, n) => progress("download", d, n));
    progress("climate", 0, 1);
    const cfg = { ...CFG, name, lat, lon };
    const files = buildPowerFiles({ raw, cfg, TH, today, eventName });
    const { rotations, bare } = r.buildRotations({ texts, monthly: files.climate.monthly, weeks: files.risk_windows.weeks, RULES, TH, INCOME, period, today });
    files.risk_windows = { ...files.risk_windows, ...r.bareMonthsKeys(bare) };
    const scenarios = r.buildScenarios({
      days: files.days, lat, elev: files.meta.elevation_m, y0: CFG.first_year, y1: CFG.last_full_year, TH, RULES, INCOME, texts, period,
      onProgress: (d, n) => progress("scenarios", d, n),
    });
    r.checkZeroScenario(scenarios, rotations);
    self.postMessage({
      type: "done",
      data: { parcel: files.parcel, climate: files.climate, risk_windows: files.risk_windows, validation: files.validation, rotations, scenarios },
    });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err?.message || err) });
  }
};
