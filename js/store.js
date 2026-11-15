// User choices shared by all screens (priorities, limits, field location and size, current rotation),
// remembered on this device.
// location: null = the pilot field in /data; else { lat, lon, province } chosen on the map.
// current_rotation: id of the rotation grown today ("What do you grow now?"). If that id is not in the
//   data on screen, the screens use the default (js/choice.js resolveCurrent); nothing is rewritten here.
// custom_rotations: rotations built by the user, [{ id: "custom-1".."custom-3", sequence: [crop, ...] }].

const KEY = "deepkore-prefs";
export const MAX_CUSTOM = 3;
const DEFAULTS = { weights: { water: 70, soil: 70, income: 50, erosion: 60 }, location: null, area_ha: 10, current_rotation: "current", custom_rotations: [] };

// Keeps only well-formed custom rotations (2-4 crop names, ids custom-1..custom-N, at most MAX_CUSTOM).
export function cleanCustom(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .filter((c) => c && typeof c.id === "string" && /^custom-\d+$/.test(c.id) && !seen.has(c.id) && seen.add(c.id)
      && Array.isArray(c.sequence) && c.sequence.length >= 2 && c.sequence.length <= 4 && c.sequence.every((x) => typeof x === "string" && x.length < 80))
    .slice(0, MAX_CUSTOM)
    .map((c) => ({ id: c.id, sequence: [...c.sequence] }));
}

// Older versions stored a water-supply "mode" (rainfed / irrigated); it is dropped: everything is rainfed.
function clean({ mode, ...s }) {
  return {
    ...DEFAULTS,
    ...s,
    weights: { ...DEFAULTS.weights, ...(s.weights || {}) },
    current_rotation: typeof s.current_rotation === "string" ? s.current_rotation : DEFAULTS.current_rotation,
    custom_rotations: cleanCustom(s.custom_rotations),
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === "object" && s.weights) return clean(s);
  } catch { /* storage blocked, empty or broken */ }
  return clean({});
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
  // Resets priorities; keeps the field location and size and the current rotation.
  reset() {
    this.set({ weights: { ...DEFAULTS.weights } });
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
