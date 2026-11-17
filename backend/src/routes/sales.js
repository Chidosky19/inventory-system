const express = require("express");
const HttpError = require("../utils/httpError");
const { unwrap } = require("../utils/db");
const { parseId, parseQuantity } = require("../utils/validate");
const { ROLES } = require("../middleware/auth");

const SALE_COLUMNS = "*, products (product_name, brand, category)";

/** Admins see every sale; employees only see the sales they recorded themselves. */
function limitToOwnSales(query, req) {
    return req.role === ROLES.EMPLOYEE ? query.eq("created_by", req.user.id) : query;
}

/**
 * Find the new sale's id in whatever record_sale returned. Depending on how the
 * database function was written it can be a row, an array of rows, a bare number,
 * or a row that calls the id "sale_id".
 */
function extractSaleId(data) {
    const value = Array.isArray(data) ? data[0] : data;

    if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) return Number(value);
    if (value && typeof value === "object") {
        const id = value.id ?? value.sale_id ?? (value.sale && value.sale.id);
        if (id !== undefined && id !== null) return id;
    }

    return null;
}

module.exports = function salesRouter(supabase) {
    const router = express.Router();

    // RECORD SALE (stock is reduced atomically by the "record_sale" database function)
    router.post("/", async (req, res) => {
        const body = req.body || {};
        const productId = parseId(body.product_id, "product ID");
        const quantity = parseQuantity(body.quantity);

        const { data, error } = await supabase.rpc("record_sale", {
            p_product_id: productId,
            p_quantity: quantity
        });

        if (error) {
            if (error.message.includes("Insufficient stock") || error.message.includes("Product not found")) {
                throw new HttpError(400, error.message);
            }

            console.error("Failed to record sale:", error.message);
            throw new HttpError(500, "Failed to record sale", { detail: error.message });
        }

        let saleId = extractSaleId(data);

        // Last resort: the function returned no usable id, so look for the sale we just
        // made (newest one for this product and quantity that nobody has claimed yet).
        if (saleId === null) {
            console.error("record_sale returned no sale id; its result was:", JSON.stringify(data));

            const { data: found } = await supabase
                .from("sales")
                .select("id")
                .eq("product_id", productId)
                .eq("quantity", quantity)
                .is("created_by", null)
                .order("created_at", { ascending: false })
                .limit(1);

            if (found && found.length > 0) saleId = found[0].id;
        }

        // Remember who made the sale (this is what the employee's "my sales" list is
        // filtered on). The sale itself already went through, so if this step fails we
        // log it and send a warning back instead of reporting a failed sale.
        const metadata = req.user.user_metadata || {};
        let warning;

        if (saleId === null) {
            console.error("Could not work out which sale to link to", req.user.email);
            warning = "Sale recorded, but it could not be linked to your account.";
        } else {
            const { data: tagged, error: ownerError } = await supabase
                .from("sales")
                .update({ created_by: req.user.id, sold_by: metadata.name || req.user.email })
                .eq("id", saleId)
                .select("id");

            if (ownerError || !tagged || tagged.length === 0) {
                console.error(
                    "Sale recorded but could not save who made it (did you run sql/001_employee_support.sql?):",
                    ownerError ? ownerError.message : "no row updated"
                );
                warning = "Sale recorded, but it could not be linked to your account.";
            }
        }

        const sale = data && typeof data === "object" && !Array.isArray(data) ? data : { id: saleId };

        res.status(201).json(warning ? { ...sale, warning } : sale);
    });

    // GET SALES
    router.get("/", async (req, res) => {
        const query = supabase.from("sales").select(SALE_COLUMNS);

        const sales = unwrap(
            await limitToOwnSales(query, req).order("created_at", { ascending: false }),
            "Failed to retrieve sales"
        );

        res.status(200).json({
            message: "Sales retrieved successfully",
            totalSales: sales.length,
            sales
        });
    });

    // LATEST SALE: a very small request that lets the notification bell spot a new sale
    // without downloading every sale. Admins see the newest sale overall; employees their own.
    // (This must stay above "/:id", otherwise "latest" would be read as a sale ID.)
    router.get("/latest", async (req, res) => {
        const query = supabase
            .from("sales")
            .select("id, created_at, quantity, total_price, sold_by, products (product_name)", { count: "exact" });

        const { data, error, count } = await limitToOwnSales(query, req)
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) {
            console.error("Failed to read the latest sale:", error.message);
            throw new HttpError(500, "Failed to retrieve the latest sale");
        }

        res.status(200).json({
            totalSales: count ?? (data ? data.length : 0),
            latest: data && data.length > 0 ? data[0] : null
        });
    });

    // GET ONE SALE
    router.get("/:id", async (req, res) => {
        const id = parseId(req.params.id, "sale ID");
        const query = supabase.from("sales").select(SALE_COLUMNS).eq("id", id);

        const sale = unwrap(
            await limitToOwnSales(query, req).maybeSingle(),
            "Failed to retrieve sale"
        );

        if (!sale) throw new HttpError(404, "Sale not found");

        res.status(200).json({ message: "Sale retrieved successfully", sale });
    });

    return router;
};
