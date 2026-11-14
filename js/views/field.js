// 01 My field: one screen with map, priorities, limits and the live best match.
import { CRITERIA_META } from "../config.js";
import { store } from "../store.js";
import { rankRotations } from "../scoring.js";
import { currentTheme } from "../theme.js";
import {
  esc, provBadge, viewHead, panelHead, sliderHTML, bindSliders, levelWord,
  segmentedHTML, bindSegmented, ringHTML, setRing, displayName, rotationTag,
} from "../ui.js";

const MODES = [
  { value: "rainfed", label: "Rainfed" },
  { value: "irrigated", label: "Irrigated" },
];

// Base maps. "map" uses OpenStreetMap data (CARTO style); "osm" is the fallback if a provider fails.
const TILES = {
  satellite: () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  }),
  map: () => L.tileLayer(`https://{s}.basemaps.cartocdn.com/${currentTheme() === "dark" ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}{r}.png`, {
    subdomains: "abcd", maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © CARTO',
  }),
  osm: () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }),
};

export function render(el, ctx) {
  const { parcel, rotations } = ctx.data;
  const st = store.get();
  const lat = Number(parcel.lat);
  const lon = Number(parcel.lon);

  el.innerHTML = `
    ${viewHead("My field", "Set what matters to you. DeepKore ranks the rotations for this field.")}
    <div class="view-body g-field">
      <section class="panel panel--map reveal" aria-label="Field map">
        <div id="map" class="map" role="img" aria-label="Map of the pilot field near Antequera"></div>
        <div class="map-switch">${segmentedHTML("map-mode", [{ value: "satellite", label: "Satellite" }, { value: "map", label: "Map" }], "satellite", "Map style")}</div>
        <div class="map-card">
          <strong>${esc(parcel.name)}</strong>
          <span>${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"} · Antequera, Málaga · approx. location</span>
          <div class="chips"><span class="chip">Data ${esc(parcel.period)}</span>${provBadge(parcel.provenance)}</div>
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("What matters most to you?", '<button class="btn-text" id="reset">Reset</button>')}
        <div class="sliders" id="weights">
          ${CRITERIA_META.map((c) =>
            sliderHTML({ id: `w-${c.key}`, key: c.key, label: c.label, color: c.color, value: st.weights[c.key], output: `${levelWord(st.weights[c.key])} · ${st.weights[c.key]}` })
          ).join("")}
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("Water supply", segmentedHTML("mode", MODES, st.mode, "Water supply"))}
        <p class="note" id="mode-note" ${st.mode === "irrigated" ? "" : "hidden"}>Irrigated fields are not modelled yet. Results still assume rainfed conditions.</p>
      </section>

      <section class="panel best-panel reveal">
        <div class="best">
          ${ringHTML(92)}
          <div>
            <p class="best__label">Best match for you</p>
            <h3 id="best-name"></h3>
            <p class="best__sub" id="best-sub"></p>
          </div>
          <a class="btn" href="#/rotations">Compare all 4 rotations</a>
        </div>
      </section>
    </div>
  `;

  /* ---- map ---- */
  let map = null;
  let layer = null;
  let mode = "satellite";
  let fellBack = false;
  const setLayer = (name) => {
    if (!map) return;
    if (layer) map.removeLayer(layer);
    layer = TILES[name]().addTo(map);
    let errors = 0;
    layer.on("tileerror", () => {
      if (++errors === 4 && !fellBack && name !== "osm") { fellBack = true; setLayer("osm"); }
    });
  };
  if (window.L && Number.isFinite(lat) && Number.isFinite(lon)) {
    map = L.map(el.querySelector("#map"), { center: [lat, lon], zoom: 15, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false });
    setLayer(mode);
    const green = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#248a3d";
    L.circle([lat, lon], { radius: 260, color: "#ffffff", weight: 2.5, fillColor: green, fillOpacity: 0.22 }).addTo(map);
    L.circleMarker([lat, lon], { radius: 6, color: "#fff", weight: 2, fillColor: green, fillOpacity: 1 }).addTo(map);
    // keep tiles in sync with panel size (grid / sidebar changes)
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.querySelector("#map"));
    map.on("unload", () => ro.disconnect());
  }
  bindSegmented(el.querySelector("#map-mode"), (v) => { mode = v; fellBack = false; setLayer(v); });
  const onTheme = () => { if (mode === "map") setLayer("map"); };
  document.addEventListener("deepkore:theme", onTheme);

  /* ---- best match ---- */
  const ring = el.querySelector(".best .ring");
  const updateBest = () => {
    const top = rankRotations(rotations, store.get().weights)[0];
    el.querySelector("#best-name").textContent = displayName(top.rotation);
    el.querySelector("#best-sub").innerHTML = `${esc(rotationTag(top.rotation))} · match score /100 · ${provBadge(top.rotation.provenance)}`;
    setRing(ring, top.total);
  };
  requestAnimationFrame(updateBest);

  /* ---- controls ---- */
  bindSliders(el.querySelector("#weights"), (k, v) => `${levelWord(v)} · ${v}`, (key, v) => {
    store.set({ weights: { [key]: v } });
    updateBest();
  });
  el.querySelector("#reset").addEventListener("click", () => {
    store.reset();
    el.querySelector('#mode button[data-value="rainfed"]').click();
    const w = store.get().weights;
    el.querySelectorAll("#weights input").forEach((i) => {
      i.value = w[i.dataset.key];
      i.dispatchEvent(new Event("input"));
    });
  });
  bindSegmented(el.querySelector("#mode"), (m) => {
    store.set({ mode: m });
    el.querySelector("#mode-note").hidden = m !== "irrigated";
  });

  return () => {
    document.removeEventListener("deepkore:theme", onTheme);
    map?.remove();
  };
}
