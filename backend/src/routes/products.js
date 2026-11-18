const express = require("express");
const HttpError = require("../utils/httpError");
const { unwrap } = require("../utils/db");
const { parseId, parseProduct } = require("../utils/validate");
const { ROLES, requireRole } = require("../middleware/auth");

// Employees can read products (to make sales); only admins can change them
const adminOnly = requireRole(ROLES.ADMIN);

module.exports = function productsRouter(supabase) {
    const router = express.Router();

    // GET ALL PRODUCTS
    router.get("/", async (req, res) => {
        const products = unwrap(
            await supabase.from("products").select("*").order("id", { ascending: false }),
            "Failed to retrieve products"
        );

        res.status(200).json({
            message: "Products retrieved successfully",
            totalProducts: products.length,
            products
        });
    });

    // GET SINGLE PRODUCT
    router.get("/:id", async (req, res) => {
        const id = parseId(req.params.id, "product ID");

        const product = unwrap(
            await supabase.from("products").select("*").eq("id", id).maybeSingle(),
            "Failed to retrieve product"
        );

        if (!product) throw new HttpError(404, "Product not found");

        res.status(200).json({ message: "Product retrieved successfully", product });
    });

    // ADD NEW PRODUCT
    router.post("/", adminOnly, async (req, res) => {
        const fields = parseProduct(req.body);

        const [product] = unwrap(
            await supabase.from("products").insert([fields]).select(),
            "Failed to add product",
            400
        );

        res.status(201).json({ message: "Product added successfully", product });
    });

    // UPDATE PRODUCT
    router.put("/:id", adminOnly, async (req, res) => {
        const id = parseId(req.params.id, "product ID");
        const fields = parseProduct(req.body, { partial: true });

        const updated = unwrap(
            await supabase.from("products").update(fields).eq("id", id).select(),
            "Failed to update product",
            400
        );

        if (updated.length === 0) throw new HttpError(404, "Product not found");

        res.status(200).json({ message: "Product updated successfully", product: updated[0] });
    });

    // DELETE PRODUCT
    router.delete("/:id", adminOnly, async (req, res) => {
        const id = parseId(req.params.id, "product ID");

        const { data: deleted, error } = await supabase.from("products").delete().eq("id", id).select();

        if (error) {
            // 23503 = the database refused because sales or stock history still point at this product
            if (error.code === "23503" || /foreign key|violates/i.test(error.message)) {
                throw new HttpError(
                    409,
                    "This product can't be deleted because it already has sales or stock records. " +
                    "Set its quantity to 0 instead, or see sql/optional-allow-product-delete.sql."
                );
            }

            console.error("Failed to delete product:", error.message);
            throw new HttpError(400, "Failed to delete product", { detail: error.message });
        }

        if (deleted.length === 0) throw new HttpError(404, "Product not found");

        res.status(200).json({ message: "Product deleted successfully" });
    });

    return router;
};
