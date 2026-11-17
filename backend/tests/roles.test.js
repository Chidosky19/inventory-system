const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../src/app");
const { createFakeSupabase } = require("../test-support/fakeSupabase");

const ADA = "11111111-1111-4111-8111-111111111111";
const BOLA = "22222222-2222-4222-8222-222222222222";
const BOSS = "33333333-3333-4333-8333-333333333333";
const GONE = "44444444-4444-4444-8444-444444444444";

const seedData = () => ({
    users: {
        "admin-token": { id: BOSS, email: "boss@shop.com", user_metadata: { name: "The Boss" } },
        "ada-token": { id: ADA, email: "ada@shop.com", app_metadata: { role: "employee" }, user_metadata: { name: "Ada" } },
        "bola-token": { id: BOLA, email: "bola@shop.com", app_metadata: { role: "employee" }, user_metadata: { name: "Bola" } },
        "gone-token": { id: GONE, email: "gone@shop.com", app_metadata: { role: "employee" }, banned_until: "2999-01-01T00:00:00Z" },
        "nobody-token": { id: "55555555-5555-4555-8555-555555555555", email: "nobody@shop.com" }
    },
    products: [
        { id: 1, product_name: "Smart TV", brand: "LG", category: "Television", model: "", price: 150000, quantity: 10, low_stock_limit: 3 },
        { id: 2, product_name: "Phone", brand: "Samsung", category: "Phones", model: "", price: 90000, quantity: 2, low_stock_limit: 5 }
    ],
    sales: [
        { id: 1, product_id: 1, quantity: 1, unit_price: 150000, total_price: 150000, created_at: "2026-11-01T10:00:00Z", created_by: BOLA, sold_by: "Bola" },
        { id: 2, product_id: 2, quantity: 1, unit_price: 90000, total_price: 90000, created_at: "2026-11-02T10:00:00Z" }
    ]
});

async function startApp() {
    const fake = createFakeSupabase(seedData());
    const app = createApp({
        supabase: fake,
        config: { adminEmails: ["boss@shop.com"], corsOrigins: [], isProduction: false }
    });

    const server = await new Promise(resolve => {
        const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const base = `http://127.0.0.1:${server.address().port}`;

    async function call(path, { method = "GET", body, token = "admin-token" } = {}) {
        const response = await fetch(base + path, {
            method,
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined ? { "Content-Type": "application/json" } : {})
            },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        return { status: response.status, body: await response.json().catch(() => null) };
    }

    return { call, fake, close: () => new Promise(resolve => server.close(resolve)) };
}

const withApp = (name, fn) =>
    test(name, async () => {
        const app = await startApp();
        try { await fn(app); } finally { await app.close(); }
    });


/* ---------------- Who is who ---------------- */

withApp("/me reports the role and name", async ({ call }) => {
    const admin = await call("/me");
    assert.deepEqual([admin.body.role, admin.body.name], ["admin", "The Boss"]);

    const employee = await call("/me", { token: "ada-token" });
    assert.deepEqual([employee.body.role, employee.body.name, employee.body.email], ["employee", "Ada", "ada@shop.com"]);
});

withApp("an account with no role and not in ADMIN_EMAILS gets no access", async ({ call }) => {
    assert.equal((await call("/me", { token: "nobody-token" })).status, 403);
    assert.equal((await call("/products", { token: "nobody-token" })).status, 403);
});

withApp("a disabled employee is locked out even with a valid token", async ({ call }) => {
    const res = await call("/products", { token: "gone-token" });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /disabled/);
});


/* ---------------- What employees can and cannot do ---------------- */

withApp("employees are blocked from every admin-only feature", async ({ call }) => {
    const blocked = [
        ["GET", "/dashboard"],
        ["GET", "/stock/history"],
        ["POST", "/stock/in/1", { quantity: 1 }],
        ["POST", "/stock/out/1", { quantity: 1 }],
        ["POST", "/products", { product_name: "X", brand: "Y", category: "Z", price: 1, quantity: 1, low_stock_limit: 1 }],
        ["PUT", "/products/1", { price: 1 }],
        ["DELETE", "/products/1"],
        ["GET", "/employees"],
        ["POST", "/employees", { name: "Eve", email: "eve@shop.com", password: "password123" }],
        ["PATCH", `/employees/${BOLA}`, { disabled: true }],
        ["DELETE", `/employees/${BOLA}`]
    ];

    for (const [method, path, body] of blocked) {
        const res = await call(path, { method, body, token: "ada-token" });
        assert.equal(res.status, 403, `${method} ${path}`);
        assert.equal(res.body.error, "You do not have permission to do this");
    }
});

withApp("blocked requests change nothing", async ({ call, fake }) => {
    await call("/products/1", { method: "DELETE", token: "ada-token" });
    await call("/stock/in/1", { method: "POST", body: { quantity: 99 }, token: "ada-token" });

    assert.equal(fake.db.products.length, 2);
    assert.equal(fake.db.products[0].quantity, 10);
});

withApp("employees can read products", async ({ call }) => {
    const list = await call("/products", { token: "ada-token" });
    assert.equal(list.status, 200);
    assert.equal(list.body.products.length, 2);

    assert.equal((await call("/products/1", { token: "ada-token" })).status, 200);
});

withApp("an employee can record a sale and it is credited to them", async ({ call, fake }) => {
    const res = await call("/sales", { method: "POST", body: { product_id: 1, quantity: 2 }, token: "ada-token" });

    assert.equal(res.status, 201);
    assert.equal(fake.db.products[0].quantity, 8);

    const stored = fake.db.sales.find(sale => sale.id === res.body.id);
    assert.equal(stored.created_by, ADA);
    assert.equal(stored.sold_by, "Ada");
});

withApp("admin sales are labelled with the admin's name", async ({ call, fake }) => {
    const res = await call("/sales", { method: "POST", body: { product_id: 1, quantity: 1 } });
    assert.equal(fake.db.sales.find(sale => sale.id === res.body.id).sold_by, "The Boss");
});

withApp("the latest-sale check returns the newest sale and a count, limited to what the caller may see", async ({ call }) => {
    const admin = await call("/sales/latest");
    assert.equal(admin.status, 200);
    assert.equal(admin.body.totalSales, 2);
    assert.equal(admin.body.latest.id, 2);                       // the newest sale overall

    const bola = await call("/sales/latest", { token: "bola-token" });
    assert.equal(bola.body.totalSales, 1);
    assert.equal(bola.body.latest.id, 1);                        // an employee only sees their own

    const ada = await call("/sales/latest", { token: "ada-token" });
    assert.equal(ada.body.totalSales, 0);
    assert.equal(ada.body.latest, null);                         // no sales yet
});

withApp("the alerts check reports the newest sale, unread messages and employees waiting for approval", async ({ call, fake }) => {
    fake.db.contact_messages.push(
        { id: 1, name: "A", email: "a@x.com", topic: "Support", message: "hi", is_read: false, created_at: "2026-11-03T10:00:00Z" },
        { id: 2, name: "B", email: "b@x.com", topic: "Support", message: "hi", is_read: true, created_at: "2026-11-03T11:00:00Z" }
    );
    fake.authUsers.push({
        id: "66666666-6666-4666-8666-666666666666", email: "new@shop.com",
        app_metadata: { role: "employee" }, user_metadata: { name: "New Person", self_registered: true },
        banned_until: "2999-01-01T00:00:00Z"
    });

    const res = await call("/dashboard/alerts");
    assert.equal(res.status, 200);
    assert.equal(res.body.totalSales, 2);
    assert.equal(res.body.latestSale.id, 2);
    assert.equal(res.body.unreadMessages, 1);        // the read one is not counted
    assert.equal(res.body.pendingEmployees, 1);      // the locked-out "Gone" account was not a self sign-up
});

withApp("employees cannot use the alerts check", async ({ call }) => {
    assert.equal((await call("/dashboard/alerts", { token: "ada-token" })).status, 403);
});

withApp("employees only see their own sales, admins see all", async ({ call }) => {
    await call("/sales", { method: "POST", body: { product_id: 1, quantity: 1 }, token: "ada-token" });

    const ada = await call("/sales", { token: "ada-token" });
    assert.equal(ada.body.sales.length, 1);
    assert.equal(ada.body.sales[0].sold_by, "Ada");

    const bola = await call("/sales", { token: "bola-token" });
    assert.deepEqual(bola.body.sales.map(sale => sale.id), [1]);

    const admin = await call("/sales");
    assert.equal(admin.body.sales.length, 3);
});

withApp("an employee cannot open another person's sale", async ({ call }) => {
    assert.equal((await call("/sales/1", { token: "ada-token" })).status, 404); // Bola's sale
    assert.equal((await call("/sales/2", { token: "ada-token" })).status, 404); // unowned sale
    assert.equal((await call("/sales/1", { token: "bola-token" })).status, 200);
    assert.equal((await call("/sales/1")).status, 200);                          // admin
});


/* ---------------- Managing employees (admin) ---------------- */

withApp("admin lists employees (and only employees)", async ({ call }) => {
    const res = await call("/employees");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.employees.map(e => e.email).sort(), ["ada@shop.com", "bola@shop.com", "gone@shop.com"]);

    const gone = res.body.employees.find(e => e.email === "gone@shop.com");
    assert.equal(gone.disabled, true);
    assert.equal("password" in res.body.employees[0], false);
});

withApp("admin creates an employee who can then work but not administer", async ({ call, fake }) => {
    const created = await call("/employees", {
        method: "POST",
        body: { name: "  Chidi ", email: " Chidi@Shop.com ", password: "password123" }
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.employee.name, "Chidi");
    assert.equal(created.body.employee.email, "chidi@shop.com");
    assert.equal("password" in created.body.employee, false);

    const token = `token-${created.body.employee.id}`;

    assert.equal((await call("/products", { token })).status, 200);
    assert.equal((await call("/employees", { token })).status, 403);
    assert.equal((await call("/me", { token })).body.role, "employee");
});

withApp("employee creation is validated", async ({ call }) => {
    const bad = [
        [{ email: "a@b.com", password: "password123" }, "Name is required"],
        [{ name: "A", email: "not-an-email", password: "password123" }, "Please enter a valid email address"],
        [{ name: "A", email: "a@b.com", password: "short" }, "Password must be at least 8 characters"],
        [{ name: "A", email: "ada@shop.com", password: "password123" }, "An account with this email already exists"]
    ];

    for (const [body, message] of bad) {
        const res = await call("/employees", { method: "POST", body });
        assert.equal(res.body.error, message);
        assert.ok(res.status === 400 || res.status === 409);
    }
});

withApp("admin can disable and re-enable an employee", async ({ call }) => {
    assert.equal((await call("/products", { token: "ada-token" })).status, 200);

    const off = await call(`/employees/${ADA}`, { method: "PATCH", body: { disabled: true } });
    assert.equal(off.status, 200);
    assert.equal(off.body.employee.disabled, true);
    assert.equal((await call("/products", { token: "ada-token" })).status, 403);

    const on = await call(`/employees/${ADA}`, { method: "PATCH", body: { disabled: false } });
    assert.equal(on.body.employee.disabled, false);
    assert.equal((await call("/products", { token: "ada-token" })).status, 200);

    assert.equal((await call(`/employees/${ADA}`, { method: "PATCH", body: { disabled: "yes" } })).status, 400);
});

withApp("admin can delete an employee, and their sales are kept", async ({ call, fake }) => {
    assert.equal((await call(`/employees/${BOLA}`, { method: "DELETE" })).status, 200);

    const list = await call("/employees");
    assert.equal(list.body.employees.some(e => e.id === BOLA), false);
    assert.equal((await call("/products", { token: "bola-token" })).status, 401); // token no longer valid
    assert.equal(fake.db.sales.length, 2);
});

withApp("admin accounts can never be changed through the employees API", async ({ call }) => {
    assert.equal((await call(`/employees/${BOSS}`, { method: "PATCH", body: { disabled: true } })).status, 404);
    assert.equal((await call(`/employees/${BOSS}`, { method: "DELETE" })).status, 404);
    assert.equal((await call("/employees/not-an-id", { method: "DELETE" })).status, 400);
    assert.equal((await call("/employees/99999999-9999-4999-8999-999999999999", { method: "DELETE" })).status, 404);
});


/* ---------------- Password reset (admin) ---------------- */

withApp("admin can reset an employee's password", async ({ call, fake }) => {
    const res = await call(`/employees/${ADA}/password`, { method: "PATCH", body: { password: "brand-new-pass1" } });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Password reset successfully");
    assert.equal(JSON.stringify(res.body).includes("brand-new-pass1"), false); // never echoed back
});

withApp("password reset really changes the password and leaves the rest of the account alone", async ({ call, fake }) => {
    const before = fake.authUsers.find(user => user.id === ADA);
    assert.notEqual(before.password, "another-pass-22");

    await call(`/employees/${ADA}/password`, { method: "PATCH", body: { password: "another-pass-22" } });

    const after = fake.authUsers.find(user => user.id === ADA);
    assert.equal(after.password, "another-pass-22");
    assert.equal(after.email, "ada@shop.com");
    assert.equal(after.app_metadata.role, "employee");

    // other employees are untouched
    assert.notEqual(fake.authUsers.find(user => user.id === BOLA).password, "another-pass-22");
});

withApp("password reset is validated", async ({ call }) => {
    const short = await call(`/employees/${ADA}/password`, { method: "PATCH", body: { password: "short" } });
    assert.equal(short.status, 400);
    assert.equal(short.body.error, "Password must be at least 8 characters");

    const missing = await call(`/employees/${ADA}/password`, { method: "PATCH", body: {} });
    assert.equal(missing.status, 400);

    const long = await call(`/employees/${ADA}/password`, { method: "PATCH", body: { password: "x".repeat(73) } });
    assert.equal(long.status, 400);
    assert.equal(long.body.error, "Password must be 72 characters or fewer");
});

withApp("only admins can reset passwords, and never for admin accounts", async ({ call }) => {
    const byEmployee = await call(`/employees/${BOLA}/password`, { method: "PATCH", body: { password: "hacked-pass-1" }, token: "ada-token" });
    assert.equal(byEmployee.status, 403);

    assert.equal((await call(`/employees/${BOSS}/password`, { method: "PATCH", body: { password: "hacked-pass-1" } })).status, 404);
    assert.equal((await call("/employees/nope/password", { method: "PATCH", body: { password: "hacked-pass-1" } })).status, 400);
    assert.equal((await call("/employees/99999999-9999-4999-8999-999999999999/password", { method: "PATCH", body: { password: "hacked-pass-1" } })).status, 404);
});


/* ---------------- Employee sign-up ---------------- */

withApp("anyone can sign up, and the new account waits for approval", async ({ call, fake }) => {
    const res = await call("/auth/register", {
        method: "POST",
        token: null,
        body: { name: "Chi", email: "Chi@Shop.com", phone: "0803 123 4567", password: "password123" }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.approvalRequired, true);

    const created = fake.authUsers.find(user => user.email === "chi@shop.com");
    assert.equal(created.app_metadata.role, "employee");
    assert.equal(created.user_metadata.phone, "08031234567");
    assert.ok(created.banned_until, "new sign-ups should be locked until approved");

    // the locked account cannot use the API yet
    const asChi = await call("/products", { token: `token-${created.id}` });
    assert.equal(asChi.status, 403);
});

withApp("sign-up rejects bad input and duplicate emails", async ({ call }) => {
    const send = body => call("/auth/register", { method: "POST", token: null, body });

    // the phone number is required and has to look like one
    assert.equal((await send({ name: "X", email: "x@shop.com", password: "password123" })).status, 400);
    assert.equal((await send({ name: "X", email: "x@shop.com", phone: "abc", password: "password123" })).status, 400);

    assert.equal((await send({ name: "", email: "x@shop.com", phone: "0803 123 4567", password: "password123" })).status, 400);
    assert.equal((await send({ name: "X", email: "not-an-email", phone: "0803 123 4567", password: "password123" })).status, 400);
    assert.equal((await send({ name: "X", email: "x@shop.com", password: "short" })).status, 400);
    assert.equal((await send({ name: "Ada Again", email: "ada@shop.com", phone: "0803 123 4567", password: "password123" })).status, 409);
});

withApp("a self-registered account shows as pending on the admin's list", async ({ call }) => {
    await call("/auth/register", { method: "POST", token: null, body: { name: "Chi", email: "chi@shop.com", phone: "0803 123 4567", password: "password123" } });

    const list = await call("/employees");
    const chi = list.body.employees.find(employee => employee.email === "chi@shop.com");

    assert.equal(chi.disabled, true);
    assert.equal(chi.pending, true);
});
