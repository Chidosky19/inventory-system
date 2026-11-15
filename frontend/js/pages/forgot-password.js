/**
 * Forgot password: Supabase emails a reset link that opens reset-password.html.
 */
(() => {
    "use strict";

    const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    const $ = id => document.getElementById(id);

    $("year").textContent = new Date().getFullYear();

    function showMessage(text) {
        $("forgotMessage").textContent = text;
        $("forgotMessage").hidden = !text;
    }

    function setLoading(loading) {
        $("submit").disabled = loading;
        $("spinner").hidden = !loading;
        $("label").textContent = loading ? "Sending..." : "Send reset link";
    }

    $("form").addEventListener("submit", async event => {
        event.preventDefault();
        showMessage("");

        const email = $("email").value.trim();

        if (!email) {
            showMessage("Please enter your email address.");
            return;
        }

        setLoading(true);

        // The link in the email brings the person back to reset-password.html on this site.
        // That address has to be listed under Redirect URLs in the Supabase dashboard.
        const redirectTo = new URL("reset-password.html", window.location.href).href;

        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });

        setLoading(false);

        if (error) {
            const text = (error.message || "").toLowerCase();

            showMessage(
                text.includes("rate limit") || text.includes("seconds")
                    ? "Too many requests. Please wait a minute and try again."
                    : "We couldn't send the email. Please try again in a moment."
            );
            return;
        }

        // Same answer whether or not the email has an account, so nobody can use this to find out
        $("sentTo").textContent = email;
        $("forgotForm").hidden = true;
        $("forgotDone").hidden = false;
    });
})();
