const HttpError = require("./httpError");

const isPositiveInteger = value => Number.isInteger(value) && value > 0;

/** Convert a URL parameter to a positive integer id, or throw a 400. */
function parseId(value, label = "ID") {
    const id = Number(value);

    if (!isPositiveInteger(id)) {
        throw new HttpError(400, `Invalid ${label}`);
    }

    return id;
}

/** Validate the quantity of a stock movement or sale. */
function parseQuantity(quantity) {
    if (!isPositiveInteger(quantity)) {
        throw new HttpError(400, "Quantity must be a positive whole number");
    }

    return quantity;
}

const requiredText = label => value => {
    if (typeof value !== "string" || value.trim() === "") {
        throw new HttpError(400, `${label} is required`);
    }
    return value.trim();
};

const optionalText = label => value => {
    if (value === null || value === undefined) return "";
    if (typeof value !== "string") throw new HttpError(400, `${label} must be text`);
    return value.trim();
};

const price = label => value => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new HttpError(400, `${label} must be greater than zero`);
    }
    return value;
};

const wholeNumber = label => value => {
    if (!Number.isInteger(value) || value < 0) {
        throw new HttpError(400, `${label} must be a whole number (0 or more)`);
    }
    return value;
};

const PRODUCT_RULES = {
    product_name: requiredText("Product name"),
    brand: requiredText("Brand"),
    category: requiredText("Category"),
    model: optionalText("Model"),
    price: price("Price"),
    quantity: wholeNumber("Quantity"),
    low_stock_limit: wholeNumber("Low stock limit"),
    description: optionalText("Description")
};

const REQUIRED_ON_CREATE = ["product_name", "brand", "category", "price", "quantity", "low_stock_limit"];

/**
 * Validate a product payload and return only the allowed, cleaned fields.
 * With { partial: true } (updates) only the fields that were sent are checked.
 */
function parseProduct(body, { partial = false } = {}) {
    const input = body && typeof body === "object" ? body : {};
    const product = {};

    for (const [field, clean] of Object.entries(PRODUCT_RULES)) {
        const provided = input[field] !== undefined;

        if (!provided && !partial && REQUIRED_ON_CREATE.includes(field)) {
            clean(undefined); // throws the matching "... is required" / "must be ..." error
        }

        if (provided) product[field] = clean(input[field]);
    }

    if (Object.keys(product).length === 0) {
        throw new HttpError(400, "No product details were provided");
    }

    return product;
}

module.exports = { parseId, parseQuantity, parseProduct };
