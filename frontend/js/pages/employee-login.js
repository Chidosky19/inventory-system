/**
 * Employee login page.
 */
(() => {
    "use strict";

    const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    const $ = id => document.getElementById(id);

    const form = $("loginForm");
    const button = $("loginButton");
    const message = $("loginMessage");

    $("year").textContent = new Date().getFullYear();

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.classList.toggle("is-success", type === "success");
        message.hidden = false;
    }

    const resend = $("resendConfirmation");

    function setLoading(loading) {
        button.disabled = loading;
        $("loginSpinner").hidden = !loading;
        $("loginLabel").textContent = loading ? "Signing in..." : "Sign in";
    }

    /** Turn Supabase's technical messages into something an employee understands. */
    function friendlyError(error) {
        const text = (error.message || "").toLowerCase();

        if (text.includes("not confirmed")) return "Please confirm your email first. We sent you a link when you signed up.";
        if (text.includes("invalid login credentials")) return "Incorrect email or password. Please try again.";
        if (text.includes("banned") || text.includes("disabled")) return "This account can't sign in right now. It may be waiting for approval, or it was disabled. Please contact the administrator.";
        if (text.includes("network") || text.includes("fetch")) return "Could not connect. Please check your internet connection.";

        return error.message || "Something went wrong. Please try again.";
    }

    // Already signed in? Go straight to your own home page.
    client.auth.getSession().then(({ data }) => {
        if (data.session) window.location.replace(AUTH_PAGES[getRole(data.session)].home);
    });

    // Show / hide password
    $("togglePassword").addEventListener("click", () => {
        const input = $("password");
        const show = input.type === "password";

        input.type = show ? "text" : "password";
        $("togglePassword").querySelector("i").className = show ? "bi bi-eye-slash" : "bi bi-eye";
        $("togglePassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
    });

    // "Email not confirmed": let the person ask for another confirmation email
    resend.addEventListener("click", async () => {
        const email = $("email").value.trim();
        if (!email) return;

        resend.disabled = true;

        const { error } = await client.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: new URL("email-confirmed.html", window.location.href).href }
        });

        resend.disabled = false;

        if (error) {
            showMessage("We couldn't send another email right now. Please wait a minute and try again.");
        } else {
            showMessage("We sent a new confirmation link. Check your inbox and spam folder.", "success");
            resend.hidden = true;
        }
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
            showMessage(friendlyError(error));
            resend.hidden = !(error.message || "").toLowerCase().includes("not confirmed");
            setLoading(false);
            return;
        }

        showMessage("Welcome! Taking you to your workspace...", "success");
        window.location.replace(AUTH_PAGES[getRole(data.session)].home);
    });
})();
