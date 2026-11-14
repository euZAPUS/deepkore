// Temporary screen used until each section gets its real view (next prompts).
// Shows what the screen will contain and checks that its data files loaded.
import { esc, provBadge } from "../ui.js";
import { fileProvenance } from "../data.js";

export function render(el, { section, data, problems }) {
  const files = section.files
    .map((name) => {
      const issues = problems[name]?.length ?? 0;
      return `<li>
        <code>data/${esc(name)}.json</code>
        <span>${issues ? `<span class="bad">${issues} contract issue(s)</span>` : '<span class="ok">Loaded ✓</span>'}
        ${provBadge(fileProvenance(data[name]))}</span>
      </li>`;
    })
    .join("");

  el.innerHTML = `
    <div class="page-head">
      <p class="eyebrow">DeepKore</p>
      <h1 tabindex="-1">${esc(section.title)}</h1>
      <p>${esc(section.intro)}</p>
    </div>
    <div class="grid grid--2">
      <section class="card">
        <h2>Coming in this screen</h2>
        <ul class="ticks">${section.planned.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </section>
      <section class="card">
        <h2>Data used</h2>
        ${files ? `<ul class="clean file-list">${files}</ul>` : '<p class="muted">This screen does not read data files.</p>'}
      </section>
    </div>
    <div class="placeholder" style="margin-top:16px">Screen under construction</div>
  `;
}
