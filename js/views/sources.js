// 05 Data & Limits: NASA sources, what the labels mean, and what the tool cannot tell you.
import { esc, provBadge, heroHTML, nextHTML, blockHead, icon, ICON } from "../ui.js";

const LABELS = [
  ["Observed", "Measured directly by a NASA satellite or weather record."],
  ["Derived", "Calculated by us from observed data, for example a weekly probability."],
  ["AI-inferred", "Written or estimated by AI from the data. Read it as a suggestion."],
  ["Simulated", "A what-if scenario. Not a forecast."],
  ["MOCK", "Placeholder used while building the app. Not real data."],
];

// Draft list, to be reviewed by the team.
const LIMITS = [
  ["Satellite pixels are bigger than your field.", "NASA POWER cells are about 50 km wide and SMAP about 9 km. They describe the area around your field, not each corner of it."],
  ["The past does not guarantee the future.", "Risk weeks come from past years. The climate is changing, so treat them as a guide."],
  ["Scenarios are simulations, not forecasts.", "The what-if screen shows how the ranking reacts to change. It does not predict next season."],
  ["No soil analysis, yields or prices.", "DeepKore does not know your soil test, your past harvests or market prices. Your agronomist does."],
  ["PAC rules change every year.", "Eligibility shown here is indicative. Check it with your cooperative or the regional office."],
  ["Scores are for comparing, not for promising.", "0–100 scores help compare options side by side. They are not predicted yields or profits."],
];

export function render(el, ctx) {
  const { parcel } = ctx.data;
  const sources = parcel.sources || [];

  el.innerHTML = `
    ${heroHTML(ctx, "Every number in DeepKore comes from open NASA data. Here is where it comes from, and what it cannot tell you.")}

    <section>
      ${blockHead("NASA data we use", `Historical period: ${parcel.period}.`)}
      <ul class="src-list">
        ${sources.map((s) => `<li class="src reveal">
          <div class="src__icon">${icon(ICON.data, 26)}</div>
          <div>
            <h3><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.dataset)}</a>${icon(ICON.ext, 15)}</h3>
            <p>${esc(s.role)}</p>
            <div class="chips">
              <span class="chip">Resolution: ${esc(s.resolution)}</span>
              <span class="chip">Version: ${esc(s.version)}</span>
              <span class="chip">${esc(s.license)}</span>
              ${provBadge(parcel.provenance)}
            </div>
          </div>
        </li>`).join("")}
      </ul>
    </section>

    <section class="block">
      ${blockHead("What the labels mean", "Each number carries one of these labels, plus the dataset behind it.")}
      <ul class="legend-list">
        ${LABELS.map(([l, d]) => `<li class="reveal">${provBadge(l)}<p>${esc(d)}</p></li>`).join("")}
      </ul>
    </section>

    <section class="block">
      ${blockHead("Limits", "DeepKore supports your decision. It does not replace your agronomist.")}
      <ol class="lim-list">
        ${LIMITS.map(([t, d], i) => `<li class="reveal"><span class="n">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join("")}
      </ol>
      <p class="caption"><span class="pill pill--draft">Draft</span> List to be reviewed by the team.</p>
    </section>

    ${nextHTML(ctx.next)}
  `;
}
