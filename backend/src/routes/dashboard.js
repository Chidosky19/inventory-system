const express = require("express");
const { unwrap } = require("../utils/db");

module.exports = function dashboardRouter(supabase) {
    const router = express.Router();

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
