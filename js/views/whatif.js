// 04 What-if simulator: rain / temperature sliders pick the nearest pre-computed scenario.
import { nearestScenario } from "../scoring.js";
import { store } from "../store.js";
import { resolveCurrent, compareSet, scenarioTotals } from "../choice.js";
import { flipReorder } from "../motion.js";
import { esc, provBadge, datasetOf, viewHead, panelHead, sliderHTML, bindSliders, animateNumber, displayName, rotationTag, icon, ICON } from "../ui.js";

const PRESETS = [
  { label: "Today's climate", rain: 0, temp: 0 },
  { label: "Drier", rain: -20, temp: 0 },
  { label: "Hotter", rain: 0, temp: 2 },
  { label: "Hot and dry", rain: -40, temp: 3 },
];

const signed = (v, unit) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}${unit}`;

function gridSteps(values) {
  const u = [...new Set(values)].sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < u.length; i++) step = Math.min(step, u[i] - u[i - 1]);
  return { min: u[0], max: u.at(-1), step: Number.isFinite(step) ? step : 1 };
}

export function render(el, ctx) {
  const { scenarios, rotations } = ctx.data;
  const byId = Object.fromEntries(rotations.map((r) => [r.id, r]));
  const rain = gridSteps(scenarios.map((s) => s.rain_pct));
  const temp = gridSteps(scenarios.map((s) => s.temp_delta));
  const base = nearestScenario(scenarios, 0, 0);
  // Same rotations as Compare rotations: your current one + the 3 best alternatives for your priorities today.
  // Scenario totals = your priorities x the criteria recomputed for that climate (at 0 %, +0 °C = Compare rotations).
  const weights = store.get().weights;
  const current = resolveCurrent(rotations, store.get().current_rotation);
  const ids = compareSet(rotations, weights, current.id).shown.map((x) => x.rotation.id);
  const totalsOf = (s) => scenarioTotals(s, ids, weights, rotations);
  const baseTotals = totalsOf(base);
  const baseRank = Object.fromEntries(baseTotals.map((x, i) => [x.id, i]));
  let cur = { rain: 0, temp: 0 };

  el.innerHTML = `
    ${viewHead("What-if simulator", "What if it rains less or gets hotter? See how the scores react.", '<span class="pill pill--sim">Simulated scenario</span>')}
    <div class="view-body g-sim">
      <section class="panel reveal" id="controls">
        ${panelHead("Change the climate")}
        <div class="sliders">
          ${sliderHTML({ id: "s-rain", key: "rain", label: "Rain", hint: "Change in yearly rainfall", color: "var(--c-water)", value: 0, ...rain, output: signed(0, " %") })}
          ${sliderHTML({ id: "s-temp", key: "temp", label: "Temperature", hint: "Warmer than today. Watch the very hot days: the ranking moves only a little", color: "var(--h-heat)", value: 0, ...temp, output: signed(0, " °C") })}
        </div>
        <div class="presets">${PRESETS.map((p, i) => `<button class="preset${i === 0 ? " is-on" : ""}" data-i="${i}">${esc(p.label)}</button>`).join("")}</div>
        <div class="sim-stats">
          <div class="sim-stat"><div class="sim-stat__label">${icon(ICON.frost, 14)} Frost days / year</div><div class="sim-stat__num" id="st-frost">${esc(base.frost_days)}</div><div class="sim-stat__delta" id="dt-frost">same as today</div></div>
          <div class="sim-stat"><div class="sim-stat__label">${icon(ICON.heat, 14)} Very hot days / year</div><div class="sim-stat__num" id="st-heat">${esc(base.heat_days)}</div><div class="sim-stat__delta" id="dt-heat">same as today</div></div>
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("Ranking in this scenario", provBadge(base.provenance, datasetOf(base)))}
        <ol class="rank-list" id="rank">
          ${baseTotals.map(({ id }) => `<li class="rank-row" data-key="${esc(id)}">
            <span class="rank-row__n">–</span>
            <span class="rank-row__name">${esc(displayName(byId[id] ?? { id }))}<small>${esc(byId[id] ? rotationTag(byId[id], current.id) : id)}</small></span>
            <span class="rank-row__bar"><span style="width:0%"></span></span>
            <span class="rank-row__score">0</span>
            <span class="move same">–</span>
          </li>`).join("")}
        </ol>
        <div class="panel__foot">Your current rotation and the 3 best alternatives for your priorities · ▲▼ = places moved vs today's climate · pre-computed scenarios, not a forecast</div>
      </section>
    </div>
  `;

  el.querySelectorAll("#controls output").forEach((o) => o.classList.add("sim-out"));
  const list = el.querySelector("#rank");
  const delta = (id, now, ref) => {
    const d = now - ref;
    const node = el.querySelector(id);
    node.className = `sim-stat__delta ${d > 0 ? "up" : d < 0 ? "down" : ""}`;
    node.textContent = d === 0 ? "same as today" : `${d > 0 ? "+" : "−"}${Math.abs(d)} vs today`;
  };

  const update = (animate) => {
    const s = nearestScenario(scenarios, cur.rain, cur.temp);
    const totals = totalsOf(s);
    totals.forEach(({ id, total }, i) => {
      const row = list.querySelector(`[data-key="${CSS.escape(id)}"]`);
      if (!row) return;
      const score = Math.round(total);
      row.querySelector(".rank-row__n").textContent = i + 1;
      row.querySelector(".rank-row__bar span").style.width = `${Math.max(0, Math.min(100, score))}%`;
      animateNumber(row.querySelector(".rank-row__score"), score, 0, 500);
      const mv = row.querySelector(".move");
      const d = baseRank[id] - i;
      mv.className = `move ${d > 0 ? "up" : d < 0 ? "down" : "same"}`;
      mv.textContent = d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "–";
    });
    if (animate) flipReorder(list, totals.map((x) => x.id));
    animateNumber(el.querySelector("#st-frost"), Number(s.frost_days), 0, 400);
    animateNumber(el.querySelector("#st-heat"), Number(s.heat_days), 0, 400);
    delta("#dt-frost", s.frost_days, base.frost_days);
    delta("#dt-heat", s.heat_days, base.heat_days);
  };

  const controls = el.querySelector("#controls");
  const presetBtns = [...controls.querySelectorAll(".preset")];
  const markPreset = () => presetBtns.forEach((b) => {
    const p = PRESETS[b.dataset.i];
    b.classList.toggle("is-on", p.rain === cur.rain && p.temp === cur.temp);
  });

  bindSliders(controls, (k, v) => (k === "rain" ? signed(v, " %") : signed(v, " °C")), (key, v) => {
    cur = { ...cur, [key]: v };
    markPreset();
    update(true);
  });
  presetBtns.forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.i];
    const r = controls.querySelector("#s-rain");
    const t = controls.querySelector("#s-temp");
    r.value = Math.max(rain.min, Math.min(rain.max, p.rain));
    t.value = Math.max(temp.min, Math.min(temp.max, p.temp));
    r.dispatchEvent(new Event("input"));
    t.dispatchEvent(new Event("input"));
  }));

  requestAnimationFrame(() => update(false));
}
