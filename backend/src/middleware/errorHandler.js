const HttpError = require("../utils/httpError");

function notFound(req, res, next) {
    next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/** Turns every error into a consistent JSON body: { "error": "message" }. */
function createErrorHandler({ isProduction }) {
    // Express only treats a function as an error handler if it takes 4 arguments.
    // eslint-disable-next-line no-unused-vars
    return function errorHandler(err, req, res, next) {
        if (err instanceof HttpError) {
            const body = { error: err.message, ...err.extra };
            if (!isProduction && err.detail) body.detail = err.detail;
            return res.status(err.status).json(body);
        }

        if (err.type === "entity.parse.failed") {
            return res.status(400).json({ error: "Request body is not valid JSON" });
        }

        if (err.type === "entity.too.large") {
            return res.status(413).json({ error: "Request body is too large" });
        }

        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal server error" });
    };
}

module.exports = { notFound, createErrorHandler };
