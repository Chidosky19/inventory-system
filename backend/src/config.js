require("dotenv").config();

const list = value =>
    (value || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

module.exports = {
    port: Number(process.env.PORT) || 3000,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SECRET_KEY,
    // Public (publishable) key. Needed so Supabase can email a confirmation link on sign-up.
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    // Address the app is reached at. Links in emails send people back here.
    siteUrl: (process.env.SITE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/+$/, ""),
    // The front-end folder is served by this same server
    frontendDir: require("path").join(__dirname, "..", "..", "frontend"),
    adminEmails: list(process.env.ADMIN_EMAILS).map(email => email.toLowerCase()),
    corsOrigins: list(process.env.CORS_ORIGINS),
    isProduction: process.env.NODE_ENV === "production",
    // new employee sign-ups must be approved by an admin unless this is set to "false"
    requireApproval: process.env.REQUIRE_APPROVAL !== "false"
};
