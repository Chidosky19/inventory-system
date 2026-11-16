/**
 * Messages page (admin only): read what visitors sent from the Contact page.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const COLUMNS = 5;
    const table = $("messagesTable");
    const note = $("messagesNote");

    let messages = [];

    function button(label, icon, style, action, id) {
        const el = document.createElement("button");

        el.type = "button";
        el.className = `btn btn-sm ${style}`;
        el.dataset.action = action;
        el.dataset.id = id;
        el.innerHTML = `<i class="bi ${icon}"></i> ${label}`;

        return el;
    }

    function formatDateTime(value) {
        return new Date(value).toLocaleString(CONFIG.LOCALE, { dateStyle: "medium", timeStyle: "short" });
    }

    function render() {
        const unread = messages.filter(item => !item.is_read).length;
        $("messageCount").textContent = messages.length === 0 ? "" : `${unread} unread of ${messages.length}`;

        if (messages.length === 0) {
            Utils.setTableMessage(table, COLUMNS, "No messages yet.");
            return;
        }

        const rows = messages.map(item => {
            const row = Utils.createRow([`${item.name} (${item.email})`, item.topic, formatDateTime(item.created_at)]);

            Utils.appendCell(row, item.is_read ? Utils.createBadge("Read", "secondary") : Utils.createBadge("New", "primary"));

            const actions = document.createElement("div");
            actions.className = "d-flex gap-1 flex-wrap";
            actions.append(
                button("View", "bi-eye", "btn-outline-primary", "view", item.id),
                button(item.is_read ? "Mark unread" : "Mark read", "bi-check2", "btn-outline-secondary", "toggle", item.id),
                button("Delete", "bi-trash", "btn-danger", "delete", item.id)
            );
            Utils.appendCell(row, actions);

            if (!item.is_read) row.classList.add("fw-bold");

            return row;
        });

        table.replaceChildren(...rows);
    }

    async function load() {
        Utils.setTableMessage(table, COLUMNS, "Loading messages...");

        try {
            const result = await Api.getMessages();
            messages = result.messages || [];
            render();
        } catch (error) {
            console.error(error);
            Utils.setTableMessage(table, COLUMNS, "Unable to load messages.");
            Utils.setMessage(note, error.message);
        }
    }

    async function setRead(id, isRead) {
        try {
            await Api.setMessageRead(id, isRead);

            const item = messages.find(entry => String(entry.id) === String(id));
            if (item) item.is_read = isRead;

            render();
        } catch (error) {
            console.error(error);
            Utils.setMessage(note, error.message);
        }
    }

    function view(id) {
        const item = messages.find(entry => String(entry.id) === String(id));
        if (!item) return;

        $("messageTitle").textContent = item.topic;
        $("messageFrom").textContent = `${item.name} (${item.email})`;
        $("messageMeta").textContent = formatDateTime(item.created_at);
        $("messageText").textContent = item.message;
        $("messageReply").href = `mailto:${item.email}?subject=${encodeURIComponent("Re: " + item.topic)}`;

        bootstrap.Modal.getOrCreateInstance($("messageModal")).show();

        if (!item.is_read) setRead(id, true);
    }

    async function remove(id) {
        if (!(await Utils.confirm({
            title: "Delete this message?",
            message: "This cannot be undone.",
            confirmText: "Delete",
            danger: true
        }))) return;

        try {
            await Api.deleteMessage(id);
            messages = messages.filter(entry => String(entry.id) !== String(id));
            render();
        } catch (error) {
            console.error(error);
            Utils.setMessage(note, error.message);
        }
    }

    table.addEventListener("click", event => {
        const target = event.target.closest("button[data-action]");
        if (!target) return;

        const { action, id } = target.dataset;

        if (action === "view") view(id);
        if (action === "toggle") {
            const item = messages.find(entry => String(entry.id) === String(id));
            if (item) setRead(id, !item.is_read);
        }
        if (action === "delete") remove(id);
    });

    $("refreshMessages").addEventListener("click", load);

    load();
})();
