/**
 * Small helpers shared by every page.
 */
const Utils = {

    /** Format a number as Naira, e.g. ₦12,500 (pass decimals = 2 for ₦12,500.00). */
    formatMoney(amount, decimals = 0) {
        return CONFIG.CURRENCY + Number(amount).toLocaleString(CONFIG.LOCALE, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    /** The local calendar day of a date as "YYYY-MM-DD". A sale at 00:30 belongs to that day, not the one before. */
    dayKey(value) {
        const date = new Date(value);
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${date.getFullYear()}-${month}-${day}`;
    },

    /** Group sales by day: a Map of "YYYY-MM-DD" -> { sales, items, income }. */
    groupByDay(sales) {
        const days = new Map();

        sales.forEach(sale => {
            const key = Utils.dayKey(sale.created_at);
            const entry = days.get(key) || { sales: 0, items: 0, income: 0 };

            entry.sales += 1;
            entry.items += Number(sale.quantity);
            entry.income += Number(sale.total_price);

            days.set(key, entry);
        });

        return days;
    },

    formatDate(value) {
        return new Date(value).toLocaleDateString(CONFIG.LOCALE);
    },

    /**
     * Download rows as a CSV file that opens in Excel. Text that starts with = + - or @
     * gets a leading apostrophe so a spreadsheet never runs it as a formula.
     */
    downloadCsv(filename, headers, rows) {
        const cell = value => {
            let text = value === null || value === undefined ? "" : String(value);

            if (typeof value === "string" && /^[=+\-@]/.test(text)) text = "'" + text;

            return '"' + text.replace(/"/g, '""') + '"';
        };

        const lines = [headers, ...rows].map(row => row.map(cell).join(","));
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    },

    /** Delay a function until the user stops triggering it (used for search boxes). */
    debounce(callback, wait = 250) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), wait);
        };
    },

    /** Show a short status message. type: "success" | "danger" | "muted" */
    setMessage(element, text = "", type = "danger") {
        if (!element) return;
        element.textContent = text;
        element.className = text ? `text-${type}` : "";
    },

    /** Replace the contents of a table body with a single full-width message row. */
    setTableMessage(tbody, colspan, text) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = colspan;
        cell.className = "text-center py-4";
        cell.textContent = text;

        row.appendChild(cell);
        tbody.replaceChildren(row);
    },

    /** Build a <tr> from plain values (uses textContent, so values are never parsed as HTML). */
    createRow(values) {
        const row = document.createElement("tr");

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        return row;
    },

    /** Build a Bootstrap badge, e.g. Utils.createBadge("Low Stock", "danger"). */
    createBadge(text, color) {
        const badge = document.createElement("span");
        badge.className = `badge bg-${color}`;
        badge.textContent = text;
        return badge;
    },

    /** Append a cell containing an element to an existing row. */
    appendCell(row, content) {
        const cell = document.createElement("td");
        cell.appendChild(content);
        row.appendChild(cell);
    },

    /** Sum a numeric field across a list. */
    sumBy(items, field) {
        return items.reduce((sum, item) => sum + Number(item[field]), 0);
    }
};
