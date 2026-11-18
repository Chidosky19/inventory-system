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
    /**
     * Show a message next to a form or table. Success messages pop up in the corner and fade away
     * on their own; errors and hints stay in place, next to what needs fixing.
     */
    setMessage(element, text = "", type = "danger") {
        if (!element) return;

        if (text && type === "success") {
            Utils.toast(text, "success");
            element.textContent = "";
            element.className = "";
            return;
        }

        element.textContent = text;
        element.className = text ? `text-${type}` : "";
    },

    /** A small pop-up notice in the corner of the screen. type: "success", "danger" or "info". */
    toast(text, type = "info") {
        let stack = document.querySelector(".toast-stack");

        if (!stack) {
            stack = document.createElement("div");
            stack.className = "toast-stack";
            stack.setAttribute("role", "region");
            stack.setAttribute("aria-live", "polite");
            document.body.appendChild(stack);
        }

        const icons = { success: "bi-check-circle-fill", danger: "bi-exclamation-triangle-fill", info: "bi-info-circle-fill" };

        const toast = document.createElement("div");
        toast.className = `ui-toast is-${type}`;

        const icon = document.createElement("i");
        icon.className = `bi ${icons[type] || icons.info}`;

        const message = document.createElement("span");
        message.textContent = text;

        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Dismiss");
        close.textContent = "×";

        toast.append(icon, message, close);
        stack.appendChild(toast);

        let timer;

        const dismiss = () => {
            clearTimeout(timer);
            toast.classList.add("is-leaving");
            setTimeout(() => toast.remove(), 200);
        };

        close.addEventListener("click", dismiss);
        timer = setTimeout(dismiss, type === "danger" ? 7000 : 4500);
    },

    /**
     * A proper confirmation box instead of the plain browser one.
     * Usage:  if (!(await Utils.confirm({ title: "Delete this?", message: "...", danger: true }))) return;
     */
    confirm({ title = "Are you sure?", message = "", confirmText = "Confirm", cancelText = "Cancel", danger = false } = {}) {
        if (typeof HTMLDialogElement === "undefined") {
            return Promise.resolve(window.confirm(message ? `${title}\n${message}` : title));
        }

        return new Promise(resolve => {
            const dialog = document.createElement("dialog");
            dialog.className = `ui-confirm${danger ? " is-danger" : ""}`;

            const body = document.createElement("div");
            body.className = "ui-confirm-body";

            const icon = document.createElement("div");
            icon.className = "ui-confirm-icon";
            icon.innerHTML = `<i class="bi ${danger ? "bi-trash3" : "bi-question-circle"}"></i>`;

            const text = document.createElement("div");
            const heading = document.createElement("h3");
            heading.textContent = title;
            text.appendChild(heading);

            if (message) {
                const paragraph = document.createElement("p");
                paragraph.textContent = message;
                text.appendChild(paragraph);
            }

            body.append(icon, text);

            const actions = document.createElement("div");
            actions.className = "ui-confirm-actions";

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "ui-btn ui-btn-ghost";
            cancel.textContent = cancelText;

            const confirmButton = document.createElement("button");
            confirmButton.type = "button";
            confirmButton.className = `ui-btn ${danger ? "ui-btn-danger" : "ui-btn-primary"}`;
            confirmButton.textContent = confirmText;

            actions.append(cancel, confirmButton);
            dialog.append(body, actions);

            let result = false;

            cancel.addEventListener("click", () => dialog.close());
            confirmButton.addEventListener("click", () => { result = true; dialog.close(); });
            dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
            dialog.addEventListener("close", () => { dialog.remove(); resolve(result); });

            document.body.appendChild(dialog);
            dialog.showModal();

            // For a delete, the safe button (Cancel) has the focus so Enter can't delete by accident
            (danger ? cancel : confirmButton).focus();
        });
    },

    /** Replace the contents of a table body with a single full-width message row. */
    /** Grey placeholder rows that shimmer while a table loads. */
    showTableSkeleton(tbody, colspan, rows = 5) {
        const widths = [62, 84, 46, 72, 56, 90, 50, 76];

        const items = Array.from({ length: rows }, (_, rowIndex) => {
            const row = document.createElement("tr");

            for (let column = 0; column < colspan; column += 1) {
                const cell = document.createElement("td");
                const bar = document.createElement("span");

                bar.className = "skeleton";
                bar.style.width = `${widths[(rowIndex + column) % widths.length]}%`;
                cell.appendChild(bar);
                row.appendChild(cell);
            }

            return row;
        });

        tbody.replaceChildren(...items);
    },

    /** Replace a table's rows with one message. "Loading..." becomes placeholders; empty and error messages get an icon. */
    setTableMessage(tbody, colspan, text) {
        const message = String(text);

        if (/^loading\b/i.test(message)) {
            Utils.showTableSkeleton(tbody, colspan);
            return;
        }

        const isError = /^(unable|failed|could not|couldn't)/i.test(message);

        const row = document.createElement("tr");
        const cell = document.createElement("td");
        const box = document.createElement("div");
        const icon = document.createElement("i");
        const paragraph = document.createElement("p");

        cell.colSpan = colspan;
        cell.className = "empty-cell";
        box.className = `empty-state${isError ? " is-error" : ""}`;
        icon.className = `bi ${isError ? "bi-exclamation-triangle" : "bi-inbox"}`;
        paragraph.textContent = message;

        box.append(icon, paragraph);
        cell.appendChild(box);
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


/* ---------- Money amounts keep the original font (see .amount in ui.css) ---------- */

/**
 * Keeps money amounts (₦12,500) in the site's original font while the rest of the text uses Roboto Mono.
 * It wraps each amount in <span class="amount"> as pages draw their tables, cards and messages.
 */
(function () {
    "use strict";

    // A ₦ followed by digits (₦12,500 or ₦12,500.00), or a lone ₦ such as in "Price (₦)"
    const MONEY = /₦\s?\d[\d,]*(?:\.\d+)?|₦/g;
    const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CANVAS", "NOSCRIPT"]);

    function wrapAmounts(textNode) {
        const text = textNode.nodeValue;

        if (!text || text.indexOf("₦") === -1) return;

        const parent = textNode.parentElement;

        if (!parent || SKIP.has(parent.tagName.toUpperCase()) || parent.closest(".amount")) return;

        const fragment = document.createDocumentFragment();
        let last = 0;
        let match;

        MONEY.lastIndex = 0;

        while ((match = MONEY.exec(text))) {
            if (match.index > last) {
                fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
            }

            const span = document.createElement("span");
            span.className = "amount";
            span.textContent = match[0];
            fragment.appendChild(span);

            last = match.index + match[0].length;
        }

        if (!fragment.hasChildNodes()) return;

        if (last < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(last)));
        }

        textNode.replaceWith(fragment);
    }

    function scan(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            wrapAmounts(node);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const found = [];

        while (walker.nextNode()) found.push(walker.currentNode);

        found.forEach(wrapAmounts);
    }

    scan(document.body);

    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === "characterData") {
                scan(mutation.target);
            } else {
                mutation.addedNodes.forEach(scan);
            }
        });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
