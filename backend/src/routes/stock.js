const express = require("express");
const HttpError = require("../utils/httpError");
const { unwrap } = require("../utils/db");
const { parseId, parseQuantity } = require("../utils/validate");

const MOVEMENTS = {
    stock_in: { sign: 1, defaultNote: "Stock added", failure: "Failed to add stock", success: "Stock added successfully" },
    stock_out: { sign: -1, defaultNote: "Stock removed", failure: "Failed to remove stock", success: "Stock removed successfully" }
};

module.exports = function stockRouter(supabase) {
    const router = express.Router();

    /**
     * Add or remove stock and record it in the history.
     *
     * The quantity update only succeeds if the stock is still what we read
     * (.eq("quantity", previous)). If another request changed it in the
     * meantime, nothing is written and the caller is asked to retry. This stops
     * two simultaneous requests from overwriting each other.
     */
    async function moveStock(type, req, res) {
        const movement = MOVEMENTS[type];
        const productId = parseId(req.params.productId, "product ID");
        const quantity = parseQuantity(req.body && req.body.quantity);
        const note = typeof req.body.note === "string" && req.body.note.trim() ? req.body.note.trim() : movement.defaultNote;

        const product = unwrap(
            await supabase.from("products").select("id, quantity").eq("id", productId).maybeSingle(),
            movement.failure
        );

        if (!product) throw new HttpError(404, "Product not found");

        const previousQuantity = product.quantity;
        const newQuantity = previousQuantity + movement.sign * quantity;

        if (newQuantity < 0) {
            throw new HttpError(400, "Insufficient stock", { extra: { availableStock: previousQuantity } });
        }

        const updated = unwrap(
            await supabase
                .from("products")
                .update({ quantity: newQuantity })
                .eq("id", productId)
                .eq("quantity", previousQuantity)
                .select("id"),
            movement.failure
        );

        if (updated.length === 0) {
            throw new HttpError(409, "Stock was changed by another request. Please try again.");
        }

        const { error: historyError } = await supabase.from("stock_history").insert([{
            product_id: productId,
            transaction_type: type,
            quantity,
            note
        }]);

        if (historyError) {
            // Best effort: put the quantity back so stock and history stay consistent
            await supabase
                .from("products")
                .update({ quantity: previousQuantity })
                .eq("id", productId)
                .eq("quantity", newQuantity);

            console.error(`${movement.failure} (history):`, historyError.message);
            throw new HttpError(500, movement.failure, { detail: historyError.message });
        }

        const result = type === "stock_in"
            ? { addedQuantity: quantity }
            : { removedQuantity: quantity };

        res.status(200).json({
            message: movement.success,
            productId,
            previousQuantity,
            ...result,
            newQuantity
        });
    }

    router.post("/in/:productId", (req, res) => moveStock("stock_in", req, res));
    router.post("/out/:productId", (req, res) => moveStock("stock_out", req, res));

    // STOCK HISTORY
    router.get("/history", async (req, res) => {
        const history = unwrap(
            await supabase
                .from("stock_history")
                .select("*, products (product_name, brand)")
                .order("created_at", { ascending: false }),
            "Failed to retrieve stock history"
        );

        res.status(200).json({
            message: "Stock history retrieved successfully",
            totalTransactions: history.length,
            history
        });
    });

    return router;
};
