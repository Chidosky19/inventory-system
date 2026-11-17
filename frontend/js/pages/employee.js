/**
 * Employee workspace: pick a product, record a sale, review my own sales.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const HISTORY_LIMIT = 25;

    const els = {
        list: $("productList"),
        search: $("productSearch"),
        form: $("saleForm"),
        empty: $("saleEmpty"),
        quantity: $("saleQuantity"),
        total: $("saleTotal"),
        submit: $("saleSubmit"),
        message: $("saleMessage"),
        salesTable: $("salesTable")
    };

    let products = [];
    let selectedId = null;
    let employeeName = "";
    let lastReceipt = null;


    /* ---------- Helpers ---------- */

    const getProduct = id => products.find(product => product.id === id);

    const stockStatus = product => {
        if (product.quantity <= 0) return { text: "Out of stock", css: "is-out" };
        if (product.quantity <= product.low_stock_limit) return { text: `Only ${product.quantity} left`, css: "is-low" };
        return { text: `${product.quantity} in stock`, css: "" };
    };

    function showMessage(text, type = "error") {
        els.message.textContent = text;
        els.message.classList.toggle("is-success", type === "success");
        els.message.hidden = !text;

        // A recorded sale also pops up in the corner, so it is impossible to miss
        if (text && type === "success") Utils.toast(text, "success");
    }

    function greeting(name) {
        const hour = new Date().getHours();
        const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        return `${part}, ${name.split(" ")[0]}`;
    }

    function isToday(value) {
        return new Date(value).toDateString() === new Date().toDateString();
    }


    /* ---------- Who am I ---------- */

    async function loadUser() {
        try {
            const me = await Api.getMe();

            employeeName = me.name;
            $("userName").textContent = me.name;
            $("userAvatar").textContent = me.name.trim().charAt(0).toUpperCase() || "?";
            $("greeting").textContent = greeting(me.name);
        } catch (error) {
            console.error(error);
            $("userName").textContent = "Employee";
            $("greeting").textContent = greeting("there");
        }
    }


    /* ---------- Products ---------- */

    function createProductCard(product) {
        const status = stockStatus(product);
        const card = document.createElement("button");

        card.type = "button";
        card.className = "emp-product" + (product.id === selectedId ? " is-selected" : "");
        card.dataset.id = product.id;
        card.disabled = product.quantity <= 0;

        const name = document.createElement("span");
        name.className = "emp-product-name";
        name.textContent = product.product_name;

        const meta = document.createElement("span");
        meta.className = "emp-product-meta";
        meta.textContent = [product.brand, product.model, product.category].filter(Boolean).join(" · ");

        const foot = document.createElement("span");
        foot.className = "emp-product-foot";

        const price = document.createElement("span");
        price.className = "emp-price";
        price.textContent = Utils.formatMoney(product.price);

        const badge = document.createElement("span");
        badge.className = `emp-badge ${status.css}`.trim();
        badge.textContent = status.text;

        foot.append(price, badge);
        card.append(name, meta, foot);

        return card;
    }

    function renderProducts() {
        const term = els.search.value.trim().toLowerCase();

        const visible = products.filter(product =>
            [product.product_name, product.brand, product.model, product.category]
                .some(value => (value || "").toLowerCase().includes(term))
        );

        if (visible.length === 0) {
            const empty = document.createElement("p");
            empty.className = "emp-empty";
            empty.textContent = products.length === 0 ? "No products available yet." : "No products match your search.";
            els.list.replaceChildren(empty);
            return;
        }

        els.list.replaceChildren(...visible.map(createProductCard));
    }

    async function loadProducts() {
        try {
            const result = await Api.getProducts();
            products = result.products || [];

            // Keep the selection only if the product still exists and has stock
            const selected = getProduct(selectedId);
            if (!selected || selected.quantity <= 0) clearSelection();

            renderProducts();
            if (selectedId) updateSalePanel();
        } catch (error) {
            console.error(error);
            const failed = document.createElement("p");
            failed.className = "emp-empty";
            failed.textContent = error.message;
            els.list.replaceChildren(failed);
        }
    }


    /* ---------- Sale panel ---------- */

    function clearSelection() {
        selectedId = null;
        els.form.hidden = true;
        els.empty.hidden = false;
    }

    function selectProduct(id) {
        selectedId = id;
        els.quantity.value = 1;

        els.form.hidden = false;
        els.empty.hidden = true;
        showMessage("");

        updateSalePanel();
        renderProducts();
    }

    function currentQuantity() {
        return Number(els.quantity.value);
    }

    function updateSalePanel() {
        const product = getProduct(selectedId);
        if (!product) return;

        $("saleProductName").textContent = product.product_name;
        $("saleProductMeta").textContent =
            `${Utils.formatMoney(product.price)} each · ${stockStatus(product).text.toLowerCase()}`;

        els.quantity.max = product.quantity;

        const quantity = currentQuantity();
        els.total.textContent = Utils.formatMoney(product.price * (Number.isFinite(quantity) ? Math.max(quantity, 0) : 0));
    }

    function changeQuantity(step) {
        const product = getProduct(selectedId);
        if (!product) return;

        const next = Math.min(Math.max((currentQuantity() || 0) + step, 1), product.quantity);
        els.quantity.value = next;
        updateSalePanel();
    }

    /** Fill the hidden receipt and open the print dialog. */
    function printReceipt() {
        if (!lastReceipt) return;

        const shop = CONFIG.SITE || {};
        const box = $("receipt");

        const add = (tag, text, className) => {
            const el = document.createElement(tag);
            el.textContent = text;
            if (className) el.className = className;
            box.appendChild(el);
            return el;
        };

        const line = (left, right, className) => {
            const row = document.createElement("div");
            row.className = `line ${className || ""}`.trim();

            const a = document.createElement("span");
            const b = document.createElement("span");
            a.textContent = left;
            b.textContent = right;

            row.append(a, b);
            box.appendChild(row);
        };

        box.replaceChildren();

        add("h1", shop.name || "Receipt");
        if (shop.address) add("p", shop.address, "center");
        if (shop.phone) add("p", shop.phone, "center");
        box.appendChild(document.createElement("hr"));

        if (lastReceipt.id) add("p", `Receipt no: ${lastReceipt.id}`);
        add("p", `Date: ${lastReceipt.date.toLocaleString(CONFIG.LOCALE)}`);
        if (employeeName) add("p", `Served by: ${employeeName}`);
        box.appendChild(document.createElement("hr"));

        add("p", lastReceipt.product);
        line(`${lastReceipt.quantity} x ${Utils.formatMoney(lastReceipt.unitPrice)}`, Utils.formatMoney(lastReceipt.total));
        box.appendChild(document.createElement("hr"));

        line("TOTAL", Utils.formatMoney(lastReceipt.total), "total");
        box.appendChild(document.createElement("hr"));
        add("p", "Thank you for shopping with us!", "center");

        window.print();
    }

    async function recordSale(event) {
        event.preventDefault();

        const product = getProduct(selectedId);
        const quantity = currentQuantity();

        if (!product) return;

        if (!Number.isInteger(quantity) || quantity <= 0) {
            showMessage("Please enter a quantity of 1 or more.");
            return;
        }

        if (quantity > product.quantity) {
            showMessage(`Only ${product.quantity} unit${product.quantity === 1 ? "" : "s"} available.`);
            return;
        }

        els.submit.disabled = true;

        try {
            const sale = await Api.createSale({ product_id: product.id, quantity });

            if (sale && sale.warning) {
                // the sale went through but wasn't linked to this account, so it won't be in "My sales"
                showMessage(`${sale.warning} Please tell the administrator.`);
            } else {
                showMessage(`Sale recorded: ${quantity} × ${product.product_name} (${Utils.formatMoney(product.price * quantity)})`, "success");
            }

            lastReceipt = {
                id: sale && sale.id,
                product: `${product.product_name}${product.brand ? " - " + product.brand : ""}`,
                quantity,
                unitPrice: product.price,
                total: product.price * quantity,
                date: new Date()
            };
            $("printReceipt").hidden = false;
            els.quantity.value = 1;

            await Promise.all([loadProducts(), loadSales()]);
        } catch (error) {
            console.error(error);
            showMessage(error.message);
        } finally {
            els.submit.disabled = false;
        }
    }


    /* ---------- My sales ---------- */

    function renderStats(sales) {
        const today = sales.filter(sale => isToday(sale.created_at));

        $("statCount").textContent = today.length;
        $("statTotal").textContent = Utils.formatMoney(Utils.sumBy(today, "total_price"));
    }

    function renderSales(sales) {
        if (sales.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.className = "is-empty";
            cell.colSpan = 4;
            cell.textContent = "You haven't recorded any sales yet.";

            row.appendChild(cell);
            els.salesTable.replaceChildren(row);
            return;
        }

        const rows = sales.slice(0, HISTORY_LIMIT).map(sale => {
            const row = Utils.createRow([
                sale.products?.product_name || "Unknown product",
                sale.quantity,
                Utils.formatMoney(sale.total_price),
                new Date(sale.created_at).toLocaleString(CONFIG.LOCALE, { dateStyle: "medium", timeStyle: "short" })
            ]);

            row.children[1].className = "num";
            row.children[2].className = "num";

            return row;
        });

        els.salesTable.replaceChildren(...rows);
    }

    async function loadSales() {
        try {
            const result = await Api.getSales();
            const sales = result.sales || [];

            renderStats(sales);
            renderSales(sales);
        } catch (error) {
            console.error(error);
            Utils.setTableMessage(els.salesTable, 4, "Unable to load your sales.");
        }
    }


    /* ---------- Events ---------- */

    els.list.addEventListener("click", event => {
        const card = event.target.closest(".emp-product");
        if (card && !card.disabled) selectProduct(Number(card.dataset.id));
    });

    els.search.addEventListener("input", Utils.debounce(renderProducts, 150));
    els.form.addEventListener("submit", recordSale);
    $("printReceipt").addEventListener("click", printReceipt);
    els.quantity.addEventListener("input", updateSalePanel);
    $("qtyMinus").addEventListener("click", () => changeQuantity(-1));
    $("qtyPlus").addEventListener("click", () => changeQuantity(1));

    $("saleCancel").addEventListener("click", () => {
        clearSelection();
        showMessage("");
        renderProducts();
    });

    // Date in the top bar
    $("currentDate").textContent = new Date().toLocaleDateString(CONFIG.LOCALE, {
        weekday: "long", month: "long", day: "numeric"
    });

    loadUser();
    loadProducts();
    loadSales();
})();
