/**
 * Roles and where each one belongs.
 *
 * The role comes from the Supabase login (app_metadata.role), which only the
 * server can set. This file is for choosing the right page; the backend
 * enforces permissions on every request, so hiding a page is never the only
 * protection.
 */
const AUTH_PAGES = Object.freeze({
    admin: { home: "index.html", login: "login.html" },
    employee: { home: "employee.html", login: "employee-login.html" }
});

/** "employee" for employee accounts; everything else is treated as an admin account. */
function getRole(session) {
    const role = session && session.user && session.user.app_metadata && session.user.app_metadata.role;
    return role === "employee" ? "employee" : "admin";
}
