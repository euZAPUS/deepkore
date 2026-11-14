// 06 About / AI declaration.
import { heroHTML, blockHead } from "../ui.js";

const REPO = "https://github.com/euZAPUS/deepkore";

export function render(el, ctx) {
  el.innerHTML = `
    ${heroHTML(ctx, "Choose the rotation that protects your soil, and prepare before the risk arrives.", "About DeepKore")}

    <section>
      ${blockHead("How it works")}
      <div class="how">
        <div class="reveal"><div class="how__n">1</div><h3>Tell us what matters</h3><p>Water, soil health, income and erosion. You set the weights.</p></div>
        <div class="reveal"><div class="how__n">2</div><h3>We read NASA data</h3><p>Climate, heavy rain and soil moisture for your field, from open satellite data.</p></div>
        <div class="reveal"><div class="how__n">3</div><h3>Compare and prepare</h3><p>See which rotation fits you best, why, and which weeks to watch out for.</p></div>
      </div>
    </section>

    <section class="block">
      ${blockHead("Why we built it")}
      <div class="prose reveal">
        <p>Built for the <b>NASA Space Apps Challenge 2026</b> in Málaga, challenge <b>“Field Shift: Adapting Farms with NASA Data”</b>.</p>
        <p class="muted">Rainfed farms in southern Spain have to plan around dry years, hot summers and heavy storms. DeepKore puts open NASA data in the hands of the farmer, in plain language, to help plan rotations that keep the soil alive.</p>
        <p class="muted">DeepKore supports the farmer's decision. It never makes it. Always check with your local agronomist.</p>
      </div>
    </section>

    <section class="block">
      ${blockHead("Team")}
      <div class="prose reveal" style="text-align:center">
        <p class="muted"><span class="pill pill--draft">Draft</span> Team members to be added.</p>
      </div>
    </section>

    <section class="block">
      ${blockHead("AI declaration")}
      <div class="prose reveal">
        <p><span class="pill pill--draft">Draft</span></p>
        <ul>
          <li>The code of this web app was written with <b>Claude Code</b> (Anthropic) and reviewed by the team.</li>
          <li>While the app was being built, AI generated <b>MOCK</b> placeholder data. It is labelled MOCK everywhere and is replaced by real NASA data before submission.</li>
          <li>Texts labelled <b>AI-inferred</b> were written by AI from the data. Read them as suggestions.</li>
          <li>The data processing: <i>to be completed by the team</i>.</li>
        </ul>
        <p class="muted" style="margin-top:16px">Full log: <a href="${REPO}/blob/main/AI_USAGE_LOG.md" target="_blank" rel="noopener">AI_USAGE_LOG.md</a> · Code: <a href="${REPO}" target="_blank" rel="noopener">GitHub</a></p>
      </div>
    </section>
  `;
}
