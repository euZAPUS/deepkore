// App entry: loads data, builds navigation, routes between the 6 sections.
import { SECTIONS, DEFAULT_SECTION, HIDE_MOCK_STRIP } from "./config.js";
import { loadAll, anyMock } from "./data.js";
import { esc, icon } from "./ui.js";
import { revealIn, watchHeader, moveNavIndicator } from "./motion.js";
import { initTheme } from "./theme.js";
import * as field from "./views/field.js";
import * as risks from "./views/risks.js";
import * as rotations from "./views/rotations.js";
import * as whatif from "./views/whatif.js";
import * as sources from "./views/sources.js";
import * as about from "./views/about.js";

// Section id -> view module ({ render(el, ctx) -> optional cleanup fn }).
const VIEWS = { field, risks, rotations, whatif, data: sources, about };

const main = document.getElementById("main");
const navList = document.getElementById("nav-list");
let ctx = null;
let cleanup = null;

function buildNav() {
  navList.innerHTML = SECTIONS.map(
    (s) => `<li><a href="#/${s.id}" data-id="${s.id}">${icon(s.icon, 22)}
      <span class="nav-full">${esc(s.title)}</span><span class="nav-short">${esc(s.short)}</span></a></li>`
  ).join("");
}

function currentId() {
  const id = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return SECTIONS.some((s) => s.id === id) ? id : DEFAULT_SECTION;
}

function route() {
  const id = currentId();
  const index = SECTIONS.findIndex((s) => s.id === id);
  const section = SECTIONS[index];

  navList.querySelectorAll("a").forEach((a) => {
    if (a.dataset.id === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  moveNavIndicator(navList);
  document.title = `${section.title} · DeepKore`;

  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  main.innerHTML = "";
  if (!ctx) return;

  cleanup = VIEWS[id].render(main, {
    ...ctx,
    section,
    sectionIndex: index,
    sectionCount: SECTIONS.length,
    next: SECTIONS[index + 1] ?? null,
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  revealIn(main);
  main.querySelector("h1")?.focus({ preventScroll: true });
}

function showDataWarning(problems) {
  const names = Object.keys(problems);
  if (!names.length) return;
  const box = document.getElementById("data-warning");
  box.hidden = false;
  box.textContent = `Data check: ${names.map((n) => `${n}.json`).join(", ")} do not fully match the data contract. Some parts may not display. Details in the browser console.`;
  console.warn("DeepKore data contract problems:", problems);
}

async function start() {
  buildNav();
  initTheme();
  watchHeader(document.getElementById("app-header"));
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => moveNavIndicator(navList));
  document.fonts?.ready.then(() => moveNavIndicator(navList));
  try {
    const { data, problems } = await loadAll();
    ctx = { data, problems };
    document.getElementById("mock-strip").hidden = HIDE_MOCK_STRIP || !anyMock(data);
    showDataWarning(problems);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<section class="hero"><h1 tabindex="-1">Could not load the data</h1>
      <p class="hero__lead">${esc(err.message)}</p>
      <p class="hero__lead">If you opened <code>index.html</code> directly from disk, serve the folder instead:
      <code>python3 -m http.server 8000</code> and open <code>http://localhost:8000</code>.</p></section>`;
    return;
  }
  route();
}

start();
