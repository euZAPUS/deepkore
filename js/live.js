// Data for a field chosen on the map: computed in a Web Worker from NASA POWER, cached on this device.
import { VALIDATORS } from "./contract.js";

const CACHE_PREFIX = "deepkore-live-v1:";
export const LIVE_FILES = ["parcel", "climate", "risk_windows", "validation", "rotations", "scenarios"];

// Two decimals (about 1 km): finer than the NASA POWER grid, so nothing is lost.
export const roundCoord = (v) => Math.round(Number(v) * 100) / 100;
const key = (loc) => `${CACHE_PREFIX}${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;

export function fieldName(loc) {
  return `Selected field${loc.province ? ` (${loc.province})` : ""}`;
}

export function loadCached(loc) {
  try {
    const s = JSON.parse(localStorage.getItem(key(loc)));
    return s && s.data && LIVE_FILES.every((f) => s.data[f]) ? s.data : null;
  } catch {
    return null;
  }
}

function saveCached(loc, data) {
  try {
    // keep only the latest few fields
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length >= 4) keys.slice(0, keys.length - 3).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(key(loc), JSON.stringify({ saved: Date.now(), data }));
  } catch { /* storage full or blocked: data still shown, just not remembered */ }
}

let running = null;

// Resolves with { parcel, climate, risk_windows, validation, rotations, scenarios }.
// onProgress({ stage: "download" | "climate" | "scenarios", done, total }).
export function analyse(loc, onProgress) {
  running?.terminate();
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("./live/worker.js", import.meta.url), { type: "module" });
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
          saveCached(loc, msg.data);
          resolve(msg.data);
        }
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Analysis failed"));
    };
    worker.postMessage({ lat: roundCoord(loc.lat), lon: roundCoord(loc.lon), name: fieldName(loc), eventName: `selected field${loc.province ? ` (${loc.province})` : ""}` });
  });
}

export function cancelAnalysis() {
  running?.terminate();
  running = null;
}
