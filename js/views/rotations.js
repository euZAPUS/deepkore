// 03 Compare rotations: 4 cards ranked by the user's weighted priorities, re-ordered live.
import { CRITERIA_META, RESILIENCE_META } from "../config.js";
import { store } from "../store.js";
import { rankRotations } from "../scoring.js";
import { flipReorder } from "../motion.js";
import {
  esc, provBadge, heroHTML, nextHTML, icon, ICON, sliderHTML, bindSliders, levelWord,
  ringHTML, setRing, displayName, rotationTag, sequenceHTML,
} from "../ui.js";

const ALL_CRITERIA = [...CRITERIA_META, RESILIENCE_META];

function confidenceHTML(conf) {
  let level = 0;
  let label = String(conf ?? "unknown");
  if (typeof conf === "number") {
    level = Math.max(1, Math.min(3, Math.round(conf * 3)));
    label = `${Math.round(conf * 100)}%`;
  } else {
    level = { low: 1, medium: 2, high: 3 }[label.toLowerCase()] ?? 0;
    label = label.charAt(0).toUpperCase() + label.slice(1);
  }
  return `<span>Confidence <span class="conf">${[1, 2, 3].map((n) => `<i class="${n <= level ? "on" : ""}"></i>`).join("")}</span><b>${esc(label)}</b></span>`;
}

function pacHTML(pac) {
  if (pac === true) return `<span class="pac yes">${icon(ICON.check, 16)} <b>PAC eco-scheme: likely eligible</b></span>`;
  if (pac === false) return `<span class="pac">PAC eco-scheme: <b>not eligible</b></span>`;
  return `<span class="pac">PAC: <b>${esc(pac)}</b></span>`;
}

function listHTML(items, cls, ico) {
  return `<ul class="ilist ${cls}">${(items || []).map((t) => `<li>${icon(ico, 18)}<span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function cardHTML(r) {
  const bars = ALL_CRITERIA.map(
    (c) => `<div class="bar${c.key === RESILIENCE_META.key ? " bar--info" : ""}" style="--c:${c.color}">
      <div class="bar__top"><span>${esc(c.label)}</span><b>${esc(r.scores?.[c.key] ?? "–")}</b></div>
      <div class="bar__track"><div class="bar__fill" data-w="${Number(r.scores?.[c.key]) || 0}"></div></div>
    </div>`
  ).join("");
  return `<li class="rot reveal" data-key="${esc(r.id)}">
    <div class="rot__main">
      <div class="rot__rank">–</div>
      <div>
        <p class="rot__tag">${esc(rotationTag(r))}<span class="pill best-pill">Best match</span></p>
        <h3>${esc(displayName(r))}</h3>
        ${sequenceHTML(r.sequence)}
      </div>
      <div class="rot__score">${ringHTML(76)}<small>Match score</small></div>
    </div>
    <p class="rot__why">${esc(r.why)} ${provBadge(r.provenance)}</p>
    <div class="bars">${bars}</div>
    <div class="rot__meta">${confidenceHTML(r.confidence)}${pacHTML(r.pac_eligible)}</div>
    <details class="disclosure">
      <summary>Evidence, benefits and risks ${icon(ICON.chevron, 18)}</summary>
      <div class="disclosure__body">
        <div><h4>Evidence from NASA data</h4>
          <ul class="ev">${(r.evidence || []).map((e) => `<li>${provBadge(e.provenance ?? r.provenance, e.dataset)}<span>${esc(e.fact)}</span></li>`).join("")}</ul></div>
        <div><h4>Benefits</h4>${listHTML(r.benefits, "ilist--ok", ICON.check)}</div>
        <div><h4>Gaps in the data</h4>${listHTML(r.gaps, "ilist--gap", ICON.gap)}</div>
        <div><h4>Risks to check locally</h4>${listHTML(r.risks, "ilist--risk", ICON.warn)}</div>
      </div>
    </details>
  </li>`;
}

export function render(el, ctx) {
  const { rotations } = ctx.data;
  const st = store.get();

  el.innerHTML = `
    ${heroHTML(ctx, "Your current rotation next to three alternatives, ranked by what matters to you. Open a card to see the evidence.")}

    <section>
      <div class="weights-bar reveal">
        <span class="weights-bar__label">Ranked for:</span>
        <span id="wchips" class="chips"></span>
        <button class="btn-text" id="adjust-btn" aria-expanded="false" aria-controls="adjust">Adjust</button>
      </div>
      <div class="adjust" id="adjust" hidden>
        <div class="sliders" id="weights">
          ${CRITERIA_META.map((c) =>
            sliderHTML({ id: `rw-${c.key}`, key: c.key, label: c.label, color: c.color, value: st.weights[c.key], output: `${levelWord(st.weights[c.key])} · ${st.weights[c.key]}` })
          ).join("")}
        </div>
      </div>
      ${st.mode === "irrigated" ? '<p class="note">Irrigated fields are not modelled yet. Scores assume rainfed conditions.</p>' : ""}
      <ol class="rot-list" id="rot-list">${rotations.map(cardHTML).join("")}</ol>
      <p class="caption">Match score = your priorities × each rotation's scores (0–100). Risk resilience is shown for information.</p>
    </section>

    ${nextHTML(ctx.next)}
  `;

  const list = el.querySelector("#rot-list");
  const chips = el.querySelector("#wchips");

  const update = (animate) => {
    const w = store.get().weights;
    chips.innerHTML = CRITERIA_META.map((c) => `<span class="wchip" style="--c:${c.color}"><i></i>${esc(c.label)} ${w[c.key]}</span>`).join("");
    const ranked = rankRotations(rotations, w);
    ranked.forEach(({ rotation, total }, i) => {
      const card = list.querySelector(`[data-key="${CSS.escape(rotation.id)}"]`);
      card.querySelector(".rot__rank").textContent = i + 1;
      card.classList.toggle("is-best", i === 0);
      setRing(card.querySelector(".ring"), total);
    });
    const keys = ranked.map((r) => r.rotation.id);
    if (animate) flipReorder(list, keys);
    else keys.forEach((k) => list.appendChild(list.querySelector(`[data-key="${CSS.escape(k)}"]`)));
  };

  requestAnimationFrame(() => {
    update(false);
    list.querySelectorAll(".bar__fill").forEach((b) => (b.style.width = `${b.dataset.w}%`));
  });

  const btn = el.querySelector("#adjust-btn");
  btn.addEventListener("click", () => {
    const panel = el.querySelector("#adjust");
    panel.hidden = !panel.hidden;
    btn.setAttribute("aria-expanded", String(!panel.hidden));
    btn.textContent = panel.hidden ? "Adjust" : "Done";
  });

  let t = null;
  bindSliders(el.querySelector("#weights"), (k, v) => `${levelWord(v)} · ${v}`, (key, v) => {
    store.set({ weights: { [key]: v } });
    clearTimeout(t);
    t = setTimeout(() => update(true), 120); // re-rank once the hand pauses
  });
}
