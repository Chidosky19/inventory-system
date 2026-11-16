/**
 * Dashboard page: summary statistics, income by day and low-stock alerts.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const lowStockTable = $("lowStockTable");
    const message = $("message");

    function renderStats(stats) {
        $("totalProducts").textContent = stats.totalProducts;
        $("totalStock").textContent = stats.totalStock;
        $("totalSales").textContent = stats.totalSales;
        $("totalRevenue").textContent = Utils.formatMoney(stats.totalRevenue);
        $("lowStockCount").textContent = `${stats.lowStockCount} Alerts`;
    }

    function renderLowStock(products) {
        if (!products || products.length === 0) {
            Utils.setTableMessage(lowStockTable, 4, "No low stock products found.");
            return;
        }

        const rows = products.map(product => {
            const name = product.product_name
                ? (product.brand ? `${product.product_name} - ${product.brand}` : product.product_name)
                : product.id;

            const row = Utils.createRow([name, product.quantity, product.low_stock_limit]);

            const badge = document.createElement("span");
            badge.className = "status-low";
            badge.textContent = "Low Stock";
            Utils.appendCell(row, badge);

            return row;
        });

        lowStockTable.replaceChildren(...rows);
    }

    /* ---------- Income ---------- */

    /** Add up income and number of sales for every day from `from` to `to` (inclusive). */
    function incomeBetween(days, from, to) {
        let income = 0;
        let sales = 0;

        for (const day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
            const entry = days.get(Utils.dayKey(day));

            if (entry) {
                income += entry.income;
                sales += entry.sales;
            }
        }

        return { income, sales };
    }

    function showIncome(idPrefix, result) {
        $(idPrefix).textContent = Utils.formatMoney(result.income);
        $(`${idPrefix}Sales`).textContent = `${result.sales} sale${result.sales === 1 ? "" : "s"}`;
    }

    /* ---------- Sales trend (last 7 days) and top sellers (last 30 days) ---------- */

    let trendChart = null;

    function isDark() {
        return document.documentElement.getAttribute("data-theme") === "dark";
    }

    function chartColours() {
        return isDark()
            ? { text: "#9aa6c4", grid: "rgba(255, 255, 255, 0.08)", line: "#818cf8", fill: "rgba(129, 140, 248, 0.16)" }
            : { text: "#64708f", grid: "rgba(15, 23, 42, 0.06)", line: "#4f46e5", fill: "rgba(79, 70, 229, 0.10)" };
    }

    /** 1,500,000 -> 1.5M, 25,000 -> 25k, so the axis stays short. */
    function shortMoney(value) {
        if (value >= 1000000) return `${CONFIG.CURRENCY}${+(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${CONFIG.CURRENCY}${+(value / 1000).toFixed(1)}k`;
        return `${CONFIG.CURRENCY}${value}`;
    }

    function lastDays(count) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: count }, (_, index) => {
            const day = new Date(today);
            day.setDate(today.getDate() - (count - 1 - index));
            return day;
        });
    }

    function drawTrend(days) {
        const week = lastDays(7);
        const labels = week.map(day => day.toLocaleDateString(CONFIG.LOCALE, { weekday: "short", day: "numeric" }));
        const values = week.map(day => (days.get(Utils.dayKey(day)) || { income: 0 }).income);

        $("trendTotal").textContent = Utils.formatMoney(values.reduce((sum, value) => sum + value, 0));

        if (typeof Chart === "undefined") return;

        const colours = chartColours();

        if (trendChart) trendChart.destroy();

        Chart.defaults.font.family = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

        trendChart = new Chart($("trendChart"), {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Income",
                    data: values,
                    borderColor: colours.line,
                    backgroundColor: colours.fill,
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: colours.line,
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: item => ` ${Utils.formatMoney(item.parsed.y)}` } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: colours.text } },
                    y: {
                        beginAtZero: true,
                        grid: { color: colours.grid },
                        ticks: { color: colours.text, maxTicksLimit: 5, callback: value => shortMoney(value) }
                    }
                }
            }
        });
    }

    function drawTopSellers(sales) {
        const list = $("topProducts");
        const since = lastDays(30)[0];
        const totals = new Map();

        sales.forEach(sale => {
            if (new Date(sale.created_at) < since) return;

            const key = sale.product_id;
            const entry = totals.get(key) || {
                name: (sale.products && sale.products.product_name) || "Unknown product",
                units: 0,
                revenue: 0
            };

            entry.units += Number(sale.quantity);
            entry.revenue += Number(sale.total_price);
            totals.set(key, entry);
        });

        const top = [...totals.values()].sort((a, b) => b.units - a.units).slice(0, 5);

        if (top.length === 0) {
            const item = document.createElement("li");
            const box = document.createElement("div");
            const icon = document.createElement("i");
            const text = document.createElement("p");

            box.className = "empty-state";
            icon.className = "bi bi-bar-chart";
            text.textContent = "No sales in the last 30 days yet. Your best sellers will appear here.";
            box.append(icon, text);
            item.appendChild(box);
            list.replaceChildren(item);
            return;
        }

        const most = top[0].units;

        list.replaceChildren(...top.map((product, index) => {
            const item = document.createElement("li");
            item.className = "top-item";

            const rank = document.createElement("span");
            rank.className = "top-rank";
            rank.textContent = index + 1;

            const name = document.createElement("span");
            name.className = "top-name";
            name.textContent = product.name;

            const units = document.createElement("span");
            units.className = "top-units";
            units.textContent = `${product.units} sold`;

            const bar = document.createElement("div");
            bar.className = "top-bar";
            const fill = document.createElement("span");
            fill.style.width = `${Math.max(6, Math.round((product.units / most) * 100))}%`;
            bar.appendChild(fill);

            const revenue = document.createElement("div");
            revenue.className = "top-revenue";
            revenue.textContent = Utils.formatMoney(product.revenue);

            item.append(rank, name, units, bar, revenue);
            return item;
        }));
    }

    // Redraw the chart in the right colours when the theme button is used
    let incomeByDay = new Map();

    new MutationObserver(() => {
        if (trendChart) {
            drawTrend(incomeByDay);
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    async function loadIncome() {
        try {
            const { sales = [] } = await Api.getSales();
            const days = Utils.groupByDay(sales);

            incomeByDay = days;
            drawTrend(days);
            drawTopSellers(sales);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - 6);

            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            showIncome("incomeToday", incomeBetween(days, today, today));
            showIncome("incomeYesterday", incomeBetween(days, yesterday, yesterday));
            showIncome("incomeWeek", incomeBetween(days, weekStart, today));
            showIncome("incomeMonth", incomeBetween(days, monthStart, today));
        } catch (error) {
            console.error(error);
            ["incomeToday", "incomeYesterday", "incomeWeek", "incomeMonth"].forEach(id => {
                $(id).textContent = "--";
            });

            const failed = document.createElement("li");
            failed.className = "empty-state is-error";
            failed.innerHTML = '<i class="bi bi-exclamation-triangle"></i><p>Unable to load sales.</p>';
            $("topProducts").replaceChildren(failed);
        }
    }

    async function loadDashboard() {
        loadIncome();

        Utils.setMessage(message, "Loading dashboard...", "muted");

        try {
            const result = await Api.getDashboard();

            renderStats(result.statistics);
            renderLowStock(result.lowStockProducts);

            Utils.setMessage(message);
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }

    $("refreshBtn").addEventListener("click", loadDashboard);

    loadDashboard();
})();
