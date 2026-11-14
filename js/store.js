// User choices shared by all screens (priorities, limits, field location and size), remembered on this device.
// location: null = the pilot field in /data; else { lat, lon, province } chosen on the map.

const KEY = "deepkore-prefs";
const DEFAULTS = { weights: { water: 70, soil: 70, income: 50, erosion: 60 }, mode: "rainfed", location: null, area_ha: 10 };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.weights) return { ...DEFAULTS, ...s, weights: { ...DEFAULTS.weights, ...s.weights } };
  } catch { /* storage blocked or empty */ }
  return { ...DEFAULTS, weights: { ...DEFAULTS.weights } };
}

let state = load();
const subs = new Set();

export const store = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch, weights: { ...state.weights, ...(patch.weights || {}) } };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* not remembered */ }
    subs.forEach((fn) => fn(state));
  },
  // Resets priorities and limits; keeps the field location and size.
  reset() {
    this.set({ mode: DEFAULTS.mode, weights: { ...DEFAULTS.weights } });
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
