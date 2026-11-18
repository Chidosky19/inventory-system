/**
 * Tables on the admin pages:
 *   - a table that starts with a "Loading..." line shows shimmering placeholder rows instead
 *   - on phones, tables marked .stack-table turn into cards, so every cell is labelled with its column heading
 */
document.addEventListener("DOMContentLoaded", function () {
    /* ---- Tables that start with a "Loading..." line show shimmering placeholders instead ---- */
    if (typeof Utils !== "undefined") {
        document.querySelectorAll("tbody").forEach(tbody => {
            const cell = tbody.querySelector("tr > td[colspan]");

            if (tbody.children.length === 1 && cell && /^\s*loading\b/i.test(cell.textContent)) {
                Utils.showTableSkeleton(tbody, Number(cell.getAttribute("colspan")));
            }
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
