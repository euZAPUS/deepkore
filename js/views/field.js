// 01 My field: map (pick the field, set its size), priorities, limits, field totals and the live best match.
import { CRITERIA_META, PILOT_PIN } from "../config.js";
import { store } from "../store.js";
import { isScored, notScoredNote } from "../scoring.js";
import { currentTheme } from "../theme.js";
import { ANDALUCIA_PROVINCES, provinceAt } from "../andalucia.js";
import { roundCoord } from "../live.js";
import { currentOptions, resolveCurrent, compareSet } from "../choice.js";
import { BUILD_VALUE, MIN_CROPS, MAX_CROPS, canBuild, cropOptions, buildOne, nextCustomId, removeCustomPatch } from "../custom.js";
import { MAX_CUSTOM } from "../store.js";
import {
  esc, provBadge, datasetOf, viewHead, panelHead, sliderHTML, bindSliders, levelWord,
  segmentedHTML, bindSegmented, ringHTML, ecreaYearsText, setRing, displayName, rotationTag, selectHTML, icon, ICON,
} from "../ui.js";

// Field size steps (ha) for the slider.
const AREAS = [0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500];
const areaIndex = (ha) => AREAS.reduce((best, v, i) => (Math.abs(v - ha) < Math.abs(AREAS[best] - ha) ? i : best), 0);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const span = (ms) => (ms?.length ? `${MONTHS[ms[0] - 1]}–${MONTHS[ms.at(-1) - 1]}` : "");
// 1 mm of water on 1 ha = 10 m³
const m3 = (mm, ha) => Math.round((mm * 10 * ha) / 10) * 10;
const fmt = (v, d = 0) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const coordText = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;

// Base maps: Esri satellite imagery and OpenStreetMap; "osm" is the fallback if a provider fails.
const TILES = {
  satellite: () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  }),
  // OpenStreetMap standard tiles (free, no key); darkened with a CSS filter in dark mode.
  map: () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, className: "tiles-osm", attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }),
  osm: () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, className: "tiles-osm", attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }),
};

export function render(el, ctx) {
  const { parcel, rotations, climate } = ctx.data;
  const st = store.get();
  const lat = Number(parcel.lat);
  const lon = Number(parcel.lon);
  // The data on screen are for the chosen field only once its analysis is done.
  const custom = !!st.location && !ctx.usingMock && roundCoord(lat) === roundCoord(st.location.lat) && roundCoord(lon) === roundCoord(st.location.lon);
  // Draw the field where the user tapped (the data request is rounded to ~1 km; a NASA POWER cell is ~50 km);
  // the pilot field is drawn at PILOT_PIN (same NASA POWER cell as its data).
  const mapLat = custom && Number.isFinite(Number(st.location.lat)) ? Number(st.location.lat) : PILOT_PIN.lat;
  const mapLon = custom && Number.isFinite(Number(st.location.lon)) ? Number(st.location.lon) : PILOT_PIN.lon;
  const province = custom ? st.location.province : provinceAt(mapLat, mapLon);
  const canPick = !ctx.usingMock && typeof ctx.setLocation === "function";
  const building = canBuild(ctx.data, ctx.rules) && typeof ctx.refresh === "function";
  const customs = st.custom_rotations.filter((c) => rotations.some((r) => r.id === c.id));
  const growOptions = [
    ...currentOptions(rotations).map((r) => ({ value: r.id, label: displayName(r) })),
    ...(building ? [{ value: BUILD_VALUE, label: "Build your own…" }] : []),
  ];
  const crops = building ? cropOptions(ctx.rules) : [];
  const cropSelect = (i) => `<span class="pick pick--small"><select id="build-${i}" aria-label="Crop, year ${i + 1}">
    ${i >= MIN_CROPS ? '<option value="">— (none)</option>' : ""}
    ${crops.map((c) => `<option value="${esc(c)}"${i < MIN_CROPS && crops[i] === c ? " selected" : ""}>${esc(c)}</option>`).join("")}
  </select>${icon(ICON.chevron, 14)}</span>`;

  el.innerHTML = `
    ${viewHead("My field", "Pick your field on the map, set its size and what matters to you. DeepKore ranks the rotations for that place.")}
    <div class="view-body g-field">
      <section class="panel panel--map reveal" aria-label="Field map">
        <div id="map" class="map" role="application" aria-label="Map: tap inside Andalucía to move your field"></div>
        <div class="map-switch">
          ${segmentedHTML("map-mode", [{ value: "satellite", label: "Satellite" }, { value: "map", label: "Map" }], "satellite", "Map style")}
          ${canPick ? `<div class="map-tools">
            <button type="button" class="map-btn" id="fit-region" title="Show all of Andalucía">Andalucía</button>
            <button type="button" class="map-btn" id="locate" title="Use my location">My location</button>
          </div>` : ""}
        </div>
        <div class="map-card" id="map-card"></div>
      </section>

      <section class="panel reveal">
        ${panelHead("What do you grow now?")}
        <div class="grow-now" id="grow-now">
          ${selectHTML("current-rot", growOptions, resolveCurrent(rotations, st.current_rotation)?.id, "What do you grow now?")}
          ${building ? `<div class="build" id="build" hidden>
            <p class="small muted">Your crops in order, one per year (the rotation then repeats).</p>
            <div class="build__row">${Array.from({ length: MAX_CROPS }, (_, i) => cropSelect(i)).join("")}</div>
            <div class="build__actions"><button type="button" class="btn btn--small" id="build-add">Add</button>
              <span class="small muted">Missing your crop? New crops need verified data first.</span></div>
            <p class="note" id="build-msg" role="status" hidden></p>
          </div>` : ""}
          ${customs.length ? `<ul class="mine" aria-label="Your rotations">${customs.map((c) => {
            const r = rotations.find((x) => x.id === c.id);
            return `<li><span>${esc(displayName(r))}</span><button type="button" class="mine__del" data-id="${esc(c.id)}" aria-label="Delete ${esc(displayName(r))}" title="Delete">×</button></li>`;
          }).join("")}</ul>` : ""}
        </div>
        <p class="slider__hint">DeepKore compares this rotation with the alternatives in Compare rotations and What-if.</p>
      </section>

      <section class="panel reveal">
        ${panelHead("What matters most to you?", '<button class="btn-text" id="reset">Reset</button>')}
        <div class="sliders" id="weights">
          ${CRITERIA_META.map((c) => isScored(rotations, c.key)
            ? sliderHTML({ id: `w-${c.key}`, key: c.key, label: c.label, color: c.color, value: st.weights[c.key], output: `${levelWord(st.weights[c.key])} · ${st.weights[c.key]}` })
            : `<p class="note">${esc(notScoredNote(c.key, c.label, rotations))}</p>`
          ).join("")}
        </div>
      </section>

      <section class="panel best-panel reveal">
        <div class="best">
          ${ringHTML(92)}
          <div>
            <p class="best__label">Best match for you</p>
            <h3 id="best-name"></h3>
            <p class="best__sub" id="best-sub"></p>
          </div>
          <a class="btn" href="#/rotations">Compare rotations</a>
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("Field size", `<output class="area-out" id="area-out">${fmt(st.area_ha, st.area_ha < 1 ? 1 : 0)} ha</output>`)}
        <div class="slider" style="--c:var(--accent)">
          <input id="area" type="range" min="0" max="${AREAS.length - 1}" step="1" value="${areaIndex(st.area_ha)}" aria-label="Field size in hectares" aria-valuetext="${st.area_ha} hectares">
          <p class="slider__hint">Turns per-hectare results into totals for your field. It does not change the risks or the ranking.</p>
        </div>
      </section>

      <section class="panel totals reveal">
        ${panelHead("Your field in numbers", provBadge(climate?.provenance ?? parcel.provenance, "NASA POWER"))}
        <div id="totals"></div>
      </section>


    </div>
  `;

  /* ---- map card ---- */
  const card = el.querySelector("#map-card");
  let pending = null; // { lat, lon, province } picked but not analysed yet
  const renderCard = (msg) => {
    if (pending) {
      card.innerHTML = `<strong>New field location</strong>
        <span>${coordText(pending.lat, pending.lon)} · ${esc(pending.province)}</span>
        <div class="map-card__actions">
          <button type="button" class="btn btn--small" id="analyse">Analyse this field</button>
          <button type="button" class="btn-text" id="pick-cancel">Cancel</button>
        </div>
        <span class="small">Downloads 25 years of NASA POWER data for this point (usually 5-20 s).</span>`;
      card.querySelector("#analyse").addEventListener("click", () => {
        const loc = pending;
        pending = null;
        ctx.setLocation(loc);
        renderCard();
      });
      card.querySelector("#pick-cancel").addEventListener("click", () => { pending = null; showPending(); renderCard(); });
      return;
    }
    card.innerHTML = `<strong>${esc(parcel.name)}</strong>
      <span>${coordText(mapLat, mapLon)}${province ? ` · ${esc(province)}` : ""}${custom ? "" : " · approx. location"}</span>
      <div class="chips"><span class="chip">Data ${esc(parcel.period)}</span>${provBadge(parcel.provenance, datasetOf(parcel))}</div>
      ${msg ? `<p class="map-card__msg">${esc(msg)}</p>` : canPick ? '<span class="small">Tap the map to move your field.</span>' : ""}
      ${custom ? `<div class="map-card__actions">
        <button type="button" class="btn-text" id="to-pilot">Back to the pilot field</button>
        <button type="button" class="btn-text" id="refresh">Refresh data</button></div>` : ""}`;
    card.querySelector("#to-pilot")?.addEventListener("click", () => ctx.setLocation(null));
    card.querySelector("#refresh")?.addEventListener("click", () => ctx.setLocation(st.location, { refresh: true }));
  };
  renderCard();

  /* ---- map ---- */
  let map = null;
  let layer = null;
  let mode = "satellite";
  let fellBack = false;
  let fieldCircle = null;
  let pendingMarker = null;
  const radius = (ha) => Math.sqrt((ha * 10000) / Math.PI);
  const setLayer = (name) => {
    if (!map) return;
    if (layer) map.removeLayer(layer);
    layer = TILES[name]().addTo(map);
    layer.bringToBack();
    let errors = 0;
    layer.on("tileerror", () => {
      if (++errors === 4 && !fellBack && name !== "osm") { fellBack = true; setLayer("osm"); }
    });
  };
  const showPending = () => {
    if (!map) return;
    pendingMarker?.remove();
    pendingMarker = pending
      ? L.circleMarker([pending.lat, pending.lon], { radius: 8, color: "#fff", weight: 2.5, fillColor: "#ff9f0a", fillOpacity: 1 }).addTo(map)
      : null;
  };
  if (window.L && Number.isFinite(lat) && Number.isFinite(lon)) {
    map = L.map(el.querySelector("#map"), { center: [mapLat, mapLon], zoom: 14, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false });
    setLayer(mode);
    const green = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#248a3d";
    const region = L.featureGroup(ANDALUCIA_PROVINCES.map((p) =>
      L.polygon(p.ring.map(([x, y]) => [y, x]), { color: "#ffffff", weight: 1.2, opacity: 0.7, fill: false, interactive: false, dashArray: "4 4" })
    )).addTo(map);
    fieldCircle = L.circle([mapLat, mapLon], { radius: radius(st.area_ha), color: "#ffffff", weight: 2.5, fillColor: green, fillOpacity: 0.22, interactive: false }).addTo(map);
    L.circleMarker([mapLat, mapLon], { radius: 6, color: "#fff", weight: 2, fillColor: green, fillOpacity: 1, interactive: false }).addTo(map);
    if (canPick) {
      const pick = (plat, plon) => {
        const prov = provinceAt(plat, plon);
        if (!prov) {
          pending = null;
          showPending();
          renderCard("That point is outside Andalucía. DeepKore's crop calendars are written for rainfed farming in Andalucía.");
          return;
        }
        const r5 = (v) => Math.round(v * 1e5) / 1e5;
        pending = { lat: r5(plat), lon: r5(plon), province: prov };
        showPending();
        renderCard();
      };
      map.on("click", (e) => pick(e.latlng.lat, e.latlng.lng));
      el.querySelector("#fit-region").addEventListener("click", () => map.fitBounds(region.getBounds(), { padding: [10, 10] }));
      const locBtn = el.querySelector("#locate");
      if (!navigator.geolocation) locBtn.hidden = true;
      locBtn.addEventListener("click", () => {
        locBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          (p) => {
            locBtn.disabled = false;
            map.setView([p.coords.latitude, p.coords.longitude], 14);
            pick(p.coords.latitude, p.coords.longitude);
          },
          () => { locBtn.disabled = false; renderCard("Your location is not available. Tap the map instead."); },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
      });
    }
    // keep tiles in sync with panel size (grid / sidebar changes)
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.querySelector("#map"));
    map.on("unload", () => ro.disconnect());
  }
  bindSegmented(el.querySelector("#map-mode"), (v) => { mode = v; fellBack = false; setLayer(v); });
  const onTheme = () => { if (mode === "map") setLayer("map"); };
  document.addEventListener("deepkore:theme", onTheme);

  /* ---- field totals ---- */
  const totalsEl = el.querySelector("#totals");
  let current = resolveCurrent(rotations, st.current_rotation);
  const renderTotals = () => {
    const ha = store.get().area_ha;
    const set = compareSet(rotations, store.get().weights, current.id);
    const best = set.currentIsBest ? current : set.best.rotation;
    const yearRain = climate ? climate.monthly.precip_mm.reduce((s, v) => s + v, 0) : null;
    const water = (r) => (r?.water_balance || []).map((w) => `<li><b>${esc(w.crop)}</b> <span class="muted">${span(w.months)}</span>
        <span>${w.need_mm === null ? "water need not computed (no FAO-56 Kc)" : `needs ≈ ${fmt(m3(w.need_mm, ha))} m³ · rain ≈ ${fmt(m3(w.rain_mm, ha))} m³`}</span></li>`).join("");
    const income = (r) => {
      const inc = r?.income;
      if (!inc) return "";
      if (inc.eur_ha_year === null)
        return `<span class="muted">no verified net margin for ${esc(inc.missing.join(", "))}</span>`;
      return `≈ <b>${fmt(inc.eur_ha_year * ha)} €</b> per year <span class="muted">(${fmt(inc.eur_ha_year, 1)} €/ha${
        inc.missing?.length ? `; ${esc(inc.missing.join(", "))} counted as 0 €/ha, no verified value` : ""})</span>`;
    };
    totalsEl.innerHTML = `
      <dl class="kv">
        ${yearRain !== null ? `<div><dt>Rain on your field</dt><dd>≈ <b>${fmt(m3(yearRain, ha))} m³</b> per year <span class="muted">(${fmt(yearRain)} mm, mean ${esc(parcel.period)})</span></dd></div>` : ""}
        <div><dt>Net margin without decoupled CAP payments (coupled aid included), your current rotation (${esc(displayName(current))})</dt><dd>${income(current)}</dd></div>
        ${best.id !== current.id ? `<div><dt>Net margin without decoupled CAP payments (coupled aid included), best match (${esc(displayName(best))})</dt><dd>${income(best)}</dd></div>` : ""}
      </dl>
      <h3 class="totals__sub">Water in the growing months, your current rotation</h3>
      <ul class="wb-list">${water(current)}</ul>
      <p class="small muted">Water need = Kc × ET0 (FAO-56) over the growing months, rainfed, no soil storage. Net margin = what is left from the harvest after seed, fertiliser, fuel, machinery, hired work and depreciation, <b>without decoupled CAP payments (coupled aid included)</b>. Regional average for rainfed farms in Andalucía from the Spanish Ministry of Agriculture (${esc(ecreaYearsText(rotations.map((r) => r.income)) || "ECREA")}), not your farm's accounts. It is the base of the income score. 1 mm on 1 ha = 10 m³.</p>`;
  };

  /* ---- best match ---- */
  const ring = el.querySelector(".best .ring");
  const updateBest = () => {
    const set = compareSet(rotations, store.get().weights, current.id);
    const top = set.currentIsBest ? set.shown.find((x) => x.isCurrent) : set.best;
    el.querySelector("#best-name").textContent = displayName(top.rotation);
    el.querySelector("#best-sub").innerHTML = `${esc(set.currentIsBest ? "Your current rotation already ranks first for your priorities" : rotationTag(top.rotation, current.id))} · match score /100 · ${provBadge(top.rotation.provenance, datasetOf(top.rotation))}`;
    setRing(ring, top.total);
    renderTotals();
  };
  requestAnimationFrame(updateBest);

  /* ---- controls ---- */
  const areaInput = el.querySelector("#area");
  const areaOut = el.querySelector("#area-out");
  const setAreaFill = () => areaInput.style.setProperty("--fill", `${(areaInput.value / (AREAS.length - 1)) * 100}%`);
  setAreaFill();
  areaInput.addEventListener("input", () => {
    const ha = AREAS[Number(areaInput.value)];
    store.set({ area_ha: ha });
    areaOut.textContent = `${fmt(ha, ha < 1 ? 1 : 0)} ha`;
    areaInput.setAttribute("aria-valuetext", `${ha} hectares`);
    setAreaFill();
    fieldCircle?.setRadius(radius(ha));
    renderTotals();
  });

  bindSliders(el.querySelector("#weights"), (k, v) => `${levelWord(v)} · ${v}`, (key, v) => {
    store.set({ weights: { [key]: v } });
    updateBest();
  });
  el.querySelector("#reset").addEventListener("click", () => {
    store.reset();
    const w = store.get().weights;
    el.querySelectorAll("#weights input").forEach((i) => {
      i.value = w[i.dataset.key];
      i.dispatchEvent(new Event("input"));
    });
  });
  const buildBox = el.querySelector("#build");
  el.querySelector("#current-rot").addEventListener("change", (e) => {
    if (e.target.value === BUILD_VALUE) {
      buildBox.hidden = false;
      buildBox.querySelector("select")?.focus();
      return;
    }
    if (buildBox) buildBox.hidden = true;
    store.set({ current_rotation: e.target.value });
    current = resolveCurrent(rotations, e.target.value);
    updateBest();
  });
  const say = (msg) => {
    const m = el.querySelector("#build-msg");
    m.textContent = msg;
    m.hidden = !msg;
  };
  el.querySelector("#build-add")?.addEventListener("click", () => {
    const sequence = Array.from({ length: MAX_CROPS }, (_, i) => el.querySelector(`#build-${i}`).value).filter(Boolean);
    const mine = store.get().custom_rotations;
    const same = mine.find((c) => c.sequence.join("|") === sequence.join("|"));
    if (same) {
      store.set({ current_rotation: same.id });
      ctx.refresh();
      return;
    }
    const id = nextCustomId(mine, MAX_CUSTOM);
    if (!id) return say(`You can keep up to ${MAX_CUSTOM} rotations of your own. Delete one first.`);
    try {
      buildOne(ctx.data, ctx.rules, { id, sequence });
    } catch (err) {
      return say(err.message);
    }
    store.set({ custom_rotations: [...mine, { id, sequence }], current_rotation: id });
    ctx.refresh();
  });
  el.querySelectorAll(".mine__del").forEach((b) => b.addEventListener("click", () => {
    store.set(removeCustomPatch(store.get(), b.dataset.id));
    ctx.refresh();
  }));

  return () => {
    document.removeEventListener("deepkore:theme", onTheme);
    map?.remove();
  };
}
