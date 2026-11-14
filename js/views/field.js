// 01 My field: map, priorities, limits, and a live "best match" preview.
import { CRITERIA_META } from "../config.js";
import { store } from "../store.js";
import { rankRotations } from "../scoring.js";
import {
  esc, provBadge, heroHTML, nextHTML, blockHead, sliderHTML, bindSliders, levelWord,
  segmentedHTML, bindSegmented, ringHTML, setRing, displayName, rotationTag, sequenceHTML,
} from "../ui.js";

const MODES = [
  { value: "rainfed", label: "Rainfed" },
  { value: "irrigated", label: "Irrigated" },
];

export function render(el, ctx) {
  const { parcel, rotations } = ctx.data;
  const st = store.get();
  const lat = Number(parcel.lat);
  const lon = Number(parcel.lon);

  el.innerHTML = `
    ${heroHTML(ctx, "Tell DeepKore where your field is and what matters most to you. Everything else adapts to it.")}

    <section class="reveal">
      <div class="map-wrap">
        <div id="map" class="map" role="img" aria-label="Map of the pilot field near Antequera"></div>
        <div class="map-card">
          <strong>${esc(parcel.name)}</strong>
          <span>${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"} · Antequera, Málaga</span>
          <div class="chips"><span class="chip">Data ${esc(parcel.period)}</span>${provBadge(parcel.provenance)}</div>
        </div>
      </div>
      <p class="caption">Approximate location. The exact field boundary is not drawn yet.</p>
    </section>

    <section class="block">
      ${blockHead("What matters most to you?", "Move the sliders. The rotations are ranked with these weights.")}
      <div class="sliders reveal" id="weights">
        ${CRITERIA_META.map((c) =>
          sliderHTML({
            id: `w-${c.key}`, key: c.key, label: c.label, hint: c.hint, color: c.color,
            value: st.weights[c.key], output: `${levelWord(st.weights[c.key])} · ${st.weights[c.key]}`,
          })
        ).join("")}
      </div>
      <div class="center reveal" style="margin-top:22px"><button class="btn-text" id="reset">Reset to default</button></div>
    </section>

    <section class="block">
      ${blockHead("Your limits", "Is the field rainfed or irrigated?")}
      <div class="center reveal">${segmentedHTML("mode", MODES, st.mode, "Water supply")}</div>
      <p class="note" id="mode-note" ${st.mode === "irrigated" ? "" : "hidden"}>Irrigated fields are not modelled yet. Results still assume rainfed conditions.</p>
    </section>

    <section class="block">
      <div class="best reveal">
        <p class="best__label">Best match for your priorities</p>
        <h3 id="best-name"></h3>
        <div id="best-seq"></div>
        ${ringHTML(120)}
        <p class="best__sub" id="best-sub"></p>
        <a class="btn" href="#/rotations">Compare all rotations</a>
      </div>
    </section>

    ${nextHTML(ctx.next)}
  `;

  /* ---- map ---- */
  let map = null;
  if (window.L && Number.isFinite(lat) && Number.isFinite(lon)) {
    map = L.map(el.querySelector("#map"), {
      center: [lat, lon], zoom: 14, scrollWheelZoom: false, attributionControl: true,
      dragging: !L.Browser.mobile, tap: false, zoomControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const green = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#248a3d";
    L.circle([lat, lon], { radius: 260, color: green, weight: 2, fillColor: green, fillOpacity: 0.18 }).addTo(map);
    L.circleMarker([lat, lon], { radius: 6, color: "#fff", weight: 2, fillColor: green, fillOpacity: 1 }).addTo(map);
  }

  /* ---- best match ---- */
  const ring = el.querySelector(".best .ring");
  const updateBest = () => {
    const ranked = rankRotations(rotations, store.get().weights);
    const top = ranked[0];
    el.querySelector("#best-name").textContent = displayName(top.rotation);
    el.querySelector("#best-seq").innerHTML = sequenceHTML(top.rotation.sequence);
    el.querySelector("#best-sub").innerHTML = `${esc(rotationTag(top.rotation))} · match score out of 100 · ${provBadge(top.rotation.provenance)}`;
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
  bindSegmented(el.querySelector("#mode"), (mode) => {
    store.set({ mode });
    el.querySelector("#mode-note").hidden = mode !== "irrigated";
  });

  return () => map?.remove();
}
