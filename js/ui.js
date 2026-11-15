// Shared UI helpers and small components.

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- provenance ---------- */
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
  return `<span class="prov prov--${p.cls}" title="Where this comes from"><span class="prov__label">${esc(p.label)}</span>${
    ds ? `<span class="prov__dataset">${esc(ds)}</span>` : ""
  }</span>`;
}

// Short dataset label for a data file: its own `dataset`, else the short names of parcel-style `sources`.
export function datasetOf(obj) {
  if (obj?.dataset) return obj.dataset;
  const names = (obj?.sources || []).map((s) => s.short ?? (s.id === "nasa-power" ? "NASA POWER" : s.dataset)).filter(Boolean);
  return names.length ? [...new Set(names)].join(" · ") : undefined;
}

export function icon(paths, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" class="ico">${paths}</svg>`;
}

export const ICON = {
  frost: '<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 3.5l3 2 3-2M9 20.5l3-2 3 2"/>',
  heat: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  rain: '<path d="M7 15a4 4 0 1 1 .9-7.9A6 6 0 0 1 19 9a4 4 0 0 1-1 6"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
  soil: '<path d="M3 10h18M3 15h18M3 20h18"/><path d="M12 10c0-3 1.5-5 4.5-5.5C16 7.5 14.5 9.5 12 10zM12 10c0-2.5-1.3-4-3.8-4.5.4 2.5 1.7 4 3.8 4.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  gap: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  warn: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
};

/* ---------- view scaffolding ---------- */
export function viewHead(title, sub = "", actions = "") {
  return `<header class="view-head">
    <div><h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>
    ${actions ? `<div class="view-head__actions">${actions}</div>` : ""}
  </header>`;
}

export function panelHead(title, right = "") {
  return `<div class="panel__head"><h2 class="panel__title">${title}</h2>${right ? `<div>${right}</div>` : ""}</div>`;
}

/* ---------- slider ---------- */
export function levelWord(v) {
  if (v <= 0) return "Not important";
  if (v < 35) return "Low";
  if (v < 70) return "Medium";
  if (v < 95) return "High";
  return "Top";
}

export function sliderHTML({ id, key, label, hint = "", value, min = 0, max = 100, step = 5, color, output }) {
  const fill = ((value - min) / (max - min)) * 100;
  return `<div class="slider" style="--c:${color}">
    <div class="slider__top">
      <label for="${id}">${esc(label)}</label>
      <output for="${id}" id="${id}-out">${esc(output)}</output>
    </div>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}" style="--fill:${fill}%">
    ${hint ? `<p class="slider__hint">${esc(hint)}</p>` : ""}
  </div>`;
}

// Keeps the coloured fill in sync and reports (key, value) on every move.
export function bindSliders(root, format, onInput) {
  root.querySelectorAll('.slider input[type="range"]').forEach((input) => {
    const update = () => {
      const v = Number(input.value);
      const fill = ((v - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
      input.style.setProperty("--fill", `${fill}%`);
      root.querySelector(`#${input.id}-out`).textContent = format(input.dataset.key, v);
      onInput(input.dataset.key, v);
    };
    input.addEventListener("input", update);
  });
}

/* ---------- segmented control (iOS style) ---------- */
export function segmentedHTML(id, options, value, label) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return `<div class="segmented" id="${id}" role="radiogroup" aria-label="${esc(label)}" style="--n:${options.length};--i:${i}">
    <span class="segmented__thumb" aria-hidden="true"></span>
    ${options
      .map((o, k) => `<button type="button" role="radio" aria-checked="${k === i}" data-value="${esc(o.value)}">${esc(o.label)}</button>`)
      .join("")}
  </div>`;
}

export function bindSegmented(el, onChange) {
  const buttons = [...el.querySelectorAll("button")];
  buttons.forEach((b, k) =>
    b.addEventListener("click", () => {
      el.style.setProperty("--i", k);
      buttons.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      onChange(b.dataset.value);
    })
  );
}

/* ---------- score ring + counting numbers ---------- */
const RING_C = 2 * Math.PI * 26;

export function ringHTML(size = 72) {
  return `<div class="ring" style="--size:${size}px">
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ring__track" cx="32" cy="32" r="26"/><circle class="ring__val" cx="32" cy="32" r="26" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
    <span class="ring__num">0</span>
  </div>`;
}

export function setRing(ringEl, value) {
  ringEl.querySelector(".ring__val").style.strokeDashoffset = RING_C * (1 - Math.max(0, Math.min(100, value)) / 100);
  animateNumber(ringEl.querySelector(".ring__num"), value);
}

export function animateNumber(el, to, decimals = 0, ms = 700) {
  // A new call cancels the previous animation of this element (fast slider moves used to leave a stale number).
  const token = (el._numAnim = (el._numAnim || 0) + 1);
  const from = parseFloat(el.textContent) || 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) {
    el.textContent = to.toFixed(decimals);
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    if (el._numAnim !== token) return;
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = (from + (to - from) * e).toFixed(decimals);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- rotations helpers ---------- */
// Without the "A:" / "Current:" prefix; " - " between crops shown as an en dash, as in the rest of the app.
export function displayName(rotation) {
  return String(rotation.name ?? rotation.id).replace(/^\s*(current|[A-Z])\s*:\s*/i, "").replace(/ - /g, " – ");
}

// currentId: the rotation the user grows today (store.current_rotation resolved by js/choice.js).
export function rotationTag(rotation, currentId = "current") {
  if (rotation.id === currentId) return "Your current rotation";
  if (rotation.custom) return "Your rotation";
  return /^[A-Z]$/.test(rotation.id) ? `Option ${rotation.id}` : "Alternative";
}

// "0 €/ha or less = 0, 623 €/ha = 100" from pipeline/income_ecrea.json score_scale (rules: js/custom.js loadRules).
export function incomeScaleText(rules) {
  const sc = rules?.INCOME?.score_scale;
  if (!sc) return "linear scale from pipeline/income_ecrea.json";
  return `${Math.round(sc.zero_eur_ha)} €/ha or less = 0, ${Math.round(sc.full_eur_ha).toLocaleString("en-US")} €/ha = 100`;
}

/* ---------- compact select (same look as the segmented control) ---------- */
// options: [{ value, label }]
export function selectHTML(id, options, value, label) {
  return `<span class="pick"><select id="${id}" aria-label="${esc(label)}">${options
    .map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`)
    .join("")}</select>${icon(ICON.chevron, 16)}</span>`;
}

export function sequenceHTML(seq = []) {
  return `<div class="seq">${seq
    .map((c, i) => `<span class="seq__crop">${esc(c)}</span>${i < seq.length - 1 ? '<span class="seq__sep">›</span>' : ""}`)
    .join("")}<span class="seq__loop" title="Then repeats">↺</span></div>`;
}
