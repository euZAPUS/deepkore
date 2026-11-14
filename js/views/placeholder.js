// Temporary screen used until each section gets its real view (next prompts).
// Shows what the screen will contain and checks that its data files loaded.
import { esc } from "../ui.js";

export function render(el, { section, sectionIndex, sectionCount, next, problems }) {
  const status = section.files
    .map((name) => {
      const bad = problems[name]?.length;
      return `<span><i class="dot${bad ? " dot--bad" : ""}"></i>${esc(name)}.json ${bad ? `· ${bad} issue(s)` : "loaded"}</span>`;
    })
    .join("");

  el.innerHTML = `
    <section class="hero">
      <p class="hero__eyebrow reveal">${String(sectionIndex + 1).padStart(2, "0")} / ${String(sectionCount).padStart(2, "0")}</p>
      <h1 class="reveal" tabindex="-1">${esc(section.title)}</h1>
      <p class="hero__lead reveal">${esc(section.intro)}</p>
    </section>

    <ol class="steps">
      ${section.planned.map((p, i) => `<li class="reveal"><span class="steps__n">${i + 1}</span><span>${esc(p)}</span></li>`).join("")}
    </ol>

    ${status ? `<div class="data-status reveal">${status}</div>` : ""}

    ${next ? `<div class="next-step reveal"><p>Next</p><a class="link-arrow" href="#/${next.id}">${esc(next.title)}</a></div>` : ""}
  `;
}
