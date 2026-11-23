/**
 * Page layout behaviour for the admin pages: the mobile sidebar, today's date, and table helpers
 * (loading placeholders, and phone "card" tables where every cell is labelled with its column heading).
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

    /* ---- Table tools: a search box and "Show more" for long tables (add data-tools="..." to a <table>) ---- */
    const PAGE_SIZE = 15;

    document.querySelectorAll("table[data-tools]").forEach(table => {
        const body = table.querySelector("tbody");
        const holder = table.closest(".table-responsive") || table;
        let shown = PAGE_SIZE;

        if (!body) return;

        const tools = document.createElement("div");
        const search = document.createElement("input");
        const count = document.createElement("span");
        const more = document.createElement("button");

        tools.className = "table-tools";
        search.type = "search";
        search.className = "form-control";
        search.placeholder = table.dataset.tools;
        search.setAttribute("aria-label", table.dataset.tools.replace("...", ""));
        search.autocomplete = "off";
        count.className = "table-count";
        count.setAttribute("aria-live", "polite");
        more.type = "button";
        more.className = "btn btn-outline-primary btn-sm table-more";
        more.hidden = true;

        tools.append(search, count);
        holder.before(tools);
        holder.after(more);

        // Rows that hold real data (not the "Loading..." placeholders or an empty-state message)
        const dataRows = () => [...body.querySelectorAll("tr")].filter(row => !row.querySelector("td[colspan], .skeleton"));

        function apply() {
            const term = search.value.trim().toLowerCase();
            const rows = dataRows();
            let matches = 0;

            rows.forEach(row => {
                const isMatch = !term || row.textContent.toLowerCase().includes(term);

                if (isMatch) matches += 1;
                row.hidden = !(isMatch && matches <= shown);
            });

            tools.hidden = rows.length === 0;
            count.textContent = term ? `${matches} of ${rows.length}` : `${rows.length} in total`;
            more.hidden = matches <= shown;
            more.textContent = `Show more (${matches - shown} left)`;

            // A search with no result gets a clear message instead of an empty table
            let none = body.querySelector("tr.no-match");

            if (rows.length > 0 && matches === 0) {
                if (!none) {
                    none = document.createElement("tr");
                    none.className = "no-match";
                    none.innerHTML = '<td colspan="99" class="text-center text-muted py-4">Nothing matches your search.</td>';
                    body.appendChild(none);
                }
            } else if (none) {
                none.remove();
            }
        }

        search.addEventListener("input", () => { shown = PAGE_SIZE; apply(); });
        more.addEventListener("click", () => { shown += PAGE_SIZE; apply(); });
        new MutationObserver(apply).observe(body, { childList: true });
        apply();
    });

    /* ---- Skip link, back-to-top button, and links like products.html#add that open the Add Product box ---- */
    const main = document.querySelector(".main-content");

    if (main) {
        main.id = main.id || "main-content";
        main.tabIndex = -1;

        const skip = document.createElement("a");
        skip.className = "skip-link";
        skip.href = `#${main.id}`;
        skip.textContent = "Skip to content";
        document.body.prepend(skip);
    }

    const toTop = document.createElement("button");
    toTop.type = "button";
    toTop.className = "to-top";
    toTop.hidden = true;
    toTop.title = "Back to top";
    toTop.setAttribute("aria-label", "Back to top");
    toTop.innerHTML = '<i class="bi bi-arrow-up"></i>';
    toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    document.body.appendChild(toTop);
    window.addEventListener("scroll", () => { toTop.hidden = window.scrollY < 600; }, { passive: true });

    const addModal = document.getElementById("addProductModal");

    if (window.location.hash === "#add" && addModal && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(addModal).show();
    }
});
