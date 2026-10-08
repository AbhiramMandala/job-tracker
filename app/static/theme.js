/* Theme toggle: persists to localStorage, falls back to prefers-color-scheme
   (the inline head script already applied the initial theme). */
(function () {
  var STORAGE_KEY = "jobsetu-theme";
  var button = document.getElementById("theme-toggle");
  if (!button) return;

  function current() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark" : "light";
  }

  function render() {
    var theme = current();
    var dark = theme === "dark";
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    button.setAttribute("aria-label",
      dark ? "Switch to light theme" : "Switch to dark theme");
    button.textContent = dark ? "☀️" : "🌙";
  }

  button.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode */ }
    render();
  });

  render();
})();
