// Loads /data/*.json (or /data/mock/*.json with ?mock in the URL) and checks them against the contract.
// A missing file is not an error: the screens that need it show "Waiting for NASA data".
import { DATA_FILES, OPTIONAL_FILES } from "./config.js";
import { VALIDATORS } from "./contract.js";

export const USING_MOCK = new URLSearchParams(location.search).has("mock");
const BASE = USING_MOCK ? "data/mock/" : "data/";

export async function loadAll() {
  const data = {};
  const problems = {};
  const missing = [];
  // The mock set has no optional files (e.g. validation): do not request them.
  const files = USING_MOCK ? DATA_FILES.filter((f) => !OPTIONAL_FILES.includes(f)) : DATA_FILES;
  await Promise.all(
    files.map(async (name) => {
      try {
        const res = await fetch(`${BASE}${name}.json`, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data[name] = await res.json();
      } catch {
        data[name] = null;
        missing.push(name);
        return;
      }
      const p = VALIDATORS[name](data[name]);
      if (p.length) problems[name] = p;
    })
  );
  return { data, problems, missing };
}

// File-level provenance (arrays: provenance of their first item).
export function fileProvenance(obj) {
  if (Array.isArray(obj)) return obj[0]?.provenance;
  return obj?.provenance;
}

export function isMock(provenance) {
  return JSON.stringify(provenance ?? "").toUpperCase().includes("MOCK");
}

export function anyMock(data) {
  return Object.values(data).some((d) => {
    if (!d) return false;
    if (Array.isArray(d)) return d.some((x) => isMock(x?.provenance));
    return isMock(d?.provenance);
  });
}
