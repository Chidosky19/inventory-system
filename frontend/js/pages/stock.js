/**
 * Stock page: current stock levels, stock in / out, and transaction history.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const stockTable = $("stockTable");
    const stockHistoryTable = $("stockHistoryTable");

    const isLowStock = product => product.quantity <= product.low_stock_limit;

    const TYPE_LABELS = { stock_in: "Stock In", stock_out: "Stock Out" };


    /* ---------- Current stock ---------- */

    function renderProductOptions(products) {
        ["stockInProduct", "stockOutProduct"].forEach(id => {
            const options = products.map(product => new Option(
                `${product.product_name} - ${product.brand} (Stock: ${product.quantity})`,
                product.id
            ));

            $(id).replaceChildren(new Option("Select Product", ""), ...options);
        });
    }

    function renderStock(products) {
        if (products.length === 0) {
            Utils.setTableMessage(stockTable, 6, "No products available.");
            return;
        }

        const rows = products.map(product => {
            const row = Utils.createRow([
                product.id,
                product.product_name,
                product.brand,
                product.quantity,
                product.low_stock_limit
            ]);

            Utils.appendCell(
                row,
                isLowStock(product)
                    ? Utils.createBadge("Low Stock", "danger")
                    : Utils.createBadge("In Stock", "success")
            );

            return row;
        });

        stockTable.replaceChildren(...rows);
    }

    function renderSummary(products) {
        $("totalProducts").textContent = products.length;
        $("totalStock").textContent = Utils.sumBy(products, "quantity");
        $("lowStockCount").textContent = products.filter(isLowStock).length;
    }

    async function loadProducts() {
        try {
            const result = await Api.getProducts();
            const products = result.products || [];

            renderProductOptions(products);
            renderStock(products);
            renderSummary(products);
        } catch (error) {
            console.error(error);
            Utils.setTableMessage(stockTable, 6, "Unable to load stock.");
        }
    }


    /* ---------- History ---------- */

    function renderHistory(history) {
        if (!history || history.length === 0) {
            Utils.setTableMessage(stockHistoryTable, 6, "No stock transactions yet.");
            return;
        }

        const rows = history.map(transaction => Utils.createRow([
            transaction.id,
            transaction.products?.product_name || "Unknown Product",
            TYPE_LABELS[transaction.transaction_type] || transaction.transaction_type,
            transaction.quantity,
            transaction.note || "-",
            Utils.formatDate(transaction.created_at)
        ]));

        stockHistoryTable.replaceChildren(...rows);
    }

    async function loadStockHistory() {
        try {
            const result = await Api.getStockHistory();
            renderHistory(result.history);
        } catch (error) {
            console.error(error);
            Utils.setTableMessage(stockHistoryTable, 6, "Unable to load stock history.");
        }
    }

    function refreshPage() {
        return Promise.all([loadProducts(), loadStockHistory()]);
    }


    /* ---------- Stock in / out forms ---------- */

    /**
     * Wire up one of the two stock forms. They differ only in their element ids,
     * the API call they make, and the success message.
     */
    function setupStockForm({ formId, productId, quantityId, noteId, messageId, submit, successText }) {
        const form = $(formId);
        const message = $(messageId);

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const product = $(productId).value;
            const quantity = Number($(quantityId).value);
            const note = $(noteId).value.trim();

            if (!product || !Number.isInteger(quantity) || quantity <= 0) {
                Utils.setMessage(message, "Please select a product and enter a valid quantity.");
                return;
            }

            try {
                await submit(product, { quantity, note });

                Utils.setMessage(message, successText, "success");
                form.reset();

                await refreshPage();
            } catch (error) {
                console.error(error);
                Utils.setMessage(message, error.message);
            }
        });
    }

    setupStockForm({
        formId: "stockInForm",
        productId: "stockInProduct",
        quantityId: "stockInQuantity",
        noteId: "stockInNote",
        messageId: "stockInMessage",
        submit: Api.stockIn,
        successText: "Stock added successfully!"
    });

    setupStockForm({
        formId: "stockOutForm",
        productId: "stockOutProduct",
        quantityId: "stockOutQuantity",
        noteId: "stockOutNote",
        messageId: "stockOutMessage",
        submit: Api.stockOut,
        successText: "Stock removed successfully!"
    });

    $("refreshStock").addEventListener("click", refreshPage);

    refreshPage();
})();
