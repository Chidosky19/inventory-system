/**
 * Theme (light / dark) handling.
 * Loaded in <head> so the saved theme is applied before the page paints,
 * which prevents a flash of the wrong theme.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "theme";
    const root = document.documentElement;

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || "light";
        } catch (error) {
            return "light";
        }
    }

    function applyTheme(theme) {
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-bs-theme", theme); // lets Bootstrap components follow the theme
    }

    function updateIcon(button) {
        const icon = button.querySelector("i");
        if (icon) {
            icon.className = root.getAttribute("data-theme") === "dark" ? "bi bi-sun" : "bi bi-moon";
        }
    }

    applyTheme(getSavedTheme());

    document.addEventListener("DOMContentLoaded", function () {
        const button = document.getElementById("themeToggle");
        if (!button) return;

        updateIcon(button);

        button.addEventListener("click", function () {
            const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

            applyTheme(next);

            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (error) {
                /* storage unavailable: theme still applies for this visit */
            }

            updateIcon(button);
        });
    });
})();
