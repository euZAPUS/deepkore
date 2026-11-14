// Loads /data/*.json and checks them against the contract.
import { DATA_FILES } from "./config.js";
import { VALIDATORS } from "./contract.js";

export async function loadAll() {
  const data = {};
  const problems = {};
  await Promise.all(
    DATA_FILES.map(async (name) => {
      const res = await fetch(`data/${name}.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`data/${name}.json: HTTP ${res.status}`);
      data[name] = await res.json();
      const p = VALIDATORS[name](data[name]);
      if (p.length) problems[name] = p;
    })
  );
  return { data, problems };
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
    if (Array.isArray(d)) return d.some((x) => isMock(x?.provenance));
    return isMock(d?.provenance);
  });
}
