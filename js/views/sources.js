// 05 Data & Limits: NASA sources, what the labels mean, and what the tool cannot tell you.
import { esc, provBadge, viewHead, panelHead, icon, ICON } from "../ui.js";

const LABELS = [
  ["Observed", "Measured by a NASA satellite or weather record."],
  ["Derived", "Calculated by us from observed data, e.g. a weekly chance."],
  ["AI-inferred", "Written or estimated by AI. Read it as a suggestion."],
  ["Simulated", "A what-if scenario. Not a forecast."],
  ["MOCK", "Placeholder while building the app. Not real data."],
];

// Draft list, to be reviewed by the team.
const LIMITS = [
  ["Satellite pixels are bigger than your field.", "NASA POWER cells are about 50 km wide, SMAP about 9 km."],
  ["The past does not guarantee the future.", "Risk weeks come from past years; the climate is changing."],
  ["Scenarios are simulations, not forecasts.", "They show how the ranking reacts, not next season."],
  ["No soil analysis, yields or prices.", "Your agronomist knows your soil test and harvests."],
  ["PAC rules change every year.", "Check eligibility with your cooperative or regional office."],
  ["Scores are for comparing, not promising.", "0–100 scores are not predicted yields or profits."],
];

export function render(el, ctx) {
  const { parcel } = ctx.data;
  const sources = parcel.sources || [];

  el.innerHTML = `
    ${viewHead("Data & Limits", `Where every number comes from, and what it cannot tell you. Historical period: ${parcel.period}.`)}
    <div class="view-body g-data">
      <section class="panel sources reveal">
        ${panelHead("NASA data we use", provBadge(parcel.provenance))}
        <ul class="src-list">
          ${sources.map((s) => `<li class="src">
            <div class="src__icon">${icon(ICON.data, 22)}</div>
            <div>
              <h3><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.dataset)}</a>${icon(ICON.ext, 14)}</h3>
              <p>${esc(s.role)}</p>
              <div class="chips">
                <span class="chip">${esc(s.resolution)}</span>
                <span class="chip">Version ${esc(s.version)}</span>
                <span class="chip">${esc(s.license)}</span>
              </div>
            </div>
          </li>`).join("")}
        </ul>
      </section>

      <section class="panel reveal">
        ${panelHead("What the labels mean")}
        <ul class="legend-list">${LABELS.map(([l, d]) => `<li>${provBadge(l)}<span>${esc(d)}</span></li>`).join("")}</ul>
      </section>

      <section class="panel reveal">
        ${panelHead("Limits", '<span class="pill pill--draft">Draft</span>')}
        <ol class="lim-list">
          ${LIMITS.map(([t, d], i) => `<li><span class="n">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join("")}
        </ol>
      </section>
    </div>
  `;
}
