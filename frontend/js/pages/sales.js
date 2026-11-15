/**
 * Sales page: record a sale, view history and summary.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const productSelect = $("productSelect");
    const saleQuantity = $("saleQuantity");
    const unitPrice = $("unitPrice");
    const totalAmount = $("totalAmount");
    const saleMessage = $("saleMessage");
    const salesTable = $("salesTable");
    const saleForm = $("saleForm");

    let availableProducts = [];
    let loadedSales = [];


    /* ---------- Product dropdown ---------- */

    function renderProductOptions() {
        const placeholder = new Option("Select a product", "");

        const options = availableProducts.map(product => {
            const option = new Option(
                `${product.product_name} - ${product.brand} (Stock: ${product.quantity})`,
                product.id
            );

            option.dataset.price = product.price;
            return option;
        });

        productSelect.replaceChildren(placeholder, ...options);
    }

    async function loadProducts() {
        try {
            const result = await Api.getProducts();
            availableProducts = result.products || [];
            renderProductOptions();
        } catch (error) {
            console.error(error);
            Utils.setMessage(saleMessage, "Unable to load products.");
        }
    }

    function clearTotals() {
        unitPrice.value = "";
        totalAmount.value = "";
    }

    function calculateTotal() {
        const selected = productSelect.selectedOptions[0];

        if (!selected || !selected.value) {
            clearTotals();
            return;
        }

        const price = Number(selected.dataset.price);
        const quantity = Number(saleQuantity.value) || 0;

        unitPrice.value = Utils.formatMoney(price);
        totalAmount.value = Utils.formatMoney(price * quantity);
    }


    /* ---------- Record a sale ---------- */

    async function recordSale(event) {
        event.preventDefault();

        const productId = Number(productSelect.value);
        const quantity = Number(saleQuantity.value);
        const product = availableProducts.find(item => item.id === productId);

        if (!product || !Number.isInteger(quantity) || quantity <= 0) {
            Utils.setMessage(saleMessage, "Please select a product and enter a valid quantity.");
            return;
        }

        if (quantity > product.quantity) {
            Utils.setMessage(saleMessage, `Only ${product.quantity} units are available.`);
            return;
        }

        try {
            await Api.createSale({ product_id: productId, quantity });

            Utils.setMessage(saleMessage, "Sale recorded successfully!", "success");
            saleForm.reset();
            clearTotals();

            await Promise.all([loadProducts(), loadSales()]);
        } catch (error) {
            console.error(error);
            Utils.setMessage(saleMessage, error.message);
        }
    }


    /* ---------- History & summary ---------- */

    function renderSales(sales) {
        if (sales.length === 0) {
            Utils.setTableMessage(salesTable, 7, "No sales recorded yet.");
            return;
        }

        const rows = sales.map(sale => Utils.createRow([
            sale.id,
            sale.products?.product_name || "Unknown Product",
            sale.quantity,
            Utils.formatMoney(sale.unit_price),
            Utils.formatMoney(sale.total_price),
            Utils.formatDate(sale.created_at),
            sale.sold_by || "-"
        ]));

        salesTable.replaceChildren(...rows);
    }

    function renderSummary(sales) {
        $("totalSales").textContent = sales.length;
        $("totalRevenue").textContent = Utils.formatMoney(Utils.sumBy(sales, "total_price"));
        $("productsSold").textContent = Utils.sumBy(sales, "quantity");
    }

    async function loadSales() {
        try {
            const result = await Api.getSales();
            const sales = result.sales || [];
            loadedSales = sales;

            renderSales(sales);
            renderSummary(sales);
        } catch (error) {
            console.error(error);
            Utils.setTableMessage(salesTable, 7, "Unable to load sales history.");
        }
    }

    function exportSales() {
        if (loadedSales.length === 0) {
            alert("There are no sales to export yet.");
            return;
        }

        const rows = loadedSales.map(sale => [
            sale.id,
            sale.products?.product_name || "Unknown Product",
            sale.quantity,
            sale.unit_price,
            sale.total_price,
            new Date(sale.created_at).toISOString().slice(0, 19).replace("T", " "),
            sale.sold_by || ""
        ]);

        Utils.downloadCsv(
            `sales-${new Date().toISOString().slice(0, 10)}.csv`,
            ["ID", "Product", "Quantity", "Unit price", "Total", "Date", "Sold by"],
            rows
        );
    }

    function refreshPage() {
        return Promise.all([loadProducts(), loadSales()]);
    }


    /* ---------- Events ---------- */

    productSelect.addEventListener("change", calculateTotal);
    saleQuantity.addEventListener("input", calculateTotal);
    saleForm.addEventListener("submit", recordSale);
    $("refreshSales").addEventListener("click", refreshPage);
    $("exportSales").addEventListener("click", exportSales);

    refreshPage();
})();
