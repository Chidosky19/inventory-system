/**
 * Reports page: revenue summary, daily income, best sellers and charts.
 * Requires Chart.js (loaded by reports.html).
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const money = amount => Utils.formatMoney(amount, 2);

    let allSales = [];
    let salesChart = null;
    let productsChart = null;


    /* ---------- Summary ---------- */

    function renderSummary(sales) {
        $("reportRevenue").textContent = money(Utils.sumBy(sales, "total_price"));
        $("reportSales").textContent = sales.length;
        $("reportProductsSold").textContent = Utils.sumBy(sales, "quantity");
    }


    /* ---------- Tables ---------- */

    /** Total quantity and revenue per product, best seller first. */
    function groupByProduct(sales) {
        const totals = new Map();

        sales.forEach(sale => {
            const entry = totals.get(sale.product_id) || {
                name: sale.products?.product_name || "Unknown Product",
                brand: sale.products?.brand || "-",
                quantity: 0,
                revenue: 0
            };

            entry.quantity += Number(sale.quantity);
            entry.revenue += Number(sale.total_price);

            totals.set(sale.product_id, entry);
        });

        return [...totals.values()].sort((a, b) => b.quantity - a.quantity);
    }

    function renderBestSelling(sales) {
        const table = $("bestSellingTable");

        if (sales.length === 0) {
            Utils.setTableMessage(table, 4, "No sales recorded yet.");
            return;
        }

        const rows = groupByProduct(sales).map(product => Utils.createRow([
            product.name,
            product.brand,
            product.quantity,
            money(product.revenue)
        ]));

        table.replaceChildren(...rows);
    }


    /* ---------- Charts ---------- */

    // Chart labels are mostly amounts, so they keep the original font
    if (typeof Chart !== "undefined") Chart.defaults.font.family = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

    /** Revenue per day, oldest first. */
    function groupRevenueByDay(sales) {
        const days = new Map();

        sales.forEach(sale => {
            const day = new Date(sale.created_at);
            day.setHours(0, 0, 0, 0);

            const key = day.getTime();
            days.set(key, (days.get(key) || 0) + Number(sale.total_price));
        });

        return [...days.entries()].sort(([a], [b]) => a - b);
    }

    function renderSalesChart(sales) {
        if (salesChart) salesChart.destroy();

        const days = groupRevenueByDay(sales);

        salesChart = new Chart($("salesChart"), {
            type: "line",
            data: {
                labels: days.map(([time]) => Utils.formatDate(time)),
                datasets: [{
                    label: "Sales Revenue (₦)",
                    data: days.map(([, revenue]) => revenue),
                    borderWidth: 3,
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true } }
            }
        });
    }

    function renderProductsChart(sales) {
        if (productsChart) productsChart.destroy();

        const products = groupByProduct(sales);

        productsChart = new Chart($("productsChart"), {
            type: "doughnut",
            data: {
                labels: products.map(product => product.name),
                datasets: [{
                    label: "Quantity Sold",
                    data: products.map(product => product.quantity)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }


    /* ---------- Daily income ---------- */

    const MAX_DAYS = 366;

    /** "2026-11-12" from a date input -> a Date at local midnight. */
    function parseInputDate(value) {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    function inputValue(date) {
        return Utils.dayKey(date);
    }

    function setRange(from, to) {
        $("dailyFrom").value = inputValue(from);
        $("dailyTo").value = inputValue(to);
        renderDaily();
    }

    /** One entry per day in the chosen range (including days with no sales), newest first. */
    function dailyRows() {
        const from = $("dailyFrom").value;
        const to = $("dailyTo").value;

        if (!from || !to) return { error: "Choose a start and an end date." };

        const start = parseInputDate(from);
        const end = parseInputDate(to);

        if (start > end) return { error: "The start date must be before the end date." };

        if ((end - start) / 86400000 >= MAX_DAYS) return { error: `Please choose a range of up to ${MAX_DAYS} days.` };

        const totals = Utils.groupByDay(allSales);
        const rows = [];

        for (const day = new Date(end); day >= start; day.setDate(day.getDate() - 1)) {
            const entry = totals.get(Utils.dayKey(day)) || { sales: 0, items: 0, income: 0 };
            rows.push({ date: new Date(day), ...entry });
        }

        return { rows };
    }

    function renderDaily() {
        const table = $("dailyTable");
        const summary = $("dailySummary");
        const { rows, error } = dailyRows();

        if (error) {
            Utils.setTableMessage(table, 4, error);
            summary.textContent = "";
            return;
        }

        const todayKey = Utils.dayKey(new Date());

        table.replaceChildren(...rows.map(day => {
            const row = Utils.createRow([
                day.date.toLocaleDateString(CONFIG.LOCALE, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
                day.sales,
                day.items,
                money(day.income)
            ]);

            if (Utils.dayKey(day.date) === todayKey) {
                const badge = Utils.createBadge("Today", "primary");
                badge.classList.add("ms-2");
                row.firstChild.appendChild(badge);
            }

            if (day.sales === 0) row.classList.add("text-muted");

            return row;
        }));

        const income = rows.reduce((sum, day) => sum + day.income, 0);
        const sales = rows.reduce((sum, day) => sum + day.sales, 0);
        const best = rows.reduce((top, day) => (day.income > top.income ? day : top), rows[0]);

        summary.textContent = sales === 0
            ? "No sales in these days."
            : `${money(income)} from ${sales} sale${sales === 1 ? "" : "s"}. Best day: ${Utils.formatDate(best.date)} (${money(best.income)}).`;
    }

    function exportDaily() {
        const { rows, error } = dailyRows();

        if (error || rows.length === 0) {
            alert(error || "There is nothing to export.");
            return;
        }

        Utils.downloadCsv(
            `daily-income-${$("dailyFrom").value}-to-${$("dailyTo").value}.csv`,
            ["Date", "Sales", "Items sold", "Income"],
            rows.map(day => [Utils.dayKey(day.date), day.sales, day.items, day.income])
        );
    }

    function quickRange(kind) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = new Date(today);

        if (kind === "7") start.setDate(today.getDate() - 6);
        if (kind === "30") start.setDate(today.getDate() - 29);
        if (kind === "month") start.setDate(1);

        setRange(start, today);
    }


    /* ---------- Page ---------- */

    function renderReports(sales) {
        renderSummary(sales);
        renderBestSelling(sales);
        renderSalesChart(sales);
        renderProductsChart(sales);
    }

    /** Sales that fall inside the selected date range ("all", "today", "7" or "30" days). */
    function filterByDate(sales, range) {
        if (range === "all") return sales;

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        if (range !== "today") {
            start.setDate(start.getDate() - (Number(range) - 1));
        }

        return sales.filter(sale => new Date(sale.created_at) >= start);
    }

    async function loadReports() {
        try {
            const result = await Api.getSales();
            allSales = result.sales || [];

            renderReports(filterByDate(allSales, $("dateFilter").value));
            renderDaily();
        } catch (error) {
            console.error(error);
            Utils.setTableMessage($("bestSellingTable"), 4, "Unable to load reports.");
            Utils.setTableMessage($("dailyTable"), 4, "Unable to load daily income.");
        }
    }

    $("dateFilter").addEventListener("change", event => {
        renderReports(filterByDate(allSales, event.target.value));
    });

    $("dailyFrom").addEventListener("change", renderDaily);
    $("dailyTo").addEventListener("change", renderDaily);
    $("exportDaily").addEventListener("click", exportDaily);

    document.querySelectorAll("[data-range]").forEach(button => {
        button.addEventListener("click", () => quickRange(button.dataset.range));
    });

    // Start with the last 30 days (this also sets the date boxes)
    const today = new Date();
    $("dailyTo").max = inputValue(today);
    $("dailyFrom").max = inputValue(today);
    quickRange("30");

    loadReports();
})();
