/**
 * Products page: cards (or a compact list) with search, category and stock filters,
 * sorting, and add / edit / delete.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    // Form field ids for the "add" and "edit" forms
    const ADD_FIELDS = {
        product_name: "product_name",
        brand: "brand",
        category: "category",
        model: "model",
        price: "price",
        quantity: "quantity",
        low_stock_limit: "low_stock_limit",
        description: "description"
    };

    const EDIT_FIELDS = {
        product_name: "editProductName",
        brand: "editBrand",
        category: "editCategory",
        model: "editModel",
        price: "editPrice",
        quantity: "editQuantity",
        low_stock_limit: "editLowStock",
        description: "editDescription"
    };

    // Icon and colour for each category (any other category gets the default)
    const CATEGORIES = {
        "Phones": { icon: "bi-phone", hue: 245 },
        "Laptops": { icon: "bi-laptop", hue: 215 },
        "Televisions": { icon: "bi-tv", hue: 280 },
        "Accessories": { icon: "bi-mouse", hue: 175 },
        "Audio Devices": { icon: "bi-headphones", hue: 320 },
        "Home Appliances": { icon: "bi-house-door", hue: 28 },
        "Gaming Devices": { icon: "bi-controller", hue: 340 },
        "Power Solutions": { icon: "bi-battery-charging", hue: 55 }
    };

    const DEFAULT_CATEGORY = { icon: "bi-box-seam", hue: 220 };

    const SORTS = {
        "name-asc": (a, b) => text(a.product_name).localeCompare(text(b.product_name), undefined, { sensitivity: "base" }),
        "name-desc": (a, b) => text(b.product_name).localeCompare(text(a.product_name), undefined, { sensitivity: "base" }),
        "price-asc": (a, b) => a.price - b.price,
        "price-desc": (a, b) => b.price - a.price,
        "stock-asc": (a, b) => a.quantity - b.quantity,
        "stock-desc": (a, b) => b.quantity - a.quantity,
        "newest": (a, b) => Number(b.id) - Number(a.id)
    };

    const STEP = 12;           // how many products "Show more" adds
    const GAUGE_SEGMENTS = 8;

    const grid = $("productsGrid");
    const message = $("message");
    const searchInput = $("searchInput");

    let allProducts = [];
    let visibleProducts = [];   // after search, filters and sorting (every page of results)

    const filters = { term: "", category: "", stock: "all" };
    let sortKey = "name-asc";
    let view = readSetting("productsView") === "list" ? "list" : "grid";
    let limit = STEP;

    function text(value) {
        return String(value || "");
    }

    // Remembering the view is a nicety, so ignore browsers that block storage
    function readSetting(key) {
        try { return localStorage.getItem(key); } catch (error) { return null; }
    }

    function saveSetting(key, value) {
        try { localStorage.setItem(key, value); } catch (error) { /* ignore */ }
    }


    /* ---------- Forms ---------- */

    function readForm(fields) {
        const value = key => $(fields[key]).value;

        return {
            product_name: value("product_name").trim(),
            brand: value("brand").trim(),
            category: value("category"),
            model: value("model").trim(),
            price: Number(value("price")),
            quantity: Number(value("quantity")),
            low_stock_limit: Number(value("low_stock_limit")),
            description: value("description").trim()
        };
    }

    function fillForm(fields, product) {
        $(fields.product_name).value = product.product_name;
        $(fields.brand).value = product.brand;
        $(fields.category).value = product.category;
        $(fields.model).value = product.model || "";
        $(fields.price).value = product.price;
        $(fields.quantity).value = product.quantity;
        $(fields.low_stock_limit).value = product.low_stock_limit;
        $(fields.description).value = product.description || "";
    }

    function isValidProduct(product) {
        return Boolean(product.product_name && product.brand && product.category)
            && Number.isFinite(product.price) && product.price > 0
            && Number.isFinite(product.quantity) && product.quantity >= 0
            && Number.isFinite(product.low_stock_limit) && product.low_stock_limit >= 0;
    }

    function hideModal(id) {
        bootstrap.Modal.getOrCreateInstance($(id)).hide();
    }


    /* ---------- Stock ---------- */

    /** "out", "low" or "ok" */
    function stockState(product) {
        if (product.quantity <= 0) return "out";
        if (product.quantity <= (Number(product.low_stock_limit) || 0)) return "low";
        return "ok";
    }

    /** How many of the gauge's segments are lit: full at four times the low-stock limit. */
    function gaugeLevel(product) {
        if (product.quantity <= 0) return 0;

        const full = Math.max((Number(product.low_stock_limit) || 0) * 4, 1);
        return Math.max(1, Math.ceil(GAUGE_SEGMENTS * Math.min(1, product.quantity / full)));
    }


    /* ---------- Building the page ---------- */

    function el(tag, className, content) {
        const node = document.createElement(tag);

        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;

        return node;
    }

    function iconButton(action, label, icon, className, id) {
        const button = el("button", `pc-btn ${className || ""}`.trim());

        button.type = "button";
        button.dataset.action = action;
        button.dataset.id = id;

        const symbol = el("i", `bi ${icon}`);
        button.append(symbol);

        if (label) button.append(el("span", "", ` ${label}`));

        return button;
    }

    function createCard(product) {
        const state = stockState(product);
        const category = CATEGORIES[product.category] || DEFAULT_CATEGORY;

        const card = el("article", "pc-card");
        card.dataset.id = product.id;
        card.dataset.state = state;
        card.style.setProperty("--hue", category.hue);

        const tile = el("span", "pc-tile");
        tile.append(el("i", `bi ${category.icon}`));

        const pill = el("span", "pc-pill", state === "out" ? "Out of stock" : "Low stock");

        // Name (the main way to open a product) and brand + model underneath
        const main = el("div", "pc-main");
        const heading = el("h3", "pc-name");
        const nameButton = el("button", "", product.product_name);

        nameButton.type = "button";
        nameButton.dataset.action = "edit";
        nameButton.dataset.id = product.id;
        heading.append(nameButton);

        main.append(heading, el("p", "pc-sub", [product.brand, product.model].filter(Boolean).join(" ")));

        const gauge = el("div", "pc-gauge");
        gauge.setAttribute("aria-hidden", "true");

        const lit = gaugeLevel(product);
        for (let i = 0; i < GAUGE_SEGMENTS; i++) gauge.append(el("i", i < lit ? "is-on" : ""));

        const stock = el("div", "pc-stock");
        stock.append(gauge, el("span", "pc-count", `${product.quantity} in stock`));

        const actions = el("div", "pc-actions");
        actions.append(
            iconButton("edit", "Edit", "bi-pencil", "", product.id),
            iconButton("delete", "", "bi-trash", "is-danger", product.id)
        );

        actions.firstChild.title = `Edit ${product.product_name}`;
        actions.lastChild.title = `Delete ${product.product_name}`;
        actions.lastChild.setAttribute("aria-label", `Delete ${product.product_name}`);

        card.append(
            tile,
            el("span", "pc-cat", product.category),
            pill,
            main,
            el("p", "pc-price", Utils.formatMoney(product.price)),
            stock,
            actions
        );

        return card;
    }

    function emptyState(icon, title, body, button) {
        const box = el("div", "pc-empty");

        box.append(el("i", `bi ${icon}`), el("h3", "", title), el("p", "", body));

        if (button) box.append(button);

        return box;
    }

    function showSkeleton() {
        grid.replaceChildren(...Array.from({ length: 8 }, () => el("div", "pc-skel")));
        $("showMore").hidden = true;
        $("resultInfo").textContent = "Loading products...";
    }


    /* ---------- Filtering, sorting, drawing ---------- */

    function filtersActive() {
        return Boolean(filters.term || filters.category || filters.stock !== "all");
    }

    function matches(product) {
        const term = filters.term.toLowerCase();

        const matchesText = !term || [product.product_name, product.brand, product.model, product.category]
            .some(value => text(value).toLowerCase().includes(term));

        const matchesCategory = !filters.category || product.category === filters.category;
        const matchesStock = filters.stock === "all" || stockState(product) === filters.stock;

        return matchesText && matchesCategory && matchesStock;
    }

    function renderStats() {
        const low = allProducts.filter(product => stockState(product) === "low").length;
        const out = allProducts.filter(product => stockState(product) === "out").length;
        const value = allProducts.reduce((sum, product) => sum + product.price * product.quantity, 0);

        $("statTotal").textContent = allProducts.length;
        $("statLow").textContent = low;
        $("statOut").textContent = out;
        $("statValue").textContent = Utils.formatMoney(value);

        document.querySelectorAll("[data-stock]").forEach(tile => {
            tile.classList.toggle("is-active", tile.dataset.stock === filters.stock);
        });
    }

    /** One chip per category that has products, with its count. */
    function renderChips() {
        const counts = new Map();

        allProducts.forEach(product => counts.set(product.category, (counts.get(product.category) || 0) + 1));

        const known = Object.keys(CATEGORIES).filter(name => counts.has(name));
        const others = [...counts.keys()].filter(name => !CATEGORIES[name]).sort();

        const chips = [{ name: "", label: "All", count: allProducts.length }]
            .concat([...known, ...others].map(name => ({ name, label: name, count: counts.get(name) })));

        $("categoryChips").replaceChildren(...chips.map(chip => {
            const button = el("button", `pc-chip${filters.category === chip.name ? " is-active" : ""}`, chip.label);

            button.type = "button";
            button.dataset.category = chip.name;
            button.setAttribute("aria-pressed", String(filters.category === chip.name));
            button.append(el("span", "", chip.count));

            return button;
        }));
    }

    function render() {
        renderStats();
        renderChips();

        visibleProducts = allProducts.filter(matches).sort(SORTS[sortKey]);

        grid.classList.toggle("is-list", view === "list");
        document.querySelectorAll("[data-view]").forEach(button => {
            const active = button.dataset.view === view;

            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        $("clearFilters").hidden = !filtersActive();

        if (visibleProducts.length === 0) {
            const addButton = el("button", "pc-btn pc-btn-primary", " Add product");

            addButton.type = "button";
            addButton.prepend(el("i", "bi bi-plus-circle"));
            addButton.dataset.bsToggle = "modal";
            addButton.dataset.bsTarget = "#addProductModal";

            const clearButton = el("button", "pc-btn", "Clear filters");
            clearButton.type = "button";
            clearButton.dataset.action = "clear";

            grid.replaceChildren(
                allProducts.length === 0
                    ? emptyState("bi-box-seam", "No products yet", "Add your first product to start tracking stock.", addButton)
                    : emptyState("bi-search", "Nothing matches", "Try a different word, or clear the filters.", clearButton)
            );

            $("resultInfo").textContent = allProducts.length === 0 ? "" : "0 products found";
            $("showMore").hidden = true;
            return;
        }

        const shown = visibleProducts.slice(0, limit);
        const left = visibleProducts.length - shown.length;

        grid.replaceChildren(...shown.map(createCard));

        $("resultInfo").textContent = filtersActive()
            ? `${visibleProducts.length} of ${allProducts.length} products match`
            : `${allProducts.length} products`;

        $("showMore").hidden = left <= 0;
        $("showMore").textContent = `Show ${Math.min(STEP, left)} more (${left} left)`;
    }

    /** Change a filter or the sort order, then start again from the first products. */
    function change(update) {
        update();
        limit = STEP;
        render();
    }

    /** Download everything that matches the current search and filters. */
    function exportProducts() {
        if (visibleProducts.length === 0) {
            alert("There are no products to export.");
            return;
        }

        Utils.downloadCsv(
            `products-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Name", "Brand", "Model", "Category", "Price", "Quantity", "Low stock limit"],
            visibleProducts.map(product => [
                product.product_name,
                product.brand,
                product.model,
                product.category,
                product.price,
                product.quantity,
                product.low_stock_limit
            ])
        );
    }


    /* ---------- Data ---------- */

    async function loadProducts() {
        showSkeleton();

        try {
            const result = await Api.getProducts();
            allProducts = (result.products || []).map(product => ({
                ...product,
                price: Number(product.price),
                quantity: Number(product.quantity)
            }));

            render();   // keeps your search and filters after an edit or delete
        } catch (error) {
            console.error(error);

            const retry = el("button", "pc-btn", "Try again");
            retry.type = "button";
            retry.addEventListener("click", loadProducts);

            grid.replaceChildren(emptyState("bi-wifi-off", "Couldn't load products", error.message || "Check your connection and try again.", retry));
            $("resultInfo").textContent = "";
        }
    }

    async function addProduct(event) {
        event.preventDefault();

        const product = readForm(ADD_FIELDS);

        if (!isValidProduct(product)) {
            Utils.setMessage(message, "Please enter valid product details.");
            return;
        }

        try {
            await Api.createProduct(product);

            event.target.reset();
            hideModal("addProductModal");
            Utils.setMessage(message, "Product added successfully!", "success");

            await loadProducts();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }

    async function openEditModal(id) {
        try {
            const result = await Api.getProduct(id);
            const product = result.product || result;

            $("editId").value = product.id;
            fillForm(EDIT_FIELDS, product);

            bootstrap.Modal.getOrCreateInstance($("editProductModal")).show();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }

    async function updateProduct(event) {
        event.preventDefault();

        const id = $("editId").value;
        const product = readForm(EDIT_FIELDS);

        if (!isValidProduct(product)) {
            Utils.setMessage(message, "Please enter valid product details.");
            return;
        }

        try {
            await Api.updateProduct(id, product);

            hideModal("editProductModal");
            Utils.setMessage(message, "Product updated successfully!", "success");

            await loadProducts();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }

    async function deleteProduct(id) {
        const product = allProducts.find(item => String(item.id) === String(id));
        const name = product ? `"${product.product_name}"` : "this product";

        if (!(await Utils.confirm({
            title: `Delete ${name}?`,
            message: "This cannot be undone.",
            confirmText: "Delete",
            danger: true
        }))) return;

        try {
            await Api.deleteProduct(id);

            Utils.setMessage(message, "Product deleted successfully!", "success");

            await loadProducts();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }


    /* ---------- Events ---------- */

    $("productForm").addEventListener("submit", addProduct);
    $("editProductForm").addEventListener("submit", updateProduct);
    $("refreshProducts").addEventListener("click", loadProducts);
    $("exportProducts").addEventListener("click", exportProducts);

    searchInput.addEventListener("input", Utils.debounce(() => {
        change(() => { filters.term = searchInput.value.trim(); });
    }, 150));

    $("sortSelect").addEventListener("change", event => change(() => { sortKey = event.target.value; }));

    // The summary tiles double as stock filters; click the active one again to clear it
    document.querySelectorAll("[data-stock]").forEach(tile => {
        tile.addEventListener("click", () => change(() => {
            filters.stock = filters.stock === tile.dataset.stock ? "all" : tile.dataset.stock;
        }));
    });

    $("categoryChips").addEventListener("click", event => {
        const chip = event.target.closest("[data-category]");
        if (!chip) return;

        change(() => { filters.category = filters.category === chip.dataset.category ? "" : chip.dataset.category; });
    });

    document.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
            view = button.dataset.view;
            saveSetting("productsView", view);
            render();
        });
    });

    function clearFilters() {
        searchInput.value = "";

        change(() => {
            filters.term = "";
            filters.category = "";
            filters.stock = "all";
        });
    }

    $("clearFilters").addEventListener("click", clearFilters);

    $("showMore").addEventListener("click", () => {
        limit += STEP;
        render();
    });

    // One listener handles every button on every card; clicking a card's blank space opens it too
    grid.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (button) {
            const { action, id } = button.dataset;

            if (action === "edit") openEditModal(id);
            if (action === "delete") deleteProduct(id);
            if (action === "clear") clearFilters();

            return;
        }

        const card = event.target.closest(".pc-card");
        if (card && !event.target.closest("button, a")) openEditModal(card.dataset.id);
    });

    // Press / anywhere to jump to the search box, Escape to clear it
    document.addEventListener("keydown", event => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;

        if (event.key === "/" && !typing && !document.querySelector(".modal.show")) {
            event.preventDefault();
            searchInput.focus();
        }

        if (event.key === "Escape" && document.activeElement === searchInput && searchInput.value) {
            searchInput.value = "";
            change(() => { filters.term = ""; });
        }
    });

    loadProducts();
})();
