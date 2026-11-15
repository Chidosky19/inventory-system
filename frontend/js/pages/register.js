/**
 * Employee sign-up. The account is created by the backend (POST /auth/register),
 * and the person signs in later from the employee login page.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    $("year").textContent = new Date().getFullYear();

    function showMessage(text) {
        $("registerMessage").textContent = text;
        $("registerMessage").hidden = !text;
    }

    function setLoading(loading) {
        $("submit").disabled = loading;
        $("spinner").hidden = !loading;
        $("label").textContent = loading ? "Creating account..." : "Create account";
    }

    $("togglePassword").addEventListener("click", () => {
        const input = $("password");
        const show = input.type === "password";

        input.type = show ? "text" : "password";
        $("confirm").type = input.type;
        $("togglePassword").querySelector("i").className = show ? "bi bi-eye-slash" : "bi bi-eye";
        $("togglePassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
    });

    $("form").addEventListener("submit", async event => {
        event.preventDefault();
        showMessage("");

        const name = $("name").value.trim();
        const email = $("email").value.trim();
        const phone = $("phone").value.trim();
        const password = $("password").value;

        if (!name || !email || !phone || !password) {
            showMessage("Please fill in every field.");
            return;
        }

        // spaces, dashes and brackets are fine; the rest must be 7 to 15 digits (a leading + is allowed)
        if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s\-().]/g, ""))) {
            showMessage("Please enter a valid phone number, for example 08031234567.");
            return;
        }

        if (password.length < 8) {
            showMessage("Your password needs at least 8 characters.");
            return;
        }

        if (password !== $("confirm").value) {
            showMessage("The two passwords don't match.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone, password })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                showMessage(result.error || "Could not create the account. Please try again.");
                return;
            }

            $("doneText").textContent = result.message || "You can now sign in.";
            $("registerForm").hidden = true;
            $("registerDone").hidden = false;
        } catch (error) {
            showMessage("Could not reach the server. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    });
})();
