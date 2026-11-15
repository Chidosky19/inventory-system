/**
 * Authentication guard for protected pages.
 *
 * Add it to a page's <head>. Admin pages use it as-is; employee pages add
 * data-area="employee"; pages for both kinds of account (like My account) use
 * data-area="any". The page stays hidden (see ".auth-pending" in the CSS)
 * until we know the visitor is signed in AND belongs on this page:
 *   - signed out            -> that area's login page
 *   - wrong kind of account -> that account's own home page
 */
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const AUTH_AREA = (document.currentScript && document.currentScript.dataset.area) || "admin";

// Which login page to send someone to ("any" pages use the employee one when signed out)
const loginPageFor = role => (AUTH_PAGES[role] || AUTH_PAGES.employee).login;

document.documentElement.classList.add("auth-pending");

async function requireSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.replace(loginPageFor(AUTH_AREA));
        return;
    }

    const role = getRole(data.session);

    if (AUTH_AREA !== "any" && role !== AUTH_AREA) {
        window.location.replace(AUTH_PAGES[role].home);
        return;
    }

    document.documentElement.classList.remove("auth-pending");
}

async function logout() {
    const { data } = await supabaseClient.auth.getSession();
    const role = AUTH_AREA === "any" ? getRole(data.session) : AUTH_AREA;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Unable to log out. Please try again.");
        return;
    }

    window.location.replace(loginPageFor(role));
}

// Any element with data-action="logout" signs the user out
document.addEventListener("click", function (event) {
    if (event.target.closest('[data-action="logout"]')) {
        logout();
    }
});

requireSession();
