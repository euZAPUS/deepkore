// 03 Compare rotations: ranked list (left) + detail of the selected rotation (right).
// On phones the detail slides in from the right, like an iOS navigation push.
import { CRITERIA_META, RESILIENCE_META } from "../config.js";
import { store } from "../store.js";
import { isScored, notScoredNote } from "../scoring.js";
import { resolveCurrent, compareSet } from "../choice.js";
import { flipReorder } from "../motion.js";
import {
  esc, provBadge, datasetOf, viewHead, panelHead, icon, ICON, sliderHTML, bindSliders, levelWord,
  ringHTML, setRing, displayName, rotationTag, sequenceHTML, segmentedHTML, bindSegmented,
} from "../ui.js";

const ALL_CRITERIA = [...CRITERIA_META, RESILIENCE_META];
const TABS = [
  { value: "evidence", label: "Evidence" },
  { value: "benefits", label: "Benefits" },
  { value: "gaps", label: "Gaps" },
  { value: "risks", label: "Risks" },
];

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
  if (pac === true) return `<span class="pac yes">${icon(ICON.check, 15)} <b>PAC eco-scheme: likely eligible</b></span>`;
  if (pac === false) return `<span class="pac">PAC eco-scheme: <b>not eligible</b></span>`;
  return `<span class="pac">PAC: <b>${esc(pac)}</b></span>`;
}

const listHTML = (items, cls, ico) =>
  `<ul class="ilist ${cls}">${(items || []).map((t) => `<li>${icon(ico, 18)}<span>${esc(t)}</span></li>`).join("")}</ul>`;

function tabHTML(r, tab) {
  if (tab === "evidence")
    return `<ul class="ev">${(r.evidence || []).map((e) => `<li>${provBadge(e.provenance ?? r.provenance, e.dataset)}<span>${esc(e.fact)}</span></li>`).join("")}</ul>`;
  if (tab === "benefits") return listHTML(r.benefits, "ilist--ok", ICON.check);
  if (tab === "gaps") return listHTML(r.gaps, "ilist--gap", ICON.gap);
  return listHTML(r.risks, "ilist--risk", ICON.warn);
}

// Net margin from MAPA ECREA behind the income score.
function incomeHTML(r) {
  const inc = r.income;
  if (!inc) return "";
  const eur = (v) => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString("en-US")} €/ha`;
  const crops = (inc.by_crop || []).map((b) => `<li><b>${esc(b.crop)}</b> ${b.assumed || b.eur_ha === null
    ? `<span class="muted">no verified value${b.eur_ha === null ? "" : ` · counted as ${eur(b.eur_ha)} (TBD)`}</span>`
    : `${eur(b.eur_ha)} <span class="muted">(${esc(b.years.join(", "))}${b.ecrea_crop ? ` · ECREA "${esc(b.ecrea_crop)}"` : ""})</span>`}${b.note ? `<br><span class="small muted">${esc(b.note)}</span>` : ""}</li>`).join("");
  return `<div class="income">
    <div class="bar__top"><span>Net margin behind the income score</span><b>${inc.eur_ha_year === null ? "–" : `${eur(inc.eur_ha_year)} per year`}</b></div>
    <ul class="income__list">${crops}</ul>
    <p class="small muted">${esc(inc.region ?? "")} · MAPA ECREA 2.0 net margin (margen neto), without decoupled payments. Income score: 0 €/ha or less = 0, 623 €/ha = 100 (scale TBD) · ${provBadge("derived", "MAPA ECREA")}</p>
  </div>`;
}

export function render(el, ctx) {
  const { rotations } = ctx.data;
  const scored = CRITERIA_META.filter((c) => isScored(rotations, c.key));
  const unscored = ALL_CRITERIA.filter((c) => !isScored(rotations, c.key));
  const byId = Object.fromEntries(rotations.map((r) => [r.id, r]));
  const current = resolveCurrent(rotations, store.get().current_rotation);
  let selected = null;
  let tab = "evidence";
  let ranked = []; // the rotations on screen: current + 3 best alternatives, best first (js/choice.js)

  el.innerHTML = `
    ${viewHead("Compare rotations", "Your current rotation and the three best alternatives, ranked by what matters to you.",
      `<div class="wchips" id="wchips"></div>
       <button class="btn btn--ghost" id="adjust-btn" aria-expanded="false" aria-controls="weights-pop">Adjust priorities</button>
       <div class="weights-pop" id="weights-pop" hidden>
         ${panelHead("Your priorities", '<button class="btn-text" id="pop-done">Done</button>')}
         <div class="sliders" id="weights">
           ${CRITERIA_META.map((c) => {
             if (!isScored(rotations, c.key)) return `<p class="note">${esc(notScoredNote(c.key, c.label, rotations))}</p>`;
             const v = store.get().weights[c.key];
             return sliderHTML({ id: `rw-${c.key}`, key: c.key, label: c.label, color: c.color, value: v, output: `${levelWord(v)} · ${v}` });
           }).join("")}
         </div>
       </div>`)}
    ${store.get().mode === "irrigated" ? '<p class="note" style="margin:-6px 0 14px">Irrigated fields are not modelled yet. Scores assume rainfed conditions.</p>' : ""}
    <div class="view-body g-rot">
      <section class="panel reveal">
        ${panelHead("Ranking")}
        <p class="note" id="first-note" hidden>Your current rotation already ranks first for your priorities</p>
        <ol class="rot-list" id="rot-list" role="listbox" aria-label="Your current rotation and the best alternatives"></ol>
        <div class="panel__foot">Match score = your priorities × each rotation's scores (0–100).</div>
      </section>

      <section class="panel detail reveal" id="detail" aria-live="polite"></section>
    </div>
  `;

  const list = el.querySelector("#rot-list");
  const rowHTML = (r) => `<li data-key="${esc(r.id)}">
    <button class="rot-row" role="option" aria-selected="false" data-id="${esc(r.id)}">
      <span class="rot-row__n">–</span>
      <span><span class="rot-row__name">${esc(displayName(r))}</span>
        <span class="rot-row__tag">${esc(rotationTag(r, current.id))}<span class="pill">Best match</span></span></span>
      ${ringHTML(46)}
      <span class="rot-row__chev">${icon(ICON.next, 18)}</span>
    </button></li>`;
  const detail = el.querySelector("#detail");

  const renderDetail = () => {
    const r = byId[selected];
    const pos = ranked.findIndex((x) => x.rotation.id === selected);
    const total = ranked[pos]?.total ?? 0;
    const diff = ranked[pos]?.diff ?? 0;
    const vs = r.id !== current.id && current;
    detail.innerHTML = `
      <button class="detail__back" id="back">${icon(ICON.back, 22)} Ranking</button>
      <div class="detail__top">
        <div>
          <p class="detail__tag">#${pos + 1} · ${esc(rotationTag(r, current.id))} · <b>${Math.round(total)}/100</b>${vs ? ` <span class="bar__delta ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff)}</span> vs your current rotation` : ""} ${pos === 0 ? '<span class="pill">Best match</span>' : ""}</p>
          <h2>${esc(displayName(r))}${r.custom ? ' <span class="chip">Your rotation</span>' : ""}</h2>
          ${sequenceHTML(r.sequence)}
        </div>
        <div class="detail__score">${ringHTML(84)}<div>Match score</div></div>
      </div>
      <p class="detail__why">${esc(r.why)} ${provBadge(r.provenance, datasetOf(r))}</p>
      ${r.same_family_in_a_row ? `<p class="note" style="margin-top:0">${icon(ICON.warn, 15)} Same crop family two years in a row</p>` : ""}
      <div class="bars">
        ${ALL_CRITERIA.filter((c) => !unscored.includes(c)).map((c) => {
          const v = Number(r.scores?.[c.key]) || 0;
          const d = vs ? v - (Number(current.scores?.[c.key]) || 0) : 0;
          return `<div class="bar${c.key === RESILIENCE_META.key ? " bar--info" : ""}" style="--c:${c.color}">
            <div class="bar__top"><span>${esc(c.label)}</span><b>${v}${vs && d ? `<span class="bar__delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>` : ""}</b></div>
            <div class="bar__track"><div class="bar__fill" data-w="${v}"></div></div></div>`;
        }).join("")}
      </div>
      ${incomeHTML(r)}
      ${unscored.map((c) => `<p class="small muted">${esc(notScoredNote(c.key, c.label, rotations))}</p>`).join("")}
      ${vs ? `<p class="small muted" style="margin-top:-6px">Green / red numbers: difference with your current rotation (${esc(displayName(current))}).</p>` : ""}
      <div class="detail__meta">${confidenceHTML(r.confidence)}${pacHTML(r.pac_eligible)}</div>
      <div>${segmentedHTML("detail-tabs", TABS, tab, "Details")}</div>
      <div class="tabs-body" id="tab-body">${tabHTML(r, tab)}</div>
    `;
    requestAnimationFrame(() => {
      setRing(detail.querySelector(".detail__score .ring"), total);
      detail.querySelectorAll(".bar__fill").forEach((b) => (b.style.width = `${b.dataset.w}%`));
    });
    bindSegmented(detail.querySelector("#detail-tabs"), (v) => {
      tab = v;
      detail.querySelector("#tab-body").outerHTML = `<div class="tabs-body" id="tab-body">${tabHTML(r, tab)}</div>`;
    });
    detail.querySelector("#back").addEventListener("click", () => detail.classList.remove("is-open"));
  };

  const select = (id, openOnPhone) => {
    selected = id;
    list.querySelectorAll(".rot-row").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    renderDetail();
    if (openOnPhone) detail.classList.add("is-open");
  };

  const update = (animate) => {
    const w = store.get().weights;
    el.querySelector("#wchips").innerHTML = scored.map((c) => `<span class="wchip" style="--c:${c.color}"><i></i>${esc(c.label)} ${w[c.key]}</span>`).join("");
    const set = compareSet(rotations, w, current.id);
    ranked = set.shown;
    el.querySelector("#first-note").hidden = !set.currentIsBest;
    const keys = ranked.map((r) => r.rotation.id);
    const same = [...list.children].map((li) => li.dataset.key).sort().join() === [...keys].sort().join();
    if (!same) {
      // a different alternative entered the top 3: rebuild the rows
      list.innerHTML = keys.map((k) => rowHTML(byId[k])).join("");
      animate = false;
    }
    if (!keys.includes(selected)) selected = keys[0];
    list.querySelectorAll(".rot-row").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === selected)));
    ranked.forEach(({ rotation, total }, i) => {
      const row = list.querySelector(`.rot-row[data-id="${CSS.escape(rotation.id)}"]`);
      row.querySelector(".rot-row__n").textContent = i + 1;
      row.classList.toggle("is-best", i === 0);
      setRing(row.querySelector(".ring"), total);
    });
    if (animate) flipReorder(list, keys);
    else keys.forEach((k) => list.appendChild(list.querySelector(`[data-key="${CSS.escape(k)}"]`)));
    renderDetail();
  };

  list.addEventListener("click", (e) => {
    const b = e.target.closest(".rot-row");
    if (b) select(b.dataset.id, window.matchMedia("(max-width: 720px)").matches);
  });

  // priorities popover
  const pop = el.querySelector("#weights-pop");
  const btn = el.querySelector("#adjust-btn");
  const setPop = (open) => { pop.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); setPop(pop.hidden); });
  el.querySelector("#pop-done").addEventListener("click", () => setPop(false));
  const outside = (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) setPop(false); };
  document.addEventListener("click", outside);
  let t = null;
  bindSliders(el.querySelector("#weights"), (k, v) => `${levelWord(v)} · ${v}`, (key, v) => {
    store.set({ weights: { [key]: v } });
    clearTimeout(t);
    t = setTimeout(() => update(true), 120);
  });

  ranked = compareSet(rotations, store.get().weights, current.id).shown;
  selected = ranked[0].rotation.id;
  requestAnimationFrame(() => {
    update(false);
    select(selected, false);
  });

  return () => document.removeEventListener("click", outside);
}
