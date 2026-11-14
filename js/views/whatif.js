// 04 What-if simulator: rain / temperature sliders pick the nearest pre-computed scenario.
import { nearestScenario } from "../scoring.js";
import { flipReorder } from "../motion.js";
import { esc, provBadge, heroHTML, nextHTML, sliderHTML, bindSliders, animateNumber, displayName, rotationTag, icon, ICON } from "../ui.js";

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
  const baseRank = Object.fromEntries(base.ranking.map((id, i) => [id, i]));
  let cur = { rain: 0, temp: 0 };

  el.innerHTML = `
    ${heroHTML(ctx, "What if it rains less, or gets hotter? Move the sliders and watch how the best rotation changes.")}

    <div class="center reveal" style="margin-bottom:22px"><span class="pill pill--sim">Simulated scenario</span></div>

    <section class="sim">
      <div class="sim__controls reveal" id="controls">
        <div class="sliders">
          ${sliderHTML({ id: "s-rain", key: "rain", label: "Rain", hint: "Change in yearly rainfall", color: "var(--c-water)", value: 0, ...rain, output: signed(0, " %") })}
          ${sliderHTML({ id: "s-temp", key: "temp", label: "Temperature", hint: "Warmer than today", color: "var(--h-heat)", value: 0, ...temp, output: signed(0, " °C") })}
        </div>
        <div class="presets">${PRESETS.map((p, i) => `<button class="preset${i === 0 ? " is-on" : ""}" data-i="${i}">${esc(p.label)}</button>`).join("")}</div>
      </div>

      <div class="sim__stats reveal">
        <div><div class="stat__num" id="st-frost">${esc(base.frost_days)}</div><div class="stat__label">${icon(ICON.frost, 14)} Frost days a year</div><div class="stat__delta" id="dt-frost">&nbsp;</div></div>
        <div><div class="stat__num" id="st-heat">${esc(base.heat_days)}</div><div class="stat__label">${icon(ICON.heat, 14)} Very hot days a year</div><div class="stat__delta" id="dt-heat">&nbsp;</div></div>
      </div>

      <ol class="rank-list reveal" id="rank">
        ${base.ranking.map((id) => `<li class="rank-row" data-key="${esc(id)}">
          <span class="rank-row__n">–</span>
          <span class="rank-row__name">${esc(displayName(byId[id] ?? { id }))}<small>${esc(byId[id] ? rotationTag(byId[id]) : id)}</small></span>
          <span class="rank-row__bar"><span style="width:0%"></span></span>
          <span class="rank-row__score">0</span>
          <span class="move same">–</span>
        </li>`).join("")}
      </ol>
      <p class="caption">Pre-computed scenarios, not a forecast. Scores here do not use your priority sliders. ${provBadge(base.provenance)}</p>
    </section>

    ${nextHTML(ctx.next)}
  `;

  const list = el.querySelector("#rank");
  const delta = (id, now, ref) => {
    const d = now - ref;
    const node = el.querySelector(id);
    node.className = `stat__delta ${d > 0 ? "up" : d < 0 ? "down" : ""}`;
    node.textContent = d === 0 ? "same as today" : `${d > 0 ? "+" : "−"}${Math.abs(d)} vs today`;
  };

  const update = (animate) => {
    const s = nearestScenario(scenarios, cur.rain, cur.temp);
    s.ranking.forEach((id, i) => {
      const row = list.querySelector(`[data-key="${CSS.escape(id)}"]`);
      if (!row) return;
      const score = Number(s.scores[id]) || 0;
      row.querySelector(".rank-row__n").textContent = i + 1;
      row.querySelector(".rank-row__bar span").style.width = `${Math.max(0, Math.min(100, score))}%`;
      animateNumber(row.querySelector(".rank-row__score"), score, 0, 500);
      const mv = row.querySelector(".move");
      const d = baseRank[id] - i;
      mv.className = `move ${d > 0 ? "up" : d < 0 ? "down" : "same"}`;
      mv.textContent = d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "–";
      mv.title = d === 0 ? "Same place as today" : `${Math.abs(d)} place(s) ${d > 0 ? "up" : "down"} vs today`;
    });
    if (animate) flipReorder(list, s.ranking);
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
