const HttpError = require("../utils/httpError");

const ROLES = Object.freeze({ ADMIN: "admin", EMPLOYEE: "employee" });

/**
 * Work out a user's role.
 *
 * 1. Emails listed in ADMIN_EMAILS are always admins.
 * 2. Otherwise the role stored in Supabase "app_metadata" is used. Only this
 *    server can write app_metadata, so users cannot give themselves a role.
 * 3. If ADMIN_EMAILS is empty (older setups) an account with no role is
 *    treated as an admin, as before. Set ADMIN_EMAILS to switch this off.
 *
 * Returns null when the user has no access at all.
 */
function resolveRole(user, adminEmails) {
    const email = (user.email || "").toLowerCase();

    if (adminEmails.includes(email)) return ROLES.ADMIN;

    const role = user.app_metadata && user.app_metadata.role;
    if (role === ROLES.ADMIN || role === ROLES.EMPLOYEE) return role;

    return adminEmails.length === 0 ? ROLES.ADMIN : null;
}

function isDisabled(user) {
    return Boolean(user.banned_until) && new Date(user.banned_until) > new Date();
}

/**
 * Requires a valid Supabase login token ("Authorization: Bearer <token>") and
 * sets req.user and req.role for the routes that follow.
 */
function createRequireAuth(supabase, adminEmails = []) {
    return async function requireAuth(req, res, next) {
        const [scheme, token] = (req.get("authorization") || "").split(" ");

        if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
            throw new HttpError(401, "Authentication required");
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data || !data.user) {
            throw new HttpError(401, "Your session is invalid or has expired. Please log in again.");
        }

        if (isDisabled(data.user)) {
            throw new HttpError(403, "This account has been disabled. Please contact the administrator.");
        }

        const role = resolveRole(data.user, adminEmails);

        if (!role) {
            throw new HttpError(403, "You do not have access to this system");
        }

        req.user = data.user;
        req.role = role;
        next();
    };
}

/** Allow only the listed roles, e.g. router.post("/", requireRole("admin"), ...). */
function requireRole(...allowed) {
    return function checkRole(req, res, next) {
        if (!allowed.includes(req.role)) {
            throw new HttpError(403, "You do not have permission to do this");
        }

        next();
    };
}

module.exports = { ROLES, createRequireAuth, requireRole, resolveRole };
