// Shown instead of a screen while its data files have not been delivered yet.
import { esc, viewHead } from "../ui.js";

export function render(el, { section, data }) {
  const files = section.files.map((f) => ({ name: f, ok: !!data[f] }));
  el.innerHTML = `
    ${viewHead(section.title, section.intro)}
    <div class="view-body waiting">
      <section class="panel waiting__panel reveal">
        <div class="orbit" aria-hidden="true">
          <span class="orbit__planet"></span>
          <span class="orbit__ring"><span class="orbit__sat"></span></span>
        </div>
        <h2>Waiting for NASA data</h2>
        <p class="muted">This screen fills in automatically as soon as the data team adds its files.</p>
        <ul class="waiting__files">
          ${files.map((f) => `<li><i class="dot ${f.ok ? "dot--ok" : ""}"></i><code>data/${esc(f.name)}.json</code><span>${f.ok ? "ready" : "pending"}</span></li>`).join("")}
        </ul>
        <a class="btn btn--ghost" href="?mock#/${esc(section.id)}">Preview with sample data</a>
      </section>
    </div>
  `;
}
