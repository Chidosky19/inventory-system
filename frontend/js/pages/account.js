/**
 * My account: change your display name and password. Works for admins and employees.
 * (supabaseClient comes from auth-guard.js)
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    $("year").textContent = new Date().getFullYear();

    let user = null;

    function status(id, text, type) {
        const box = $(id);
        box.textContent = text;
        box.classList.toggle("is-success", type === "success");
        box.hidden = !text;
    }

    async function load() {
        const { data } = await supabaseClient.auth.getSession();
        if (!data.session) return; // auth-guard is already sending them to sign in

        user = data.session.user;
        const role = getRole(data.session);

        $("profileEmail").textContent = user.email;
        $("profileRole").textContent = role === "employee" ? "Employee" : "Administrator";
        $("displayName").value = (user.user_metadata && user.user_metadata.name) || "";
        $("displayPhone").value = (user.user_metadata && user.user_metadata.phone) || "";

        // send them back to the right place
        $("backLink").href = AUTH_PAGES[role].home;
        $("homeLink").href = AUTH_PAGES[role].home;
        $("backLink").lastChild.textContent = role === "employee" ? " Back to my workspace" : " Back to the dashboard";
    }

    $("nameForm").addEventListener("submit", async event => {
        event.preventDefault();
        status("nameStatus", "");

        const name = $("displayName").value.trim();
        const phone = $("displayPhone").value.trim().replace(/[\s\-().]/g, "");

        if (!name) {
            status("nameStatus", "Please enter your name.");
            return;
        }

        if (phone && !/^\+?\d{7,15}$/.test(phone)) {
            status("nameStatus", "Please enter a valid phone number, for example 08031234567.");
            return;
        }

        const { error } = await supabaseClient.auth.updateUser({ data: { name, phone } });

        if (error) {
            status("nameStatus", "Could not save your details. Please try again.");
            return;
        }

        $("displayPhone").value = phone;
        status("nameStatus", "Details saved.", "success");
    });

    $("passwordForm").addEventListener("submit", async event => {
        event.preventDefault();
        status("passwordStatus", "");

        const current = $("currentPassword").value;
        const next = $("newPassword").value;

        if (!current || !next) {
            status("passwordStatus", "Please fill in every password box.");
            return;
        }

        if (next.length < 8) {
            status("passwordStatus", "Your new password needs at least 8 characters.");
            return;
        }

        if (next.length > 72) {
            status("passwordStatus", "Your new password can be at most 72 characters.");
            return;
        }

        if (next !== $("confirmPassword").value) {
            status("passwordStatus", "The two new passwords don't match.");
            return;
        }

        // Check the current password first, so a borrowed signed-in screen can't change it
        const check = await supabaseClient.auth.signInWithPassword({ email: user.email, password: current });

        if (check.error) {
            status("passwordStatus", "Your current password is not correct.");
            return;
        }

        const { error } = await supabaseClient.auth.updateUser({ password: next });

        if (error) {
            const text = (error.message || "").toLowerCase();

            status(
                "passwordStatus",
                text.includes("different") ? "Please choose a password you haven't used before." : "Could not change your password. Please try again."
            );
            return;
        }

        $("passwordForm").reset();
        status("passwordStatus", "Password changed.", "success");
    });

    load();
})();
