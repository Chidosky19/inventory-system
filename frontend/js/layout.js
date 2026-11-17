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

    /* ---- Notifications: new sales, unread messages, employees waiting, low stock ---- */
    const topActions = document.querySelector(".top-actions");

    if (topActions && typeof Api !== "undefined") {
        const SEEN_KEY = "inventory.salesSeenAt";
        const baseTitle = document.title;
        let previous = null;   // what the last check found, so only genuinely new things pop up

        const wrap = document.createElement("div");
        wrap.className = "notif-wrap";
        wrap.innerHTML = `
            <button class="icon-button notif-bell" id="notifBell" type="button" title="Notifications"
                    aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
                <i class="bi bi-bell"></i>
                <span class="notif-count" id="notifCount" hidden>0</span>
            </button>
            <div class="notif-panel" id="notifPanel" role="region" aria-label="Notifications" hidden>
                <div class="notif-head">
                    <strong>Notifications</strong>
                    <button class="notif-mark" id="notifMark" type="button" hidden>Mark sales as seen</button>
                </div>
                <ul class="notif-list" id="notifList"></ul>
                <div class="notif-foot" id="notifFoot" hidden>
                    <button type="button" id="notifAllow"><i class="bi bi-bell"></i> Turn on desktop alerts</button>
                </div>
            </div>`;
        topActions.prepend(wrap);

        const bell = wrap.querySelector("#notifBell");
        const count = wrap.querySelector("#notifCount");
        const panel = wrap.querySelector("#notifPanel");
        const list = wrap.querySelector("#notifList");
        const markSeen = wrap.querySelector("#notifMark");
        const summary = document.getElementById("notifSummary");
        const foot = wrap.querySelector("#notifFoot");
        const allowAlerts = wrap.querySelector("#notifAllow");

        // Desktop alerts: shown by the browser even when this tab is in the background
        function updateAlertsButton() {
            foot.hidden = !("Notification" in window) || Notification.permission !== "default";
        }

        allowAlerts.addEventListener("click", async () => {
            try { await Notification.requestPermission(); } catch (error) { /* ignore */ }
            updateAlertsButton();
        });

        updateAlertsButton();

        /** Pop-up if the tab is open and in front, desktop notification if it is in the background. */
        function notifyUser(text) {
            if (!document.hidden) {
                if (typeof Utils.toast === "function") Utils.toast(text, "info");
                return;
            }

            if ("Notification" in window && Notification.permission === "granted") {
                try {
                    new Notification("Chidosky Electronics", { body: text, icon: "../favicon.svg" });
                } catch (error) { /* some phones only allow this from a service worker */ }
            }
        }

        function readSeen() {
            try {
                const value = localStorage.getItem(SEEN_KEY);
                return value ? new Date(value) : null;
            } catch (error) {
                return null;
            }
        }

        function writeSeen(date) {
            try { localStorage.setItem(SEEN_KEY, date.toISOString()); } catch (error) { /* private mode: ignore */ }
        }

        function timeAgo(date) {
            const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

            if (seconds < 60) return "just now";

            const minutes = Math.round(seconds / 60);
            if (minutes < 60) return `${minutes} min ago`;

            const hours = Math.round(minutes / 60);
            if (hours < 24) return `${hours} hr ago`;

            const days = Math.round(hours / 24);
            return `${days} day${days === 1 ? "" : "s"} ago`;
        }

        const plural = (number, word) => `${number} ${word}${number === 1 ? "" : "s"}`;
        const newest = (items, field) => [...items].sort((a, b) => new Date(b[field]) - new Date(a[field]))[0];

        function setNavBadge(href, number) {
            const link = document.querySelector(`#sidebar a[href="${href}"]`);

            if (!link) return;

            let badge = link.querySelector(".nav-badge");

            if (number <= 0) {
                if (badge) badge.remove();
                return;
            }

            if (!badge) {
                badge = document.createElement("span");
                badge.className = "nav-badge";
                link.appendChild(badge);
            }

            badge.textContent = number > 99 ? "99+" : number;
        }

        function render(found) {
            const items = [];

            if (found.freshSales.length) {
                const latest = newest(found.freshSales, "created_at");
                const product = (latest.products && latest.products.product_name) || "a product";
                const who = latest.sold_by ? ` by ${latest.sold_by}` : "";

                items.push({
                    icon: "bi-receipt", tone: "ok", href: "sales.html",
                    title: `${plural(found.freshSales.length, "new sale")} since you last checked`,
                    detail: `Latest: ${product} · ${Utils.formatMoney(latest.total_price)}${who} · ${timeAgo(new Date(latest.created_at))}`
                });
            }

            if (found.unread.length) {
                const latest = newest(found.unread, "created_at");

                items.push({
                    icon: "bi-envelope", tone: "info", href: "messages.html",
                    title: `${plural(found.unread.length, "unread message")}`,
                    detail: `Latest from ${latest.name || "a visitor"}${latest.topic ? " · " + latest.topic : ""} · ${timeAgo(new Date(latest.created_at))}`
                });
            }

            if (found.pending.length) {
                items.push({
                    icon: "bi-person-check", tone: "info", href: "employees.html",
                    title: `${plural(found.pending.length, "employee")} waiting for approval`,
                    detail: found.pending.map(employee => employee.name || employee.email).slice(0, 3).join(", ")
                });
            }

            if (found.lowStock > 0) {
                items.push({
                    icon: "bi-exclamation-triangle", tone: "warn", href: "stock.html",
                    title: `${plural(found.lowStock, "product")} need restocking`,
                    detail: found.outOfStock > 0 ? `${found.outOfStock} out of stock` : "At or below the minimum level"
                });
            }

            const total = found.freshSales.length + found.unread.length + found.pending.length + found.lowStock;

            // Bell badge and browser tab title
            count.hidden = total === 0;
            count.textContent = total > 99 ? "99+" : total;
            document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${baseTitle}` : baseTitle;

            // Menu badges
            setNavBadge("sales.html", found.freshSales.length);
            setNavBadge("messages.html", found.unread.length);
            setNavBadge("employees.html", found.pending.length);
            setNavBadge("stock.html", found.lowStock);

            // The list inside the bell
            const rows = items.length ? items.map(item => {
                const row = document.createElement("li");
                const link = document.createElement("a");
                const icon = document.createElement("span");
                const body = document.createElement("span");
                const title = document.createElement("strong");
                const detail = document.createElement("span");

                link.className = "notif-item";
                link.href = item.href;
                icon.className = `notif-icon is-${item.tone}`;
                icon.innerHTML = `<i class="bi ${item.icon}"></i>`;
                body.className = "notif-body";
                detail.className = "notif-detail";
                title.textContent = item.title;
                detail.textContent = item.detail;

                body.append(title, detail);
                link.append(icon, body);
                row.appendChild(link);
                return row;
            }) : [(() => {
                const row = document.createElement("li");
                row.className = "notif-empty";
                row.innerHTML = '<i class="bi bi-check2-circle"></i><span>You\'re all caught up.</span>';
                return row;
            })()];

            list.replaceChildren(...rows);
            markSeen.hidden = found.freshSales.length === 0;

            // The same items as clickable chips at the top of the dashboard
            if (summary) {
                const chips = items.length ? items.map(item => {
                    const chip = document.createElement("a");
                    chip.className = `notif-chip is-${item.tone}`;
                    chip.href = item.href;
                    chip.innerHTML = `<i class="bi ${item.icon}"></i>`;
                    chip.append(item.title.replace(" since you last checked", ""));
                    return chip;
                }) : (() => {
                    const chip = document.createElement("span");
                    chip.className = "notif-chip is-ok";
                    chip.innerHTML = '<i class="bi bi-check2-circle"></i>';
                    chip.append("Nothing new. You're all caught up.");
                    return [chip];
                })();

                summary.replaceChildren(...chips);
            }
        }

        const listOf = (result, key) => (result && Array.isArray(result[key])) ? result[key] : [];

        async function check() {
            const [dashboard, sales, messages, employees] = (await Promise.allSettled([
                Api.getDashboard(), Api.getSales(), Api.getMessages(), Api.getEmployees()
            ])).map(outcome => outcome.status === "fulfilled" ? outcome.value : null);

            const allSales = listOf(sales, "sales");
            const latestSale = allSales.length ? newest(allSales, "created_at") : null;
            const baseline = latestSale ? new Date(latestSale.created_at) : new Date();

            // The first visit starts from "now"; being on the Sales page counts as having seen everything
            let seen = readSeen();
            const onSalesPage = /sales(\.html)?$/.test(window.location.pathname);

            if (!seen || onSalesPage) {
                seen = baseline;
                writeSeen(seen);
            }

            const found = {
                freshSales: sales ? allSales.filter(sale => new Date(sale.created_at) > seen) : [],
                unread: listOf(messages, "messages").filter(message => !message.is_read),
                pending: listOf(employees, "employees").filter(employee => employee.pending),
                lowStock: dashboard && dashboard.statistics ? Number(dashboard.statistics.lowStockCount) || 0 : 0,
                outOfStock: dashboard ? listOf(dashboard, "lowStockProducts").filter(product => product.quantity <= 0).length : 0
            };

            // A notice for anything that arrived since the last check (not on the very first one)
            if (previous) {
                if (found.freshSales.length > previous.sales && found.freshSales.length) {
                    const latest = newest(found.freshSales, "created_at");
                    const product = (latest.products && latest.products.product_name) || "a product";
                    const who = latest.sold_by ? ` by ${latest.sold_by}` : "";
                    notifyUser(`New sale: ${product} · ${Utils.formatMoney(latest.total_price)}${who}`);
                }

                if (found.unread.length > previous.messages) {
                    const latest = newest(found.unread, "created_at");
                    notifyUser(`New message from ${latest.name || "a visitor"}`);
                }

                if (found.pending.length > previous.pending) {
                    notifyUser("A new employee is waiting for approval.");
                }
            }

            previous = { sales: found.freshSales.length, messages: found.unread.length, pending: found.pending.length };
            render(found);
        }

        function setOpen(open) {
            panel.hidden = !open;
            bell.setAttribute("aria-expanded", String(open));
        }

        bell.addEventListener("click", () => setOpen(panel.hidden));

        document.addEventListener("click", event => {
            if (!panel.hidden && !wrap.contains(event.target)) setOpen(false);
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !panel.hidden) {
                setOpen(false);
                bell.focus();
            }
        });

        markSeen.addEventListener("click", async () => {
            try {
                const result = await Api.getSales();
                const all = listOf(result, "sales");
                writeSeen(all.length ? new Date(newest(all, "created_at").created_at) : new Date());
            } catch (error) {
                writeSeen(new Date());
            }

            previous = null;
            check();
        });

        window.refreshNotifications = check;

        // Every 15 seconds ask the server one tiny question: the newest sale, how many messages are
        // unread and how many employees are waiting. Only when the answer changes do we run the full
        // check below, which also refreshes the low-stock numbers.
        let lastAlertKey = null;

        async function watchAlerts() {
            try {
                let key;

                try {
                    const alerts = await Api.getAlerts();
                    key = `${alerts.latestSale ? alerts.latestSale.id : "none"}:${alerts.totalSales}|${alerts.unreadMessages}|${alerts.pendingEmployees}`;
                } catch (error) {
                    // An older backend without /dashboard/alerts: at least watch for new sales
                    const result = await Api.getLatestSale();
                    key = `${result.latest ? result.latest.id : "none"}:${result.totalSales}`;
                }

                const changed = lastAlertKey !== null && key !== lastAlertKey;

                lastAlertKey = key;

                if (changed) check();
            } catch (error) { /* the full check below still runs every 2 minutes */ }
        }

        check();
        watchAlerts();
        setInterval(watchAlerts, 15000);
        setInterval(check, 120000);   // a safety net, and it refreshes the stock numbers
        document.addEventListener("visibilitychange", () => { if (!document.hidden) { check(); watchAlerts(); } });
    }
});
