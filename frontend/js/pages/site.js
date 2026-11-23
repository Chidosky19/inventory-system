/**
 * Shared script for the About, Contact and Support pages:
 *   - the year and shop details in the footer and the Contact page (email and phone become tap-to-use links)
 *   - the Support page's question search
 *   - the Contact form: checks each field as you type, counts characters, and saves the message for the admin
 */
(() => {
    "use strict";

    document.getElementById("year").textContent = new Date().getFullYear();

    /* ---------- Shop details from config.js ---------- */

    document.querySelectorAll("[data-site]").forEach(element => {
        const key = element.dataset.site;
        const value = CONFIG.SITE[key];

        if (!value) return;

        if (key === "email" || key === "phone") {
            const link = document.createElement("a");

            link.href = key === "email" ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, "")}`;
            link.textContent = value;
            element.replaceChildren(link);
        } else {
            element.textContent = value;
        }
    });


    /* ---------- Support page: search the questions ---------- */

    const faqSearch = document.getElementById("faqSearch");

    if (faqSearch) {
        const questions = [...document.querySelectorAll(".faq details")];
        const none = document.getElementById("faqNone");

        faqSearch.addEventListener("input", () => {
            const term = faqSearch.value.trim().toLowerCase();
            let shown = 0;

            questions.forEach(question => {
                const match = !term || question.textContent.toLowerCase().includes(term);

                question.hidden = !match;
                question.open = Boolean(term) && match;

                if (match) shown += 1;
            });

            none.hidden = shown !== 0;
        });
    }


    /* ---------- Contact form ---------- */

    const form = document.getElementById("contactForm");

    if (!form) return;

    const MAX_MESSAGE = 2000;
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const note = document.getElementById("contactNote");
    const submit = document.getElementById("contactSubmit");
    const submitLabel = submit.innerHTML;
    const nameInput = document.getElementById("cName");
    const emailInput = document.getElementById("cEmail");
    const messageInput = document.getElementById("cMessage");

    // What each required field needs, and what to tell the visitor if it is wrong
    const checks = [
        { input: nameInput, ok: value => value.length > 0, text: "Please tell us your name." },
        { input: emailInput, ok: value => EMAIL.test(value), text: "Please enter a valid email address so we can reply." },
        { input: messageInput, ok: value => value.length >= 5, text: "Please write a short message (at least a few words)." }
    ];

    nameInput.maxLength = 80;
    emailInput.maxLength = 120;
    messageInput.maxLength = MAX_MESSAGE;

    // An error line under each required field, and a character counter under the message
    checks.forEach(check => {
        const error = document.createElement("small");

        error.className = "field-error";
        error.id = `${check.input.id}Error`;
        error.setAttribute("role", "alert");
        check.input.setAttribute("aria-describedby", error.id);
        check.input.after(error);
        check.error = error;

        check.input.addEventListener("input", () => showError(check, ""));
    });

    const counter = document.createElement("small");

    counter.className = "field-count";
    messageInput.after(counter);

    const updateCounter = () => { counter.textContent = `${messageInput.value.length} / ${MAX_MESSAGE}`; };

    messageInput.addEventListener("input", updateCounter);
    updateCounter();

    function showError(check, text) {
        check.error.textContent = text;
        check.input.setAttribute("aria-invalid", text ? "true" : "false");
    }

    /** Checks every field. Returns the first one with a problem so we can move the cursor there. */
    function validate() {
        let first = null;

        checks.forEach(check => {
            const good = check.ok(check.input.value.trim());

            showError(check, good ? "" : check.text);

            if (!good && !first) first = check.input;
        });

        return first;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        note.textContent = "";

        const invalid = validate();

        if (invalid) {
            invalid.focus();
            return;
        }

        submit.disabled = true;
        submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending...';

        try {
            const response = await fetch(`${CONFIG.API_URL}/contact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    topic: document.getElementById("cTopic").value,
                    message: messageInput.value.trim(),
                    website: document.getElementById("cWebsite").value
                })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                note.textContent = result.error || "Your message could not be sent. Please try again.";
                return;
            }

            form.hidden = true;
            document.getElementById("contactDone").hidden = false;
            document.getElementById("contactDone").focus();
        } catch (error) {
            note.textContent = `Could not reach the server. You can email us at ${CONFIG.SITE.email} instead.`;
        } finally {
            submit.disabled = false;
            submit.innerHTML = submitLabel;
        }
    });

    // "Send another message" on the thank-you card
    document.getElementById("contactAgain").addEventListener("click", () => {
        form.reset();
        updateCounter();
        form.hidden = false;
        document.getElementById("contactDone").hidden = true;
        nameInput.focus();
    });
})();
