/**
 * Shared script for the About, Contact and Support pages.
 */
(() => {
    "use strict";

    document.getElementById("year").textContent = new Date().getFullYear();

    // Fill in shop details from config.js
    document.querySelectorAll("[data-site]").forEach(element => {
        const value = CONFIG.SITE[element.dataset.site];
        if (value) element.textContent = value;
    });

    // Contact form: the message goes to the backend and is saved for the admin to read
    const form = document.getElementById("contactForm");
    if (!form) return;

    const note = document.getElementById("contactNote");
    const submit = document.getElementById("contactSubmit");

    form.addEventListener("submit", async event => {
        event.preventDefault();
        note.textContent = "";

        const name = document.getElementById("cName").value.trim();
        const email = document.getElementById("cEmail").value.trim();
        const topic = document.getElementById("cTopic").value;
        const message = document.getElementById("cMessage").value.trim();

        if (!name || !email || !message) {
            note.textContent = "Please fill in your name, email and message first.";
            return;
        }

        submit.disabled = true;

        try {
            const response = await fetch(`${CONFIG.API_URL}/contact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, topic, message, website: document.getElementById("cWebsite").value })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                note.textContent = result.error || "Your message could not be sent. Please try again.";
                return;
            }

            form.hidden = true;
            document.getElementById("contactDone").hidden = false;
        } catch (error) {
            note.textContent = `Could not reach the server. You can email us at ${CONFIG.SITE.email} instead.`;
        } finally {
            submit.disabled = false;
        }
    });
})();
