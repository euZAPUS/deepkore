// 02 Risk calendar: soil moisture now, when each hazard peaks, 52-week calendar, climate context.
import { isMock } from "../data.js";
import { esc, provBadge, heroHTML, nextHTML, blockHead, icon, ICON, css, segmentedHTML, bindSegmented, animateNumber } from "../ui.js";

const REF_YEAR = 2025; // non-leap reference year to turn week numbers into dates
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HAZARDS = [
  { key: "p_frost", label: "Frost", color: "var(--h-frost)", cssVar: "--h-frost", icon: ICON.frost, dataset: "NASA POWER" },
  { key: "p_heat", label: "Extreme heat", color: "var(--h-heat)", cssVar: "--h-heat", icon: ICON.heat, dataset: "NASA POWER" },
  { key: "p_extreme_rain", label: "Heavy rain", color: "var(--h-rain)", cssVar: "--h-rain", icon: ICON.rain, dataset: "GPM IMERG" },
];

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
  const bare = new Set((rw.bare_months || []).map(Number));
  const today = todayWeek();
  const sm = rw.soil_moisture_now || {};
  const windows = Object.fromEntries(HAZARDS.map((h) => [h.key, riskWindow(weeks.map((w) => w[h.key]))]));

  // Heavy rain while the soil is bare = erosion window
  const rainW = windows.p_extreme_rain;
  const overlap = weeks.filter((w) => bare.has(weekMonth(w.week)) && w.p_extreme_rain >= rainW.thr).map((w) => w.week);

  const usual = sm.value / (1 + (sm.anomaly_pct || 0) / 100);
  const scaleMax = 0.5; // m3/m3, top of the meter
  const dry = (sm.anomaly_pct || 0) < 0;

  el.innerHTML = `
    ${heroHTML(ctx, "When frost, extreme heat and heavy rain usually hit your field, so you can prepare before they arrive.")}

    <section class="moisture reveal">
      <p class="hero__eyebrow">Soil moisture now</p>
      <div class="moisture__num"><span id="sm-num">0</span><small>%</small></div>
      <p class="muted small">${esc(sm.value)} m³ of water per m³ of soil (top 5 cm)</p>
      <p class="moisture__anom ${dry ? "is-dry" : "is-wet"}">${icon(dry ? ICON.arrowDown : ICON.arrowUp, 18)} ${Math.abs(sm.anomaly_pct)}% ${dry ? "drier" : "wetter"} than usual for this time of year</p>
      <div class="meter" aria-hidden="true">
        <span class="meter__now" style="width:0%"></span>
        <span class="meter__usual" style="left:${Math.min(100, (usual / scaleMax) * 100)}%"></span>
      </div>
      <div class="meter__legend"><span><i style="background:var(--c-water)"></i>Now</span><span><i style="background:var(--text)"></i>Usual</span></div>
      <p class="caption">Measured ${esc(sm.date)} · ${provBadge(rw.provenance, "SMAP")}</p>
    </section>

    <section class="block">
      ${blockHead("When to watch out", `The weeks each risk is most likely, from records for ${esc(ctx.data.parcel?.period ?? "past years")}.`)}
      <div class="hazards">
        ${HAZARDS.map((h) => {
          const w = windows[h.key];
          return `<div class="hazard reveal" style="--hc:${h.color}">
            <div class="hazard__icon">${icon(h.icon, 26)}</div>
            <h3>${esc(h.label)}</h3>
            <p class="hazard__when">${weekRange(w.start).from} – ${weekRange(w.end).to}</p>
            <p class="hazard__peak">Peak around ${weekRange(w.peak).from} · up to ${pct(w.max)} chance in a week</p>
            <p class="caption" style="margin-top:8px">${provBadge(rw.provenance, h.dataset)}</p>
          </div>`;
        }).join("")}
      </div>
      ${overlap.length ? `<div class="insight reveal">${icon(ICON.warn, 22)}<div>
        <p><b>Erosion window: ${weekRange(overlap[0]).from} – ${weekRange(overlap[overlap.length - 1]).to}.</b>
        Heavy rain becomes likely while your soil is still bare in the current rotation. A cover crop or earlier sowing would protect it.</p>
        ${provBadge(isMock(rw.provenance) ? rw.provenance : "Derived", "GPM IMERG + rotation calendar")}</div></div>` : ""}
    </section>

    <section class="block">
      ${blockHead("Your year, week by week", "Darker means more likely. Slide your finger or mouse across to see each week.")}
      <div class="cal reveal" id="cal">
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
        <div class="cal__readout" id="readout" aria-live="polite"></div>
        <p class="caption">Outlined week = today · Bare soil from the current rotation · ${provBadge(rw.provenance, "NASA POWER · GPM IMERG")}</p>
      </div>
    </section>

    <section class="block">
      ${blockHead("Your climate", "Averages for your field over " + esc(climate?.trends?.years?.[0] ?? "") + "–" + esc(climate?.trends?.years?.at?.(-1) ?? "") + ".")}
      <div class="center reveal">${segmentedHTML("chart-mode", [
        { value: "water", label: "Water" },
        { value: "temp", label: "Temperature" },
        { value: "trend", label: "20-year trend" },
      ], "water", "Climate chart")}</div>
      <div class="chart-box reveal"><canvas id="climate-chart" aria-label="Climate chart"></canvas></div>
      <p class="caption" id="chart-caption"></p>
    </section>

    ${nextHTML(ctx.next)}
  `;

  /* ---- soil moisture animation ---- */
  requestAnimationFrame(() => {
    animateNumber(el.querySelector("#sm-num"), sm.value * 100, 0, 900);
    el.querySelector(".meter__now").style.width = `${Math.min(100, (sm.value / scaleMax) * 100)}%`;
  });

  /* ---- calendar readout ---- */
  const readout = el.querySelector("#readout");
  const cal = el.querySelector("#cal");
  const select = (wk) => {
    const w = weeks.find((x) => x.week === wk);
    if (!w) return;
    cal.querySelectorAll(".is-sel").forEach((c) => c.classList.remove("is-sel"));
    cal.querySelectorAll(`[data-w="${wk}"]`).forEach((c) => c.classList.add("is-sel"));
    readout.innerHTML = `<strong>${wk === today ? "This week · " : ""}Week ${wk} · ${weekRange(wk).label}</strong>
      <div class="vals"><span>Frost <b>${pct(w.p_frost)}</b></span><span>Extreme heat <b>${pct(w.p_heat)}</b></span>
      <span>Heavy rain <b>${pct(w.p_extreme_rain)}</b></span><span>Bare soil <b>${bare.has(weekMonth(wk)) ? "yes" : "no"}</b></span></div>`;
  };
  // Scrub: the horizontal position picks the week (easy on phones where a week is ~5 px wide).
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
    const c = (v) => css(v);
    Chart.defaults.font.family = css("--font");
    Chart.defaults.color = c("--text-2");
    const m = climate.monthly;
    const t = climate.trends;
    const line = (label, data, color, extra = {}) => ({ type: "line", label, data, borderColor: color, backgroundColor: color, borderWidth: 2.5, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, ...extra });
    let data, yTitle;
    if (mode === "water") {
      data = { labels: MONTHS, datasets: [
        { type: "bar", label: "Rain (mm)", data: m.precip_mm, backgroundColor: c("--c-water") + "cc", borderRadius: 6, maxBarThickness: 28 },
        line("Crop water demand, ET0 (mm)", m.et0, c("--wheat"), { borderDash: [6, 5] }),
      ] };
      yTitle = "mm per month";
      caption.innerHTML = `When the dashed line is above the bars, crops need more water than the rain gives. ${provBadge(climate.provenance, "NASA POWER")}`;
    } else if (mode === "temp") {
      data = { labels: MONTHS, datasets: [line("Max temperature (°C)", m.tmax, c("--h-heat")), line("Min temperature (°C)", m.tmin, c("--h-frost"))] };
      yTitle = "°C";
      caption.innerHTML = `Monthly average of daily highs and lows. ${provBadge(climate.provenance, "NASA POWER")}`;
    } else {
      data = { labels: t.years, datasets: [line("Frost days per year", t.frost_days, c("--h-frost"), { pointRadius: 2 }), line("Very hot days per year", t.heat_days, c("--h-heat"), { pointRadius: 2 })] };
      yTitle = "days";
      caption.innerHTML = `Count of days per year. ${provBadge(climate.provenance, "NASA POWER")}`;
    }
    chart = new Chart(el.querySelector("#climate-chart"), {
      type: "bar",
      data,
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 18 } },
          tooltip: { backgroundColor: c("--tile-raised"), titleColor: c("--text"), bodyColor: c("--text-2"), borderColor: c("--sep"), borderWidth: 1, padding: 12, cornerRadius: 12, boxPadding: 4, usePointStyle: true },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
          y: { grid: { color: c("--sep") }, border: { display: false }, title: { display: true, text: yTitle } },
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
