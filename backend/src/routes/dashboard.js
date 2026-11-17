const express = require("express");
const HttpError = require("../utils/httpError");
const { unwrap } = require("../utils/db");
const { isPendingEmployee } = require("./employees");

// Counting pending employees means reading the account list, so remember the answer briefly.
const PENDING_CACHE_MS = 30 * 1000;

module.exports = function dashboardRouter(supabase) {
    const router = express.Router();
    let pendingCache = { at: 0, count: 0 };

    async function countPendingEmployees() {
        if (Date.now() - pendingCache.at < PENDING_CACHE_MS) return pendingCache.count;

        const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

        if (error) {
            console.error("Alerts: could not count pending employees:", error.message);
            return pendingCache.count;
        }

        pendingCache = { at: Date.now(), count: data.users.filter(isPendingEmployee).length };
        return pendingCache.count;
    }

    // ALERTS: a few small numbers the notification bell checks every few seconds.
    // When any of them changes, the page loads the full details.
    router.get("/alerts", async (req, res) => {
        const [salesResult, unreadResult, pendingEmployees] = await Promise.all([
            supabase
                .from("sales")
                .select("id, created_at, quantity, total_price, sold_by, products (product_name)", { count: "exact" })
                .order("created_at", { ascending: false })
                .limit(1),
            supabase
                .from("contact_messages")
                .select("id", { count: "exact", head: true })
                .eq("is_read", false),
            countPendingEmployees()
        ]);

        if (salesResult.error) {
            console.error("Alerts: could not read sales:", salesResult.error.message);
            throw new HttpError(500, "Failed to retrieve alerts");
        }

        if (unreadResult.error) {
            console.error("Alerts: could not count unread messages:", unreadResult.error.message);
        }

        const latest = salesResult.data && salesResult.data.length > 0 ? salesResult.data[0] : null;

        res.status(200).json({
            totalSales: salesResult.count ?? (salesResult.data ? salesResult.data.length : 0),
            latestSale: latest,
            unreadMessages: unreadResult.count || 0,
            pendingEmployees
        });
    });

    // DASHBOARD STATISTICS
    router.get("/", async (req, res) => {
        const [productsResult, salesResult] = await Promise.all([
            supabase.from("products").select("id, product_name, brand, quantity, low_stock_limit"),
            supabase.from("sales").select("total_price")
        ]);

        const products = unwrap(productsResult, "Failed to retrieve dashboard statistics");
        const sales = unwrap(salesResult, "Failed to retrieve dashboard statistics");

        const lowStockProducts = products.filter(product => product.quantity <= product.low_stock_limit);

        res.status(200).json({
            message: "Dashboard statistics retrieved successfully",
            statistics: {
                totalProducts: products.length,
                totalStock: products.reduce((total, product) => total + product.quantity, 0),
                totalSales: sales.length,
                totalRevenue: sales.reduce((total, sale) => total + Number(sale.total_price), 0),
                lowStockCount: lowStockProducts.length
            },
            lowStockProducts
        });
    });

    return router;
};
