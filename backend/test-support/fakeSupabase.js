/**
 * A tiny in-memory stand-in for the Supabase client, just big enough for the
 * queries this API makes. Used by the tests so no real database is needed.
 */
function createFakeSupabase(seed = {}) {
    const db = {
        products: seed.products || [],
        sales: seed.sales || [],
        stock_history: seed.stock_history || []
    };
    const users = seed.users || {};
    const nextId = { products: 1000, sales: 1000, stock_history: 1000 };

    const fake = {
        db,
        failures: [],        // e.g. { table: "stock_history", op: "insert" } fails once
        beforeWrite: null,   // (table, op) => void, lets a test simulate a concurrent change
        rpcCalls: []
    };

    const clone = value => JSON.parse(JSON.stringify(value));

    class Query {
        constructor(table) {
            this.table = table;
            this.op = "select";
            this.columns = "*";
            this.filters = [];
            this.sort = null;
            this.values = null;
            this.single = false;
        }

        select(columns = "*") { this.columns = columns; return this; }
        insert(values) { this.op = "insert"; this.values = values; return this; }
        update(values) { this.op = "update"; this.values = values; return this; }
        delete() { this.op = "delete"; return this; }
        eq(column, value) { this.filters.push(row => row[column] === value); return this; }
        order(column, { ascending = true } = {}) { this.sort = { column, ascending }; return this; }
        maybeSingle() { this.single = true; return this; }

        then(resolve, reject) {
            try { resolve(this.run()); } catch (error) { reject(error); }
        }

        project(row) {
            let out = clone(row);

            if (/products\s*\(/.test(this.columns) && row.product_id !== undefined) {
                const product = db.products.find(p => p.id === row.product_id);
                out.products = product
                    ? { product_name: product.product_name, brand: product.brand, category: product.category }
                    : null;
            }

            if (!this.columns.trim().startsWith("*") && !/products\s*\(/.test(this.columns)) {
                const wanted = this.columns.split(",").map(name => name.trim());
                out = Object.fromEntries(wanted.filter(name => name in row).map(name => [name, row[name]]));
            }

            return out;
        }

        run() {
            const failureIndex = fake.failures.findIndex(f => f.table === this.table && f.op === this.op);
            if (failureIndex !== -1) {
                fake.failures.splice(failureIndex, 1);
                return { data: null, error: { message: "simulated database failure" } };
            }

            if (this.op !== "select" && fake.beforeWrite) fake.beforeWrite(this.table, this.op);

            const rows = db[this.table];
            const matches = rows.filter(row => this.filters.every(test => test(row)));

            if (this.op === "insert") {
                const created = this.values.map(values => {
                    const row = { id: nextId[this.table]++, created_at: new Date().toISOString(), ...clone(values) };
                    rows.push(row);
                    return row;
                });
                return { data: created.map(row => this.project(row)), error: null };
            }

            if (this.op === "update") {
                matches.forEach(row => Object.assign(row, clone(this.values)));
                return { data: matches.map(row => this.project(row)), error: null };
            }

            if (this.op === "delete") {
                matches.forEach(row => rows.splice(rows.indexOf(row), 1));
                return { data: matches.map(row => this.project(row)), error: null };
            }

            let result = matches.map(row => this.project(row));

            if (this.sort) {
                const { column, ascending } = this.sort;
                result.sort((a, b) => (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1));
            }

            return { data: this.single ? (result[0] || null) : result, error: null };
        }
    }

    fake.from = table => new Query(table);

    fake.rpc = async (name, args) => {
        fake.rpcCalls.push({ name, args });

        if (name !== "record_sale") return { data: null, error: { message: `Unknown function ${name}` } };

        const product = db.products.find(p => p.id === args.p_product_id);
        if (!product) return { data: null, error: { message: "Product not found" } };
        if (product.quantity < args.p_quantity) return { data: null, error: { message: "Insufficient stock" } };

        product.quantity -= args.p_quantity;

        const sale = {
            id: nextId.sales++,
            product_id: product.id,
            quantity: args.p_quantity,
            unit_price: product.price,
            total_price: product.price * args.p_quantity,
            created_at: new Date().toISOString()
        };
        db.sales.push(sale);

        return { data: sale, error: null };
    };

    // ---- Auth: users are keyed by access token; the same objects back the admin API
    const authUsers = Object.values(users);
    fake.authUsers = authUsers; // exposed so tests can inspect accounts
    authUsers.forEach((user, index) => {
        user.created_at = user.created_at || `2026-01-0${(index % 9) + 1}T00:00:00Z`;
    });
    let nextUser = 1;

    const notFound = { data: { user: null }, error: { message: "User not found" } };
    const findUser = id => authUsers.find(user => user.id === id);

    fake.auth = {
        getUser: async token => users[token]
            ? { data: { user: users[token] }, error: null }
            : { data: { user: null }, error: { message: "invalid token" } },

        admin: {
            createUser: async ({ email, password, app_metadata, user_metadata, ban_duration }) => {
                if (authUsers.some(user => user.email === email)) {
                    return { data: { user: null }, error: { message: "A user with this email address has already been registered" } };
                }

                const id = `00000000-0000-4000-8000-${String(nextUser++).padStart(12, "0")}`;
                const user = { id, email, app_metadata: app_metadata || {}, user_metadata: user_metadata || {}, created_at: new Date().toISOString(), password };

                if (ban_duration) user.banned_until = "2999-01-01T00:00:00Z";

                authUsers.push(user);
                users[`token-${id}`] = user;

                return { data: { user }, error: null };
            },

            listUsers: async () => ({ data: { users: [...authUsers] }, error: null }),

            getUserById: async id => findUser(id) ? { data: { user: findUser(id) }, error: null } : notFound,

            updateUserById: async (id, attributes) => {
                const user = findUser(id);
                if (!user) return notFound;

                if ("password" in attributes) user.password = attributes.password;

                if ("ban_duration" in attributes) {
                    user.banned_until = attributes.ban_duration === "none"
                        ? null
                        : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
                }

                return { data: { user }, error: null };
            },

            deleteUser: async id => {
                const user = findUser(id);
                if (!user) return { data: null, error: { message: "User not found" } };

                authUsers.splice(authUsers.indexOf(user), 1);
                Object.keys(users).filter(token => users[token] === user).forEach(token => delete users[token]);

                return { data: {}, error: null };
            }
        }
    };

    return fake;
}

module.exports = { createFakeSupabase };
