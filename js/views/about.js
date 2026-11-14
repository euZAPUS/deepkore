// 06 About / AI declaration.
import { viewHead, panelHead } from "../ui.js";

const REPO = "https://github.com/euZAPUS/deepkore";

export function render(el) {
  el.innerHTML = `
    ${viewHead("About DeepKore", "Choose the rotation that protects your soil, and prepare before the risk arrives.")}
    <div class="view-body g-about">
      <section class="panel how-panel reveal">
        ${panelHead("How it works")}
        <div class="how">
          <div><div class="how__n">1</div><h3>Tell us what matters</h3><p>Water, soil health, income and erosion. You set the weights.</p></div>
          <div><div class="how__n">2</div><h3>We read NASA data</h3><p>Climate, heavy rain and soil moisture for your field, from open satellite data.</p></div>
          <div><div class="how__n">3</div><h3>Compare and prepare</h3><p>See which rotation fits you best, why, and which weeks to watch.</p></div>
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("Why we built it")}
        <div class="prose">
          <p>Built for the <b>NASA Space Apps Challenge 2026</b> in Málaga, challenge <b>“Field Shift: Adapting Farms with NASA Data”</b>.</p>
          <p class="muted">Rainfed farms in southern Spain have to plan around dry years, hot summers and heavy storms. DeepKore puts open NASA data in the farmer's hands, in plain language.</p>
          <p class="muted">It supports the farmer's decision. It never makes it. Always check with your local agronomist.</p>
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("AI declaration", '<span class="pill pill--draft">Draft</span>')}
        <div class="prose">
          <ul>
            <li>The code of this web app was written with <b>Claude Code</b> (Anthropic) and reviewed by the team.</li>
            <li>While building, AI generated <b>MOCK</b> placeholder data. It is labelled MOCK everywhere and is replaced by real NASA data before submission.</li>
            <li>Texts labelled <b>AI-inferred</b> were written by AI from the data.</li>
            <li>Data processing: <i>to be completed by the team</i>.</li>
          </ul>
          <p class="muted" style="margin-top:12px">Full log: <a href="${REPO}/blob/main/AI_USAGE_LOG.md" target="_blank" rel="noopener">AI_USAGE_LOG.md</a></p>
        </div>
      </section>

      <section class="panel reveal">
        ${panelHead("Team", '<span class="pill pill--draft">Draft</span>')}
        <p class="muted">Team members to be added.</p>
      </section>

      <section class="panel reveal">
        ${panelHead("Open source")}
        <p class="muted">Code and data on <a href="${REPO}" target="_blank" rel="noopener">GitHub</a>. Map data © OpenStreetMap contributors; imagery © Esri. Charts: Chart.js. Maps: Leaflet.</p>
      </section>
    </div>
  `;
}
