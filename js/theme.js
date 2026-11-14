// Light / dark theme switch. The initial theme is applied by the inline script in index.html.
// Views that draw with canvas or tiles (charts, map) listen for "deepkore:theme" to redraw.

const KEY = "deepkore-theme";
const BAR = { light: "#f2f2f7", dark: "#000000" };

export function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme, save) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[theme]);
  document.querySelectorAll(".theme-toggle").forEach((b) =>
    b.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme")
  );
  if (save) {
    try { localStorage.setItem(KEY, theme); } catch { /* private mode: choice just isn't remembered */ }
  }
  document.dispatchEvent(new CustomEvent("deepkore:theme", { detail: { theme } }));
}

export function initTheme() {
  apply(currentTheme(), false);
  document.querySelectorAll(".theme-toggle").forEach((b) =>
    b.addEventListener("click", () => apply(currentTheme() === "dark" ? "light" : "dark", true))
  );
  // Follow the device setting only while the user has not chosen explicitly.
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (!saved) apply(e.matches ? "dark" : "light", false);
  });
}
