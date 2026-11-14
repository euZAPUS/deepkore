// User choices shared by all screens (priorities + limits), remembered on this device.

const KEY = "deepkore-prefs";
const DEFAULTS = { weights: { water: 70, soil: 70, income: 50, erosion: 60 }, mode: "rainfed" };

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
  reset() {
    this.set({ ...DEFAULTS, weights: { ...DEFAULTS.weights } });
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
