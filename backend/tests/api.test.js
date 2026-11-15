const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../src/app");
const { createFakeSupabase } = require("../test-support/fakeSupabase");

const USERS = {
    "admin-token": { id: "u1", email: "Admin@Shop.com" },
    "stranger-token": { id: "u2", email: "stranger@elsewhere.com" }
};

const seedData = () => ({
    users: USERS,
    products: [
        { id: 1, product_name: "Smart TV", brand: "LG", category: "Television", model: "X1", price: 150000, quantity: 10, low_stock_limit: 3, description: "" },
        { id: 2, product_name: "Phone", brand: "Samsung", category: "Phones", model: "", price: 90000, quantity: 2, low_stock_limit: 5, description: "" }
    ],
    sales: [{ id: 1, product_id: 1, quantity: 1, unit_price: 150000, total_price: 150000, created_at: "2026-11-01T10:00:00Z" }]
});

/** Start the app on a random port with a fresh fake database. */
async function startApp({ config = {}, seed = seedData() } = {}) {
    const fake = createFakeSupabase(seed);
    const app = createApp({
        supabase: fake,
        config: { adminEmails: [], corsOrigins: [], isProduction: false, ...config }
    });

    const server = await new Promise(resolve => {
        const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });

    const base = `http://127.0.0.1:${server.address().port}`;

    async function call(path, { method = "GET", body, token = "admin-token", headers = {}, rawBody } = {}) {
        const response = await fetch(base + path, {
            method,
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {}),
                ...headers
            },
            body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined
        });

        return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
    }

    return { call, fake, close: () => new Promise(resolve => server.close(resolve)) };
}

// Runs a test with a fresh app and always shuts the server down afterwards
const withApp = (name, options, fn) =>
    test(name, async () => {
        const app = await startApp(options);
        try { await fn(app); } finally { await app.close(); }
    });


/* ---------------- Authentication ---------------- */

withApp("health check is public", {}, async ({ call }) => {
    const res = await call("/health", { token: null });
    assert.equal(res.status, 200);
});

withApp("protected routes reject requests with no token", {}, async ({ call }) => {
    for (const path of ["/products", "/sales", "/dashboard", "/stock/history"]) {
        const res = await call(path, { token: null });
        assert.equal(res.status, 401, path);
        assert.equal(res.body.error, "Authentication required");
    }
});

withApp("protected routes reject an invalid token", {}, async ({ call }) => {
    const res = await call("/products", { token: "made-up" });
    assert.equal(res.status, 401);
});

withApp("any signed-in user is allowed when ADMIN_EMAILS is empty", {}, async ({ call }) => {
    const res = await call("/products", { token: "stranger-token" });
    assert.equal(res.status, 200);
});

withApp("ADMIN_EMAILS blocks other accounts (case-insensitive match for admins)", { config: { adminEmails: ["admin@shop.com"] } }, async ({ call }) => {
    assert.equal((await call("/products", { token: "admin-token" })).status, 200);

    const blocked = await call("/products", { token: "stranger-token" });
    assert.equal(blocked.status, 403);
});


/* ---------------- Products ---------------- */

withApp("lists products", {}, async ({ call }) => {
    const res = await call("/products");
    assert.equal(res.status, 200);
    assert.equal(res.body.products.length, 2);
    assert.equal(res.body.totalProducts, 2);
});

withApp("creates a product and returns it as an object", {}, async ({ call }) => {
    const res = await call("/products", {
        method: "POST",
        body: { product_name: "  Radio ", brand: "Sony", category: "Audio", price: 5000, quantity: 3, low_stock_limit: 1, junk: "ignored" }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.product.product_name, "Radio");
    assert.equal("junk" in res.body.product, false);
});

withApp("rejects invalid product details with a readable error", {}, async ({ call }) => {
    const bad = [
        [{ brand: "Sony", category: "Audio", price: 5, quantity: 1, low_stock_limit: 1 }, "Product name is required"],
        [{ product_name: "A", brand: "B", category: "C", price: -5, quantity: 1, low_stock_limit: 1 }, "Price must be greater than zero"],
        [{ product_name: "A", brand: "B", category: "C", price: "5", quantity: 1, low_stock_limit: 1 }, "Price must be greater than zero"],
        [{ product_name: "A", brand: "B", category: "C", price: 5, quantity: 1.5, low_stock_limit: 1 }, "Quantity must be a whole number (0 or more)"],
        [{ product_name: "A", brand: "B", category: "C", price: 5, quantity: 1 }, "Low stock limit must be a whole number (0 or more)"]
    ];

    for (const [body, message] of bad) {
        const res = await call("/products", { method: "POST", body });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, message);
    }
});

withApp("gets one product, 400 for a bad id, 404 for a missing one", {}, async ({ call }) => {
    assert.equal((await call("/products/1")).body.product.brand, "LG");
    assert.equal((await call("/products/abc")).status, 400);
    assert.equal((await call("/products/999")).status, 404);
});

withApp("updates and deletes a product", {}, async ({ call }) => {
    const updated = await call("/products/1", { method: "PUT", body: { price: 140000 } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.product.price, 140000);
    assert.equal(updated.body.product.brand, "LG"); // untouched fields stay

    assert.equal((await call("/products/999", { method: "PUT", body: { price: 1 } })).status, 404);
    assert.equal((await call("/products/1", { method: "PUT", body: {} })).status, 400);

    assert.equal((await call("/products/1", { method: "DELETE" })).status, 200);
    assert.equal((await call("/products/1", { method: "DELETE" })).status, 404);
});


/* ---------------- Stock ---------------- */

withApp("stock in increases quantity and records history", {}, async ({ call, fake }) => {
    const res = await call("/stock/in/1", { method: "POST", body: { quantity: 5, note: "Delivery" } });

    assert.equal(res.status, 200);
    assert.equal(res.body.previousQuantity, 10);
    assert.equal(res.body.newQuantity, 15);
    assert.equal(fake.db.products[0].quantity, 15);
    assert.deepEqual(
        { type: fake.db.stock_history[0].transaction_type, note: fake.db.stock_history[0].note },
        { type: "stock_in", note: "Delivery" }
    );
});

withApp("stock out decreases quantity and uses a default note", {}, async ({ call, fake }) => {
    const res = await call("/stock/out/1", { method: "POST", body: { quantity: 4 } });

    assert.equal(res.status, 200);
    assert.equal(res.body.newQuantity, 6);
    assert.equal(res.body.removedQuantity, 4);
    assert.equal(fake.db.stock_history[0].note, "Stock removed");
});

withApp("stock out refuses to go below zero and reports what is available", {}, async ({ call, fake }) => {
    const res = await call("/stock/out/2", { method: "POST", body: { quantity: 3 } });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Insufficient stock");
    assert.equal(res.body.availableStock, 2);
    assert.equal(fake.db.products[1].quantity, 2);
});

withApp("stock movements validate input", {}, async ({ call }) => {
    assert.equal((await call("/stock/in/1", { method: "POST", body: { quantity: 0 } })).status, 400);
    assert.equal((await call("/stock/in/1", { method: "POST", body: { quantity: 1.5 } })).status, 400);
    assert.equal((await call("/stock/in/1", { method: "POST" })).status, 400);
    assert.equal((await call("/stock/in/x", { method: "POST", body: { quantity: 1 } })).status, 400);
    assert.equal((await call("/stock/in/999", { method: "POST", body: { quantity: 1 } })).status, 404);
});

withApp("a concurrent stock change is detected instead of overwritten", {}, async ({ call, fake }) => {
    // Simulate someone else selling 3 units between our read and our write
    fake.beforeWrite = (table, op) => {
        if (table === "products" && op === "update") {
            fake.db.products[0].quantity = 7;
            fake.beforeWrite = null;
        }
    };

    const res = await call("/stock/in/1", { method: "POST", body: { quantity: 5 } });

    assert.equal(res.status, 409);
    assert.equal(fake.db.products[0].quantity, 7); // their change survived
    assert.equal(fake.db.stock_history.length, 0);
});

withApp("quantity is restored if recording the history fails", {}, async ({ call, fake }) => {
    fake.failures.push({ table: "stock_history", op: "insert" });

    const res = await call("/stock/in/1", { method: "POST", body: { quantity: 5 } });

    assert.equal(res.status, 500);
    assert.equal(fake.db.products[0].quantity, 10);
});

withApp("returns stock history with product names", {}, async ({ call }) => {
    await call("/stock/in/1", { method: "POST", body: { quantity: 1 } });

    const res = await call("/stock/history");
    assert.equal(res.status, 200);
    assert.equal(res.body.history[0].products.product_name, "Smart TV");
});


/* ---------------- Sales ---------------- */

withApp("records a sale through the database function", {}, async ({ call, fake }) => {
    const res = await call("/sales", { method: "POST", body: { product_id: 1, quantity: 2 } });

    assert.equal(res.status, 201);
    assert.equal(res.body.total_price, 300000);
    assert.equal(fake.db.products[0].quantity, 8);
    assert.deepEqual(fake.rpcCalls[0], { name: "record_sale", args: { p_product_id: 1, p_quantity: 2 } });
});

withApp("sale errors reach the client in the 'error' field", {}, async ({ call }) => {
    const tooMany = await call("/sales", { method: "POST", body: { product_id: 2, quantity: 50 } });
    assert.equal(tooMany.status, 400);
    assert.equal(tooMany.body.error, "Insufficient stock");

    const missing = await call("/sales", { method: "POST", body: { product_id: 999, quantity: 1 } });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error, "Product not found");

    assert.equal((await call("/sales", { method: "POST", body: { quantity: 1 } })).status, 400);
    assert.equal((await call("/sales", { method: "POST", body: { product_id: 1, quantity: -1 } })).status, 400);
});

withApp("lists sales with product names and gets one sale", {}, async ({ call }) => {
    const list = await call("/sales");
    assert.equal(list.body.sales[0].products.product_name, "Smart TV");

    assert.equal((await call("/sales/1")).body.sale.id, 1);
    assert.equal((await call("/sales/999")).status, 404);
    assert.equal((await call("/sales/zero")).status, 400);
});


/* ---------------- Dashboard ---------------- */

withApp("dashboard returns statistics and low-stock products with names", {}, async ({ call }) => {
    const res = await call("/dashboard");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.statistics, {
        totalProducts: 2, totalStock: 12, totalSales: 1, totalRevenue: 150000, lowStockCount: 1
    });
    assert.equal(res.body.lowStockProducts.length, 1);
    assert.equal(res.body.lowStockProducts[0].product_name, "Phone");
    assert.equal(res.body.lowStockProducts[0].brand, "Samsung");
});


/* ---------------- Errors, CORS ---------------- */

withApp("unknown routes and bad JSON return JSON errors", {}, async ({ call }) => {
    const missing = await call("/nope");
    assert.equal(missing.status, 404);
    assert.ok(missing.body.error);

    const badJson = await call("/products", { method: "POST", rawBody: "{not json" });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.error, "Request body is not valid JSON");
});

withApp("database error details are hidden in production but available in development", {}, async ({ call, fake }) => {
    fake.failures.push({ table: "products", op: "select" });
    const dev = await call("/products");
    assert.equal(dev.status, 500);
    assert.equal(dev.body.error, "Failed to retrieve products");
    assert.ok(dev.body.detail);
});

withApp("production does not leak database details", { config: { isProduction: true } }, async ({ call, fake }) => {
    fake.failures.push({ table: "products", op: "select" });
    const prod = await call("/products");
    assert.equal(prod.status, 500);
    assert.equal("detail" in prod.body, false);
});

withApp("CORS allows local development origins and blocks unknown sites", {}, async ({ call }) => {
    const local = await call("/health", { token: null, headers: { Origin: "http://localhost:5500" } });
    assert.equal(local.headers.get("access-control-allow-origin"), "http://localhost:5500");

    const evil = await call("/health", { token: null, headers: { Origin: "http://evil.example" } });
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
});

withApp("in production only listed origins are allowed", { config: { isProduction: true, corsOrigins: ["https://shop.example"] } }, async ({ call }) => {
    const listed = await call("/health", { token: null, headers: { Origin: "https://shop.example" } });
    assert.equal(listed.headers.get("access-control-allow-origin"), "https://shop.example");

    const local = await call("/health", { token: null, headers: { Origin: "http://localhost:5500" } });
    assert.equal(local.headers.get("access-control-allow-origin"), null);
});
