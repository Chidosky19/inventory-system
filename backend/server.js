/**
 * Entry point: loads configuration, connects to Supabase and starts the API.
 */
const config = require("./src/config");
const { createSupabase } = require("./src/supabase");
const { createApp } = require("./src/app");

const missing = ["SUPABASE_URL", "SUPABASE_SECRET_KEY"].filter(name => !process.env[name]);

if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    console.error("Copy .env.example to .env and fill in the values.");
    process.exit(1);
}

if (config.adminEmails.length === 0) {
    console.warn(
        "WARNING: ADMIN_EMAILS is not set, so any signed-in account WITHOUT an employee role is treated as an admin.\n" +
        "         Set ADMIN_EMAILS in .env and disable public sign-ups in Supabase."
    );
}

const supabase = createSupabase(config.supabaseUrl, config.supabaseKey);

// With the public key we can let Supabase send the confirmation email on sign-up
const publicSupabase = config.supabaseAnonKey
    ? createSupabase(config.supabaseUrl, config.supabaseAnonKey)
    : null;

if (!publicSupabase) {
    console.warn(
        "NOTE: SUPABASE_ANON_KEY is not set, so new employees are created without a confirmation email.\n" +
        "      Add it to .env to turn on email confirmation."
    );
}

const app = createApp({ supabase, publicSupabase, config });

app.listen(config.port, () => {
    console.log(`Server running on ${config.siteUrl}`);
    console.log(`Open ${config.siteUrl}/employee-login.html or ${config.siteUrl}/login.html (admin)`);
});
