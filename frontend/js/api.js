/**
 * Single place for every request to the backend.
 * Every request carries the Supabase login token (see auth-guard.js).
 * Each method returns the parsed JSON, or throws an Error with a readable message.
 */
const Api = (() => {

    /** The signed-in user's access token, sent so the backend knows who is calling. */
    async function getAccessToken() {
        const { data } = await supabaseClient.auth.getSession();
        return data.session ? data.session.access_token : null;
    }

    async function request(path, { method = "GET", body, fallback = "Something went wrong" } = {}) {
        const options = { method, headers: {} };

        const token = await getAccessToken();
        if (token) options.headers.Authorization = `Bearer ${token}`;

        if (body !== undefined) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        let response;

        try {
            response = await fetch(`${CONFIG.API_URL}${path}`, options);
        } catch (error) {
            throw new Error("Could not connect to the server. Please check that the backend is running.");
        }

        if (response.status === 401) {
            window.location.replace("login.html");
            throw new Error("Your session has expired. Please log in again.");
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || result.message || fallback);
        }

        return result;
    }

    return {
        // Current user
        getMe: () => request("/me", { fallback: "Unable to load your account" }),

        // Dashboard
        getDashboard: () => request("/dashboard", { fallback: "Unable to load dashboard" }),
        getAlerts: () => request("/dashboard/alerts", { fallback: "Unable to check for new activity" }),

        // Products
        getProducts: () => request("/products", { fallback: "Unable to load products" }),
        getProduct: id => request(`/products/${id}`, { fallback: "Unable to get product" }),
        createProduct: product => request("/products", { method: "POST", body: product, fallback: "Could not add product" }),
        updateProduct: (id, product) => request(`/products/${id}`, { method: "PUT", body: product, fallback: "Unable to update product" }),
        deleteProduct: id => request(`/products/${id}`, { method: "DELETE", fallback: "Could not delete product" }),

        // Sales
        getSales: () => request("/sales", { fallback: "Unable to load sales" }),
        getLatestSale: () => request("/sales/latest", { fallback: "Unable to check for new sales" }),
        createSale: sale => request("/sales", { method: "POST", body: sale, fallback: "Unable to record sale" }),

        // Stock
        getStockHistory: () => request("/stock/history", { fallback: "Unable to load stock history" }),
        stockIn: (productId, data) => request(`/stock/in/${productId}`, { method: "POST", body: data, fallback: "Unable to add stock" }),
        stockOut: (productId, data) => request(`/stock/out/${productId}`, { method: "POST", body: data, fallback: "Unable to remove stock" }),

        // Contact page messages (admin only)
        getMessages: () => request("/messages", { fallback: "Unable to load messages" }),
        setMessageRead: (id, isRead) => request(`/messages/${id}`, { method: "PATCH", body: { is_read: isRead }, fallback: "Could not update the message" }),
        deleteMessage: id => request(`/messages/${id}`, { method: "DELETE", fallback: "Could not delete the message" }),

        // Employees (admin only)
        getEmployees: () => request("/employees", { fallback: "Unable to load employees" }),
        createEmployee: employee => request("/employees", { method: "POST", body: employee, fallback: "Could not add employee" }),
        setEmployeeDisabled: (id, disabled) => request(`/employees/${id}`, { method: "PATCH", body: { disabled }, fallback: "Could not update employee" }),
        resetEmployeePassword: (id, password) => request(`/employees/${id}/password`, { method: "PATCH", body: { password }, fallback: "Could not reset the password" }),
        deleteEmployee: id => request(`/employees/${id}`, { method: "DELETE", fallback: "Could not delete employee" })
    };
})();
