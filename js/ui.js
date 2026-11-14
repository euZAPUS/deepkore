// Small shared UI helpers.

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const PROV_TYPES = {
  observed: { cls: "observed", label: "Observed" },
  derived: { cls: "derived", label: "Derived" },
  "ai-inferred": { cls: "ai", label: "AI-inferred" },
  ai: { cls: "ai", label: "AI-inferred" },
  inferred: { cls: "ai", label: "AI-inferred" },
  simulated: { cls: "simulated", label: "Simulated" },
  synthetic: { cls: "simulated", label: "Simulated" },
  mock: { cls: "mock", label: "MOCK" },
};

// Accepts "Observed", "synthetic", "MOCK", or {type|label, dataset}.
export function normalizeProvenance(prov) {
  const raw = typeof prov === "object" && prov !== null ? prov.type ?? prov.label ?? "" : prov ?? "";
  const key = String(raw).trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (key.includes("mock")) return PROV_TYPES.mock;
  return PROV_TYPES[key] ?? { cls: "unknown", label: raw ? String(raw) : "Unlabelled" };
}

// Provenance badge + the NASA dataset backing the value.
export function provBadge(prov, dataset) {
  const p = normalizeProvenance(prov);
  const ds = dataset ?? (typeof prov === "object" && prov ? prov.dataset : undefined);
  return `<span class="prov prov--${p.cls}" title="Data provenance"><span class="prov__label">${esc(p.label)}</span>${
    ds ? `<span class="prov__dataset">${esc(ds)}</span>` : ""
  }</span>`;
}

export function icon(paths, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}
