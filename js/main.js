// App entry: loads data, builds navigation, routes between the 6 sections.
import { SECTIONS, DEFAULT_SECTION, HIDE_MOCK_STRIP } from "./config.js";
import { loadAll, anyMock } from "./data.js";
import { esc, icon } from "./ui.js";
import * as placeholder from "./views/placeholder.js";

// Section id -> view module ({ render(el, ctx) -> optional cleanup fn }).
// Real views replace the placeholder as they are built.
const VIEWS = {
  field: placeholder,
  risks: placeholder,
  rotations: placeholder,
  whatif: placeholder,
  data: placeholder,
  about: placeholder,
};

const main = document.getElementById("main");
let ctx = null;
let cleanup = null;

function buildNav() {
  document.getElementById("nav-list").innerHTML = SECTIONS.map(
    (s) => `<li><a href="#/${s.id}" data-id="${s.id}">${icon(s.icon)}
      <span class="nav-full">${esc(s.title)}</span><span class="nav-short">${esc(s.short)}</span></a></li>`
  ).join("");
}

function currentId() {
  const id = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return SECTIONS.some((s) => s.id === id) ? id : DEFAULT_SECTION;
}

function route() {
  const id = currentId();
  const section = SECTIONS.find((s) => s.id === id);

  document.querySelectorAll("#nav-list a").forEach((a) => {
    if (a.dataset.id === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${section.title} · DeepKore`;

  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  main.innerHTML = "";
  if (!ctx) return;

  cleanup = VIEWS[id].render(main, { ...ctx, section });
  window.scrollTo(0, 0);
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
  window.addEventListener("hashchange", route);
  try {
    const { data, problems } = await loadAll();
    ctx = { data, problems };
    document.getElementById("mock-strip").hidden = HIDE_MOCK_STRIP || !anyMock(data);
    showDataWarning(problems);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="card"><h1 tabindex="-1">Could not load the data</h1>
      <p>${esc(err.message)}</p>
      <p class="muted">If you opened <code>index.html</code> directly from disk, serve the folder instead:
      <code>python3 -m http.server 8000</code> and open <code>http://localhost:8000</code>.</p></div>`;
    return;
  }
  route();
}

start();
