// 05 Data & Limits: NASA sources, what the labels mean, and what the tool cannot tell you.
import { esc, provBadge, datasetOf, viewHead, panelHead, icon, ICON, css, incomeScaleText } from "../ui.js";
import { anyMock } from "../data.js";

const LABELS = [
  ["Observed", "Measured by a NASA satellite or weather record."],
  ["Derived", "Calculated by us from observed data, e.g. a weekly chance."],
  ["AI-inferred", "Written or estimated by AI. Read it as a suggestion."],
  ["Simulated", "A what-if scenario. Not a forecast."],
  ["MOCK", "Placeholder while building the app. Not real data."],
];

// Draft list, to be reviewed by the team.
const LIMITS = [
  ["Satellite pixels are bigger than your field.", "One NASA POWER grid cell is tens of kilometres wide."],
  ["The past does not guarantee the future.", "Risk weeks come from past years; the climate is changing."],
  ["Scenarios are simulations, not forecasts.", "They show how the ranking reacts, not next season."],
  ["No soil analysis, yields or prices.", "Your agronomist knows your soil test and harvests."],
  ["PAC rules change every year.", "Check eligibility with your cooperative or regional office."],
  ["Scores are for comparing, not promising.", "0–100 scores are not predicted yields or profits."],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym) => `${MONTHS[Number(String(ym).slice(5, 7)) - 1] ?? ym} ${String(ym).slice(2, 4)}`;

function validationHTML(v) {
  if (!v) return "";
  return `<section class="panel validation reveal">
    ${panelHead("Validation: dry 2022-23 season", provBadge(v.provenance, "NASA POWER"))}
    ${v.question ? `<p class="small muted">${esc(v.question)}</p>` : ""}
    <p class="validation__headline">${esc(v.headline)}</p>
    <div class="chart-box chart-box--val"><canvas id="val-chart" aria-label="Rain since 1 October 2022 compared with other years"></canvas></div>
    <div class="panel__foot">Cumulative rain since 1 October · median and 20th percentile of the reference years</div>
    ${Array.isArray(v.limits) && v.limits.length ? `<h3 class="validation__sub">Limits of this check</h3>
      <ul class="val-limits">${v.limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
  </section>`;
}

// Non-NASA data: MAPA ECREA net margins used for the income figures (not in the ranking).
function incomeSourcesHTML(rotations, rules) {
  const docs = new Map();
  let inc = null;
  (rotations || []).forEach((r) => (r.income?.documents || []).forEach((d) => { docs.set(d.url, d.id); inc = r.income; }));
  if (!docs.size) return "";
  return `<section class="panel reveal">
    ${panelHead("Other data: farm income", provBadge("derived", "MAPA ECREA"))}
    <p class="small">Net margin per hectare (margen neto, without decoupled payments) of rainfed crops in Andalucía, from the Spanish Ministry of Agriculture's cost and income studies (ECREA 2.0, farm accounting network RECAN). Turned into the income score: ${esc(incomeScaleText(rules))} (scale TBD). Vetch as forage and cover crops have no verified value and count as 0 €/ha (TBD). Fallow has no verified value and is left empty: a rotation with fallow has no income score, and income then stays out of the ranking for all rotations.</p>
    <ul class="val-limits">${[...docs].map(([url, id]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(id.replace("_", " "))}</a></li>`).join("")}</ul>
    <p class="small muted">${inc?.accessed ? `Accessed ${esc(inc.accessed)}. ` : ""}Sample farms, 2018-2020 prices, regional averages: not your field's yields or prices. Chickpea and lentil use ECREA's lentils-chickpeas-vetches group.</p>
  </section>`;
}

export function render(el, ctx) {
  const { parcel, validation } = ctx.data;
  const sources = parcel.sources || [];

  el.innerHTML = `
    ${viewHead("Data & Limits", `Where every number comes from, and what it cannot tell you. Historical period: ${parcel.period}.`)}
    <div class="view-body g-data">
      <section class="panel sources reveal">
        ${panelHead("NASA data we use", provBadge(parcel.provenance, datasetOf(parcel)))}
        <ul class="src-list">
          ${sources.map((s) => `<li class="src">
            <div class="src__icon">${icon(ICON.data, 22)}</div>
            <div>
              <h3><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.dataset)}</a>${icon(ICON.ext, 14)}</h3>
              <p>${esc(s.role)}</p>
              ${s.provider ? `<p class="small muted">Provider: ${esc(s.provider)}${s.accessed ? ` · accessed ${esc(s.accessed)}` : ""}</p>` : s.accessed ? `<p class="small muted">Accessed ${esc(s.accessed)}</p>` : ""}
              <div class="chips">
                <span class="chip">${esc(s.resolution)}</span>
                <span class="chip">Version ${esc(s.version)}</span>
                <span class="chip">${esc(s.license)}</span>
              </div>
              ${s.variables ? `<p class="small src__more"><b>Variables:</b> ${esc(s.variables)}</p>` : ""}
              ${s.limits ? `<p class="small src__more"><b>Limits:</b> ${esc(s.limits)}</p>` : ""}
            </div>
          </li>`).join("")}
        </ul>
      </section>

      ${incomeSourcesHTML(ctx.data.rotations, ctx.rules)}

      <section class="panel reveal">
        ${panelHead("What the labels mean")}
        <ul class="legend-list">${LABELS.filter(([l]) => l !== "MOCK" || anyMock(ctx.data)).map(([l, d]) => `<li>${provBadge(l)}<span>${esc(d)}</span></li>`).join("")}</ul>
      </section>

      <section class="panel reveal">
        ${panelHead("Limits", '<span class="pill pill--draft">Draft</span>')}
        <ol class="lim-list">
          ${LIMITS.map(([t, d], i) => `<li><span class="n">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join("")}
        </ol>
      </section>

      ${validationHTML(validation)}
    </div>
  `;

  /* ---- validation chart ---- */
  let chart = null;
  const rows = validation?.rain_since_october;
  const draw = () => {
    chart?.destroy();
    if (!window.Chart || !Array.isArray(rows)) return;
    Chart.defaults.font.family = css("--font");
    Chart.defaults.color = css("--text-2");
    const line = (label, data, color, extra = {}) => ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2.5, tension: 0.3, pointRadius: 2, pointHoverRadius: 5, ...extra });
    chart = new Chart(el.querySelector("#val-chart"), {
      type: "line",
      data: {
        labels: rows.map((r) => monthLabel(r.month)),
        datasets: [
          line("2022-23", rows.map((r) => r.cum_mm), css("--c-erosion"), { borderWidth: 3 }),
          line("Usual (median)", rows.map((r) => r.base_median), css("--c-water"), { borderDash: [6, 5] }),
          line("Dry years (20th percentile)", rows.map((r) => r.base_p20), css("--text-3"), { borderDash: [2, 4] }),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 12 } },
          tooltip: { backgroundColor: css("--panel"), titleColor: css("--text"), bodyColor: css("--text-2"), borderColor: css("--sep"), borderWidth: 1, padding: 12, cornerRadius: 12, boxPadding: 4, usePointStyle: true },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
          y: { beginAtZero: true, grid: { color: css("--sep") }, border: { display: false }, title: { display: true, text: "mm since 1 Oct" } },
        },
      },
    });
  };
  const onTheme = () => draw();
  document.addEventListener("deepkore:theme", onTheme);
  draw();

  return () => {
    chart?.destroy();
    document.removeEventListener("deepkore:theme", onTheme);
  };
}
