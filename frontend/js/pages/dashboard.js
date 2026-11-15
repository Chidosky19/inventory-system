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

    async function loadIncome() {
        try {
            const { sales = [] } = await Api.getSales();
            const days = Utils.groupByDay(sales);

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
