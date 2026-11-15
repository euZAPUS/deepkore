// 02 Risk calendar: four headline tiles, a 52-week calendar, erosion window and climate chart.
import { isMock } from "../data.js";
import { esc, provBadge, viewHead, panelHead, icon, ICON, css, segmentedHTML, bindSegmented, displayName } from "../ui.js";
import { store } from "../store.js";
import { resolveCurrent } from "../choice.js";

const REF_YEAR = 2025; // non-leap reference year to turn week numbers into dates
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HAZARDS = [
  { key: "p_frost", label: "Frost", color: "var(--h-frost)", icon: ICON.frost },
  { key: "p_heat", label: "Extreme heat", color: "var(--h-heat)", icon: ICON.heat },
  { key: "p_extreme_rain", label: "Heavy rain", color: "var(--h-rain)", icon: ICON.rain },
];
const DEFAULT_DATASET = "NASA POWER";
const THRESHOLD_LABELS = { frost: "Frost day", heat: "Very hot day", extreme_rain: "Heavy-rain day", soil_alert: "Dry-soil alert" };

// "TBD..." sources are shown as "Source to be confirmed".
const sourceText = (src) => (!src || /^\s*TBD/i.test(String(src)) ? "Source to be confirmed" : String(src));

// Soil moisture now as a plain sentence from its percentile for the time of year (soil_moisture_now.percentile:
// share of reference days, same season, drier than today).
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function soilSentence(sm, period) {
  const p = Number(sm.percentile);
  if (!Number.isFinite(p)) return null;
  const [y, m, d] = String(sm.date || "").split("-").map(Number);
  const when = m >= 1 && m <= 12 && d ? `${d <= 10 ? "early" : d <= 20 ? "mid" : "late"} ${MONTH_NAMES[m - 1]}` : "this time of year";
  const years = String(period || "").replace("-", "–");
  if (p <= 0) return `Driest for ${when}${years ? ` in ${years}` : ""}`;
  if (p >= 100) return `Wettest for ${when}${years ? ` in ${years}` : ""}`;
  return p < 50
    ? `Drier than ${Math.round((100 - p) / 10)} out of 10 years for this time of year`
    : `Wetter than ${Math.round(p / 10)} out of 10 years for this time of year`;
}

function thresholdRows(th) {
  return Object.entries(th || {}).map(([key, t]) => {
    const pctRule = t.percentile !== undefined && t.value === undefined;
    const rule = t.rule ?? (pctRule ? "root-zone wetness below percentile" : key);
    const value = t.value ?? t.percentile;
    const unit = t.unit ?? (pctRule ? `for the time of year${t.run_days !== undefined ? `, ${t.run_days} days in a row` : ""}` : "");
    return `<tr><th scope="row">${esc(THRESHOLD_LABELS[key] ?? key)}</th>
      <td>${esc(t.variable ? `${t.variable}: ` : "")}${esc(rule)} <b>${esc(value)}</b> ${esc(unit)}</td>
      <td class="${/^\s*TBD/i.test(String(t.source ?? "TBD")) ? "muted" : ""}">${esc(sourceText(t.source))}</td></tr>`;
  }).join("");
}

/* ---------- week helpers ---------- */
const weekStart = (w) => new Date(Date.UTC(REF_YEAR, 0, 1 + (w - 1) * 7));
const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekRange = (w) => {
  const s = weekStart(w);
  const e = w === 52 ? new Date(Date.UTC(REF_YEAR, 11, 31)) : new Date(s.getTime() + 6 * 864e5);
  return { from: fmt(s), to: fmt(e), label: `${fmt(s)} – ${fmt(e)}` };
};
const weekMonth = (w) => new Date(weekStart(w).getTime() + 3 * 864e5).getUTCMonth() + 1;
const monthStartWeek = (m) => Math.floor((Date.UTC(REF_YEAR, m, 1) - Date.UTC(REF_YEAR, 0, 1)) / 864e5 / 7) + 1;
function todayWeek() {
  const now = new Date();
  const doy = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 1)) / 864e5);
  return Math.min(52, Math.floor(doy / 7) + 1);
}

// Weeks around the peak where the chance is at least half of the peak (wraps around New Year).
function riskWindow(values) {
  let pk = 0;
  values.forEach((v, i) => { if (v > values[pk]) pk = i; });
  const thr = values[pk] * 0.5;
  let s = pk, e = pk;
  for (let k = 0; k < 51 && values[(s + 51) % 52] >= thr; k++) s = (s + 51) % 52;
  for (let k = 0; k < 51 && values[(e + 1) % 52] >= thr; k++) e = (e + 1) % 52;
  return { peak: pk + 1, start: s + 1, end: e + 1, max: values[pk], thr };
}
const pct = (p) => `${Math.round(p * 100)}%`;

export function render(el, ctx) {
  const { risk_windows: rw, climate } = ctx.data;
  const weeks = [...rw.weeks].sort((a, b) => a.week - b.week);
  // bare months of the rotation the user grows now (What do you grow now?); older files: risk_windows.bare_months
  const curRot = ctx.data.rotations ? resolveCurrent(ctx.data.rotations, store.get().current_rotation) : null;
  const bare = new Set((curRot?.bare_months ?? rw.bare_months ?? []).map(Number));
  const curName = curRot ? ` (${esc(displayName(curRot))})` : "";
  const today = todayWeek();
  const sm = rw.soil_moisture_now || {};
  const dry = (sm.anomaly_pct || 0) < 0;
  const windows = Object.fromEntries(HAZARDS.map((h) => [h.key, riskWindow(weeks.map((w) => w[h.key]))]));
  const rainW = windows.p_extreme_rain;
  const overlap = weeks.filter((w) => bare.has(weekMonth(w.week)) && w.p_extreme_rain >= rainW.thr).map((w) => w.week);
  const derived = isMock(rw.provenance) ? rw.provenance : "Derived";
  const ds = (key) => rw.datasets?.[key] ?? DEFAULT_DATASET;
  const allDs = [...new Set(HAZARDS.map((h) => ds(h.key)))].join(" · ");
  const smDataset = sm.dataset ?? DEFAULT_DATASET;
  const smIndex = Number(sm.value); // 0 = dry, 1 = saturated

  el.innerHTML = `
    ${viewHead("Risk calendar", "When frost, extreme heat and heavy rain usually hit your field.")}
    <div class="view-body g-risks">
      <section class="panel stat stat--soil reveal" style="--hc:var(--c-water)">
        <div class="stat__top"><span class="stat__icon">${icon('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', 19)}</span><span class="stat__label">Soil moisture now</span></div>
        <p class="stat__big stat__big--text">${esc(soilSentence(sm, rw.period) ?? "No percentile available")}</p>
        <p class="stat__sub ${dry ? "is-dry" : "is-wet"}">${Number(sm.anomaly_pct) === 0 ? "About as wet as usual for the time of year" : `${dry ? "↓" : "↑"} ${Math.abs(sm.anomaly_pct)}% ${dry ? "drier" : "wetter"} than usual`}</p>
        <div class="panel__foot">Root-zone wetness index ${Number.isFinite(smIndex) ? smIndex.toFixed(2) : "–"} (0 = dry, 1 = saturated) · NASA POWER model · ${esc(sm.date)} · ${provBadge(sm.provenance ?? rw.provenance, smDataset)}</div>
      </section>
      ${HAZARDS.map((h) => {
        const w = windows[h.key];
        return `<section class="panel stat reveal" style="--hc:${h.color}">
          <div class="stat__top"><span class="stat__icon">${icon(h.icon, 19)}</span><span class="stat__label">${esc(h.label)}</span></div>
          <div class="stat__big">${weekRange(w.start).from} – ${weekRange(w.end).to}</div>
          <p class="stat__sub">Peak ~${weekRange(w.peak).from} · max ${pct(w.max)}/week</p>
          <div class="panel__foot">${provBadge(rw.provenance, ds(h.key))}</div>
        </section>`;
      }).join("")}

      <section class="panel calendar reveal">
        ${panelHead("Week by week", '<div class="readout" id="readout" aria-live="polite"></div>')}
        <div class="cal" id="cal">
          <div class="cal__grid">
            ${HAZARDS.map((h) => {
              const max = windows[h.key].max || 1;
              return `<div class="cal__label" style="--rc:${h.color}"><i></i>${esc(h.label)}</div>` +
                weeks.map((w) => `<div class="cal__cell${w.week === today ? " is-today" : ""}" data-w="${w.week}" style="--rc:${h.color};--v:${Math.round(12 + (w[h.key] / max) * 88)}%"></div>`).join("");
            }).join("")}
            <div class="cal__label" style="--rc:var(--c-soil)"><i></i>Bare soil</div>
            ${weeks.map((w) => `<div class="cal__cell${w.week === today ? " is-today" : ""}" data-w="${w.week}" style="--rc:var(--c-soil);--v:${bare.has(weekMonth(w.week)) ? 75 : 0}%"></div>`).join("")}
          </div>
          <div class="cal__months"><span></span>
            ${MONTHS.map((m, i) => {
              const start = monthStartWeek(i);
              const end = i < 11 ? monthStartWeek(i + 1) : 53;
              return `<span style="grid-column:${start + 1} / ${end + 1}"><span class="m-long">${m}</span><span class="m-short">${m[0]}</span></span>`;
            }).join("")}
          </div>
        </div>
        <div class="panel__foot">Darker = more likely · slide across to read each week · green outline = today · ${provBadge(rw.provenance, allDs)}</div>
      </section>

      ${rw.thresholds ? `<section class="panel how-count reveal"><details class="fold">
        <summary>${panelHead("How we count", `<span class="fold__more">Show method ${icon(ICON.chevron, 16)}</span>`)}</summary>
        <p class="small muted">${esc(rw.method ?? "")}${rw.period ? ` Years ${esc(rw.period)}${rw.n_years ? ` (${esc(rw.n_years)} years)` : ""}.` : ""}</p>
        <div class="table-wrap"><table class="th-table">
          <thead><tr><th scope="col">What</th><th scope="col">Rule</th><th scope="col">Source</th></tr></thead>
          <tbody>${thresholdRows(rw.thresholds)}</tbody>
        </table></div>
        ${rw.bare_months_source ? `<p class="small muted">Bare soil: ${esc(rw.bare_months_source)}.</p>` : ""}
      </details></section>` : ""}

      <section class="panel climate reveal">
        ${panelHead("Your climate", segmentedHTML("chart-mode", [
          { value: "water", label: "Water" },
          { value: "temp", label: "Temperature" },
          { value: "trend", label: "Trend" },
        ], "water", "Climate chart"))}
        <div class="chart-box"><canvas id="climate-chart" aria-label="Climate chart"></canvas></div>
        <div class="panel__foot" id="chart-caption"></div>
      </section>

      <section class="panel erosion reveal" style="--hc:var(--c-erosion)">
        <div class="stat__top"><span class="stat__icon">${icon(ICON.warn, 19)}</span><span class="stat__label">Erosion window</span></div>
        ${overlap.length
          ? `<div class="stat__big">${weekRange(overlap[0]).from} – ${weekRange(overlap.at(-1)).to}</div>
             <p>Heavy rain becomes likely while the soil is still bare in your current rotation${curName}. A cover crop or earlier sowing would protect it.</p>`
          : `<div class="stat__big">No overlap</div><p>Heavy-rain weeks do not fall on bare soil in your current rotation${curName}.</p>`}
        <div class="panel__foot">${provBadge(derived, `${ds("p_extreme_rain")} + crop calendar`)}</div>
      </section>
    </div>
  `;


  /* ---- calendar: scrub with finger or mouse ---- */
  const readout = el.querySelector("#readout");
  const cal = el.querySelector("#cal");
  const select = (wk) => {
    const w = weeks.find((x) => x.week === wk);
    if (!w) return;
    cal.querySelectorAll(".is-sel").forEach((c) => c.classList.remove("is-sel"));
    cal.querySelectorAll(`[data-w="${wk}"]`).forEach((c) => c.classList.add("is-sel"));
    readout.innerHTML = `<strong>${wk === today ? "This week" : `Week ${wk}`} · ${weekRange(wk).label}</strong>
      <span>Frost <b>${pct(w.p_frost)}</b></span><span>Heat <b>${pct(w.p_heat)}</b></span>
      <span>Heavy rain <b>${pct(w.p_extreme_rain)}</b></span><span>Bare soil <b>${bare.has(weekMonth(wk)) ? "yes" : "no"}</b></span>`;
  };
  const grid = cal.querySelector(".cal__grid");
  const firstRow = [...grid.querySelectorAll(".cal__cell")].slice(0, 52);
  const weekAt = (x) => {
    const a = firstRow[0].getBoundingClientRect();
    const b = firstRow[51].getBoundingClientRect();
    const k = (x - a.left) / (b.right - a.left);
    return k < 0 || k > 1 ? null : Math.min(52, Math.floor(k * 52) + 1);
  };
  let scrubbing = false;
  const pick = (e) => { const wk = weekAt(e.clientX); if (wk) select(wk); };
  grid.addEventListener("pointerdown", (e) => { scrubbing = true; pick(e); });
  grid.addEventListener("pointermove", (e) => { if (scrubbing || e.pointerType === "mouse") pick(e); });
  grid.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") select(today); });
  const stop = () => (scrubbing = false);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  select(today);

  /* ---- climate chart ---- */
  let chart = null;
  let mode = "water";
  const caption = el.querySelector("#chart-caption");
  const draw = () => {
    chart?.destroy();
    if (!window.Chart || !climate) return;
    Chart.defaults.font.family = css("--font");
    Chart.defaults.color = css("--text-2");
    const m = climate.monthly;
    const t = climate.trends;
    const line = (label, data, color, extra = {}) => ({ type: "line", label, data, borderColor: color, backgroundColor: color, borderWidth: 2.5, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, ...extra });
    let data, yTitle;
    const years = `${t.years[0]}–${t.years.at(-1)}`;
    if (mode === "water") {
      data = { labels: MONTHS, datasets: [
        { type: "bar", label: "Rain", data: m.precip_mm, backgroundColor: css("--c-water") + "cc", borderRadius: 6, maxBarThickness: 26 },
        line("Reference evapotranspiration (ET0)", m.et0, css("--wheat"), { borderDash: [6, 5] }),
      ] };
      yTitle = "mm per month";
      caption.innerHTML = `Dashed line above the bars = the air demands more water than the rain gives (reference grass, FAO-56) · ${years} · ${provBadge(climate.provenance, "NASA POWER")}`;
    } else if (mode === "temp") {
      data = { labels: MONTHS, datasets: [line("Max °C", m.tmax, css("--h-heat")), line("Min °C", m.tmin, css("--h-frost"))] };
      yTitle = "°C";
      caption.innerHTML = `Monthly average of daily highs and lows · ${years} · ${provBadge(climate.provenance, "NASA POWER")}`;
    } else {
      data = { labels: t.years, datasets: [line("Frost days", t.frost_days, css("--h-frost"), { pointRadius: 2 }), line("Very hot days", t.heat_days, css("--h-heat"), { pointRadius: 2 })] };
      yTitle = "days per year";
      caption.innerHTML = `Days per year · ${provBadge(climate.provenance, "NASA POWER")}`;
    }
    chart = new Chart(el.querySelector("#climate-chart"), {
      type: "bar",
      data,
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 14 } },
          tooltip: { backgroundColor: css("--panel"), titleColor: css("--text"), bodyColor: css("--text-2"), borderColor: css("--sep"), borderWidth: 1, padding: 12, cornerRadius: 12, boxPadding: 4, usePointStyle: true },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
          y: { grid: { color: css("--sep") }, border: { display: false }, title: { display: true, text: yTitle } },
        },
      },
    });
  };
  bindSegmented(el.querySelector("#chart-mode"), (v) => { mode = v; draw(); });
  const onTheme = () => draw();
  document.addEventListener("deepkore:theme", onTheme);
  draw();

  return () => {
    chart?.destroy();
    document.removeEventListener("deepkore:theme", onTheme);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };
}
