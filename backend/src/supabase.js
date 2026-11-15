const { createClient } = require("@supabase/supabase-js");

/**
 * Server-side Supabase client. It uses the secret key, which bypasses Row Level
 * Security - that is why every route is protected by the auth middleware.
 */
function createSupabase(url, secretKey) {
    return createClient(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

module.exports = { createSupabase };
