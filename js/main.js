// App entry: loads data, builds navigation (sidebar + phone tab bar), routes between the 6 sections.
import { SECTIONS, DEFAULT_SECTION, HIDE_MOCK_STRIP } from "./config.js";
import { loadAll, anyMock, USING_MOCK } from "./data.js";
import { esc, icon } from "./ui.js";
import { revealIn } from "./motion.js";
import { initTheme } from "./theme.js";
import { store } from "./store.js";
import { analyse, loadCached, cancelAnalysis } from "./live.js";
import * as field from "./views/field.js";
import * as risks from "./views/risks.js";
import * as rotations from "./views/rotations.js";
import * as whatif from "./views/whatif.js";
import * as sources from "./views/sources.js";
import * as about from "./views/about.js";
import * as waiting from "./views/waiting.js";

// Section id -> view module ({ render(el, ctx) -> optional cleanup fn }).
const VIEWS = { field, risks, rotations, whatif, data: sources, about };
const WELCOME_KEY = "deepkore-welcome-seen";

const main = document.getElementById("main");
const navLists = [document.getElementById("nav-list"), document.getElementById("tab-list")];
let ctx = null;
let cleanup = null;
let baseData = null; // files from /data (pilot field) or /data/mock

function buildNav() {
  const html = SECTIONS.map(
    (s) => `<li><a href="#/${s.id}" data-id="${s.id}">${icon(s.icon, 22)}
      <span class="nav-full">${esc(s.nav ?? s.title)}</span><span class="nav-short">${esc(s.short)}</span></a></li>`
  ).join("");
  navLists.forEach((ul) => (ul.innerHTML = html));
  // tab bar shows short labels
  navLists[1].querySelectorAll(".nav-short").forEach((n) => (n.style.display = "inline"));
}

function currentId() {
  const id = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return SECTIONS.some((s) => s.id === id) ? id : DEFAULT_SECTION;
}

function route() {
  const id = currentId();
  const index = SECTIONS.findIndex((s) => s.id === id);
  const section = SECTIONS[index];

  navLists.forEach((ul) =>
    ul.querySelectorAll("a").forEach((a) => {
      if (a.dataset.id === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    })
  );
  document.title = `${section.title} · DeepKore`;

  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  main.innerHTML = "";
  if (!ctx) return;

  const view = document.createElement("div");
  view.className = "view";
  main.appendChild(view);
  const ready = section.files.every((f) => ctx.data[f]);
  const viewModule = ready ? VIEWS[id] : waiting; // a screen waits until all its data files exist
  cleanup = viewModule.render(view, { ...ctx, section, sectionIndex: index, next: SECTIONS[index + 1] ?? null });
  window.scrollTo({ top: 0, behavior: "instant" });
  revealIn(view);
  view.querySelector("h1")?.focus({ preventScroll: true });
}

function showDataWarning(problems) {
  const names = Object.keys(problems);
  if (!names.length) return;
  const box = document.getElementById("data-warning");
  box.hidden = false;
  box.textContent = `Data check: ${names.map((n) => `${n}.json`).join(", ")} do not fully match the data contract. Some parts may not display. Details in the browser console.`;
  console.warn("DeepKore data contract problems:", problems);
}

function initWelcome() {
  const dlg = document.getElementById("welcome");
  if (!dlg?.showModal) return;
  const open = () => { if (!dlg.open) dlg.showModal(); };
  document.querySelectorAll(".js-help").forEach((b) => b.addEventListener("click", open));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // tap outside closes
  dlg.addEventListener("close", () => { try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ } });
  let seen = false;
  try { seen = localStorage.getItem(WELCOME_KEY) === "1"; } catch { /* ignore */ }
  if (!seen && !new URLSearchParams(location.search).has("nowelcome")) setTimeout(open, 400);
}

/* ---------- field chosen on the map ---------- */
const STAGES = { download: "Downloading NASA POWER data", climate: "Computing climate and risks", scenarios: "Simulating scenarios" };
let statusEl = null;
function liveStatus(text, { busy = false, error = false, cancel = false } = {}) {
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.className = "live-status";
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    document.body.appendChild(statusEl);
  }
  if (!text) {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.classList.toggle("is-error", error);
  statusEl.innerHTML = `${busy ? '<span class="spinner" aria-hidden="true"></span>' : ""}<span>${esc(text)}</span>${
    cancel ? '<button type="button" class="btn-text" data-act="cancel">Cancel</button>' : '<button type="button" class="btn-text" data-act="close">OK</button>'
  }`;
  statusEl.querySelector("[data-act]").addEventListener("click", (e) => {
    if (e.currentTarget.dataset.act === "cancel") {
      cancelAnalysis();
      revertLocation();
    }
    liveStatus(null);
  });
}

let pendingPrev = null;
let pendingLoc = null;
// After a failed or cancelled analysis: back to the field shown before (pilot field if none).
function revertLocation() {
  store.set({ location: pendingPrev === pendingLoc ? null : pendingPrev });
  pendingLoc = null;
}
function useData(extra) {
  ctx.data = { ...baseData, ...(extra || {}) };
  route();
}

// loc: null = back to the pilot field; else { lat, lon, province }.
async function setLocation(loc, { refresh = false } = {}) {
  if (USING_MOCK) return;
  pendingPrev = store.get().location;
  pendingLoc = loc;
  if (!loc) {
    cancelAnalysis();
    store.set({ location: null });
    liveStatus(null);
    useData(null);
    return;
  }
  store.set({ location: loc });
  const cached = !refresh && loadCached(loc);
  if (cached) {
    useData(cached);
    return;
  }
  liveStatus(`${STAGES.download}…`, { busy: true, cancel: true });
  try {
    const data = await analyse(loc, ({ stage, done, total }) =>
      liveStatus(`${STAGES[stage]}${total > 1 ? ` (${done}/${total})` : ""}…`, { busy: true, cancel: true })
    );
    if (store.get().location !== loc) return; // superseded or cancelled
    liveStatus(null);
    useData(data);
  } catch (err) {
    console.error(err);
    if (store.get().location !== loc) return;
    revertLocation();
    route();
    liveStatus(`Could not analyse this point: ${err.message}`, { error: true });
  }
}

async function start() {
  buildNav();
  initTheme();
  window.addEventListener("hashchange", route);
  try {
    const { data, problems, missing } = await loadAll();
    baseData = data;
    ctx = { data, problems, missing, usingMock: USING_MOCK, setLocation };
    const mock = !HIDE_MOCK_STRIP && anyMock(data);
    document.querySelectorAll(".js-mock").forEach((p) => (p.hidden = !mock));
    showDataWarning(problems);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="view"><div class="panel"><h1 tabindex="-1">Could not load the data</h1>
      <p class="muted">${esc(err.message)}</p>
      <p class="muted">If you opened <code>index.html</code> directly from disk, serve the folder instead:
      <code>python3 -m http.server 8000</code> and open <code>http://localhost:8000</code>.</p></div></div>`;
    return;
  }
  const loc = store.get().location;
  if (loc && !USING_MOCK) {
    const cached = loadCached(loc);
    if (cached) ctx.data = { ...baseData, ...cached };
    else setLocation(loc); // shows the pilot field until the analysis is done
  }
  route();
  initWelcome();
}

start();
