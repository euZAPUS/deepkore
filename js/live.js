// Data for a field chosen on the map: computed in a Web Worker from NASA POWER, cached on this device.
// A cached result is used only if it was made by the same code (LIVE_VERSION) from the same rule files
// (inputs fingerprint) and has the same shape as the pilot data; otherwise it is recomputed.
import { VALIDATORS } from "./contract.js";

// Bump when the browser computation changes (worker, power_files, rotations_core, power_core).
export const LIVE_VERSION = "5";
const CACHE_PREFIX = "deepkore-live:";
const OLD_PREFIXES = ["deepkore-live-v1:", "deepkore-live-v2:"];
export const LIVE_FILES = ["parcel", "climate", "risk_windows", "validation", "rotations", "scenarios"];
// Files the worker reads besides NASA POWER: a change in any of them invalidates the cache.
const INPUTS = ["pipeline/config.json", "pipeline/thresholds.json", "pipeline/agro_rules.json", "pipeline/income_ecrea.json", "data/mock/rotations.json", "pipeline/rotation_catalog.json"];

// Two decimals (about 1 km): finer than the NASA POWER grid, so nothing is lost.
export const roundCoord = (v) => Math.round(Number(v) * 100) / 100;
const key = (loc) => `${CACHE_PREFIX}${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;

export function fieldName(loc) {
  return `Selected field${loc.province ? ` (${loc.province})` : ""}`;
}

// FNV-1a hash of the rule files, as hex. null if they cannot be read (offline): then no cache check by content.
let inputsHashPromise = null;
function inputsHash() {
  inputsHashPromise ??= Promise.all(
    INPUTS.map((p) => fetch(new URL(`../${p}`, import.meta.url), { cache: "no-cache" }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(p)))))
  ).then((texts) => {
    let h = 0x811c9dc5;
    for (const ch of texts.join("\u0000")) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }).catch(() => null);
  return inputsHashPromise;
}

// Same rotation ids and, per criterion, same kind of score (number / null) as the pilot data.
function shape(data) {
  return JSON.stringify((data?.rotations || []).map((r) => [r.id, Object.entries(r.scores || {}).map(([k, v]) => [k, typeof v]).sort()]));
}

function forgetOld() {
  try {
    Object.keys(localStorage).filter((k) => OLD_PREFIXES.some((p) => k.startsWith(p))).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked */ }
}

// base: the pilot data (/data), used to check the shape. Resolves with the cached data or null.
export async function loadCached(loc, base) {
  forgetOld();
  let s;
  try {
    s = JSON.parse(localStorage.getItem(key(loc)));
  } catch {
    return null;
  }
  if (!s || s.version !== LIVE_VERSION || !s.data || !LIVE_FILES.every((f) => s.data[f])) return null;
  const hash = await inputsHash();
  if (hash && s.inputs !== hash) return null;
  if (base?.rotations && shape(s.data) !== shape(base)) return null;
  const problems = LIVE_FILES.filter((f) => VALIDATORS[f](s.data[f]).length);
  return problems.length ? null : s.data;
}

function saveCached(loc, data, inputs) {
  try {
    // keep only the latest few fields
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX) && k !== key(loc));
    if (keys.length >= 4) keys.slice(0, keys.length - 3).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(key(loc), JSON.stringify({ version: LIVE_VERSION, inputs, saved: Date.now(), data }));
  } catch { /* storage full or blocked: data still shown, just not remembered */ }
}

let running = null;

// Resolves with { parcel, climate, risk_windows, validation, rotations, scenarios }.
// onProgress({ stage: "download" | "climate" | "scenarios", done, total }).
export async function analyse(loc, onProgress) {
  running?.terminate();
  const inputs = await inputsHash();
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL(`./live/worker.js?v=${LIVE_VERSION}`, import.meta.url), { type: "module" });
    } catch (err) {
      reject(new Error(`This browser cannot run the analysis (${err.message}).`));
      return;
    }
    running = worker;
    worker.onmessage = ({ data: msg }) => {
      if (msg.type === "progress") onProgress?.(msg);
      else {
        worker.terminate();
        if (running === worker) running = null;
        if (msg.type === "error") reject(new Error(msg.message));
        else {
          const problems = Object.fromEntries(LIVE_FILES.map((f) => [f, VALIDATORS[f](msg.data[f])]).filter(([, p]) => p.length));
          if (Object.keys(problems).length) {
            console.warn("DeepKore live data contract problems:", problems);
            reject(new Error("The computed data do not match the data contract (details in the console)."));
            return;
          }
          saveCached(loc, msg.data, inputs);
          resolve(msg.data);
        }
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      if (running === worker) running = null;
      reject(new Error(e.message || "Analysis failed"));
    };
    worker.postMessage({ v: LIVE_VERSION, lat: roundCoord(loc.lat), lon: roundCoord(loc.lon), name: fieldName(loc), eventName: `selected field${loc.province ? ` (${loc.province})` : ""}` });
  });
}

export function cancelAnalysis() {
  running?.terminate();
  running = null;
}
