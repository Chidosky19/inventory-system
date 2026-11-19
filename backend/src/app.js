const express = require("express");
const path = require("path");
const cors = require("cors");

const { ROLES, createRequireAuth, requireRole } = require("./middleware/auth");
const { notFound, createErrorHandler } = require("./middleware/errorHandler");

const productsRouter = require("./routes/products");
const stockRouter = require("./routes/stock");
const salesRouter = require("./routes/sales");
const dashboardRouter = require("./routes/dashboard");
const employeesRouter = require("./routes/employees");
const meRouter = require("./routes/me");
const authRouter = require("./routes/auth");

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Builds the Express app. The Supabase client and config are passed in
 * (instead of imported) so the app can be tested without a real database.
 */
function createApp({ supabase, publicSupabase = null, config }) {
    const app = express();

    app.disable("x-powered-by");

    // Only allow browsers from approved origins. Local development origins are
    // allowed outside production; list real front-end URLs in CORS_ORIGINS.
    app.use(cors({
        origin(origin, callback) {
            const allowed =
                !origin ||
                config.corsOrigins.includes(origin) ||
                (!config.isProduction && LOCAL_ORIGIN.test(origin));

            callback(null, allowed);
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    }));

    app.use(express.json({ limit: "100kb" }));

    // Public routes
    app.get("/health", (req, res) => res.json({ status: "ok" }));

    // When a front-end folder is configured, this server also serves the web pages,
    // so the whole system runs from one address. (Tests leave it out.)
    // Pages live in frontend/pages but are served from the root (/login.html), while
    // /css and /js come from the frontend folder itself.
    if (config.frontendDir) {
        app.get("/", (req, res) => res.redirect("/employee-login.html"));
        app.use(express.static(path.join(config.frontendDir, "pages"), { index: false }));
        app.use(express.static(config.frontendDir, { index: false }));
    } else {
        app.get("/", (req, res) => res.send("Electronics Inventory API is running"));
    }

    // Public API route: employee sign-up
    app.use("/auth", authRouter(supabase, {
        requireApproval: config.requireApproval !== false,
        publicSupabase,
        siteUrl: config.siteUrl
    }));

    // Everything below requires a signed-in user. Each route then decides who may use it:
    //   admin only    -> dashboard, employees, stock, product changes
    //   admin+employee -> product list (read), sales (employees only see their own)
    const adminOnly = requireRole(ROLES.ADMIN);

    app.use(createRequireAuth(supabase, config.adminEmails));

    app.use("/me", meRouter());
    app.use("/dashboard", adminOnly, dashboardRouter(supabase));
    app.use("/employees", adminOnly, employeesRouter(supabase));
    app.use("/stock", adminOnly, stockRouter(supabase));
    app.use("/products", productsRouter(supabase));
    app.use("/sales", salesRouter(supabase));

    app.use(notFound);
    app.use(createErrorHandler({ isProduction: config.isProduction }));

    return app;
}

module.exports = { createApp };
