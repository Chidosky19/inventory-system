/**
 * Reset password. Supabase sends the person here from the email link. When the
 * link is valid the Supabase client signs them in briefly and fires a
 * PASSWORD_RECOVERY event; that is our cue to show the new-password form.
 */
(() => {
    "use strict";

    const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    const $ = id => document.getElementById(id);

    const sections = ["resetChecking", "resetForm", "resetDone", "resetBad"];

    let loginPage = AUTH_PAGES.employee.login;
    let shown = false;

    $("year").textContent = new Date().getFullYear();

    function show(name) {
        sections.forEach(id => { $(id).hidden = id !== name; });
        shown = name !== "resetChecking";
    }

    function showMessage(text) {
        $("resetMessage").textContent = text;
        $("resetMessage").hidden = !text;
    }

    function setLoading(loading) {
        $("submit").disabled = loading;
        $("spinner").hidden = !loading;
        $("label").textContent = loading ? "Saving..." : "Save new password";
    }

    // Supabase puts a problem with the link (expired, already used) in the address
    const linkProblem = /error(_code|_description)?=/.test(window.location.hash + window.location.search);

    client.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && !shown) {
            if (session) loginPage = AUTH_PAGES[getRole(session)].login;
            show("resetForm");
        }
    });

    // If no recovery event turns up, the link was missing, used or expired
    setTimeout(() => {
        if (!shown) show("resetBad");
    }, linkProblem ? 0 : 2500);

    $("togglePassword").addEventListener("click", () => {
        const input = $("password");
        const reveal = input.type === "password";

        input.type = reveal ? "text" : "password";
        $("confirm").type = input.type;
        $("togglePassword").querySelector("i").className = reveal ? "bi bi-eye-slash" : "bi bi-eye";
        $("togglePassword").setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    });

    $("form").addEventListener("submit", async event => {
        event.preventDefault();
        showMessage("");

        const password = $("password").value;

        if (password.length < 8) {
            showMessage("Your password needs at least 8 characters.");
            return;
        }

        if (password.length > 72) {
            showMessage("Your password can be at most 72 characters.");
            return;
        }

        if (password !== $("confirm").value) {
            showMessage("The two passwords don't match.");
            return;
        }

        setLoading(true);

        const { error } = await client.auth.updateUser({ password });

        if (error) {
            const text = (error.message || "").toLowerCase();

            showMessage(
                text.includes("different")
                    ? "Please choose a password you haven't used before."
                    : error.message || "Could not save the new password. Please try again."
            );
            setLoading(false);
            return;
        }

        // The reset link signed them in; sign out so they log in properly with the new password
        await client.auth.signOut();

        $("doneLink").href = loginPage;
        show("resetDone");
    });
})();
