"use strict";

/* Light / dark theme button.
 * The page is light by default (whatever the system setting is). Pressing "Dark" sets
 * data-theme="dark" on <html>, which swaps the CSS variables, and the choice is remembered.
 * A tiny inline script in index.html applies a saved choice before first paint. */

const THEME_KEY = "mochi-cards:theme";
const themeToggleBtn = document.getElementById("theme-toggle");

function isDark() {
  return document.documentElement.dataset.theme === "dark";
}

function renderThemeToggle() {
  const dark = isDark();
  themeToggleBtn.setAttribute("aria-pressed", String(dark));
  // The label stays "Dark"; aria-pressed carries the on/off state (only the icon changes)
  themeToggleBtn.querySelector(".theme-icon").textContent = dark ? "☀️" : "🌙";
}

themeToggleBtn.addEventListener("click", () => {
  const dark = !isDark();
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // not saved, still works for this visit
  }
  renderThemeToggle();
});

renderThemeToggle();
