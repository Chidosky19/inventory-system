/**
 * Admin login page.
 */
(() => {
    "use strict";

    const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    const $ = id => document.getElementById(id);

    const form = $("loginForm");
    const button = $("loginButton");
    const message = $("loginMessage");

    function showMessage(text, type) {
        message.textContent = text;
        message.classList.toggle("is-success", type === "success");
        message.hidden = false;
    }

    function setLoading(loading) {
        button.disabled = loading;
        $("loginSpinner").hidden = !loading;
        $("loginLabel").textContent = loading ? "Signing in..." : "Sign in";
    }

    // Already signed in? Go straight to your own home page.
    client.auth.getSession().then(({ data }) => {
        if (data.session) window.location.replace(AUTH_PAGES[getRole(data.session)].home);
    });

    $("togglePassword").addEventListener("click", () => {
        const input = $("password");
        const show = input.type === "password";

        input.type = show ? "text" : "password";
        $("togglePassword").querySelector("i").className = show ? "bi bi-eye-slash" : "bi bi-eye";
        $("togglePassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        message.hidden = true;

        const email = $("email").value.trim();
        const password = $("password").value;

        if (!email || !password) {
            showMessage("Please enter your email and password.");
            return;
        }

        setLoading(true);

        const { data, error } = await client.auth.signInWithPassword({ email, password });

        if (error) {
            showMessage(error.message);
            setLoading(false);
            return;
        }

        showMessage("Signed in. Redirecting...", "success");
        window.location.replace(AUTH_PAGES[getRole(data.session)].home);
    });
})();
