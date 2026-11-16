/**
 * Behaviour shared by every page layout: mobile sidebar and today's date.
 */
document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const currentDate = document.getElementById("currentDate");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => sidebar.classList.toggle("show"));

        // Close the menu after choosing a page or tapping anywhere else
        document.addEventListener("click", event => {
            const clickedLink = event.target.closest("#sidebar a");
            const clickedOutside = !sidebar.contains(event.target) && !menuToggle.contains(event.target);

            if (clickedLink || clickedOutside) sidebar.classList.remove("show");
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") sidebar.classList.remove("show");
        });
    }

    if (currentDate) {
        currentDate.textContent = new Date().toLocaleDateString(CONFIG.LOCALE, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    /* ---- Phone tables: label every cell with its column heading (used by the stacked-card layout) ---- */
    document.querySelectorAll("table.stack-table").forEach(table => {
        const body = table.querySelector("tbody");
        const labels = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());

        if (!body) return;

        function addLabels() {
            body.querySelectorAll("tr").forEach(row => {
                [...row.children].forEach((cell, index) => {
                    if (!cell.hasAttribute("colspan") && labels[index] && !cell.dataset.label) {
                        cell.dataset.label = labels[index];
                    }
                });
            });
        }

        addLabels();
        new MutationObserver(addLabels).observe(body, { childList: true });
    });
});
