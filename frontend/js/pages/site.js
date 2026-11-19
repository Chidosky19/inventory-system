/**
 * Script for the Support page: fills in the year and the shop name in the footer.
 */
(() => {
    "use strict";

    document.getElementById("year").textContent = new Date().getFullYear();

    // Shop name from config.js
    document.querySelectorAll("[data-site]").forEach(element => {
        const value = CONFIG.SITE[element.dataset.site];
        if (value) element.textContent = value;
    });
})();
