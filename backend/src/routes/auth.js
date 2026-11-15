const express = require("express");
const HttpError = require("../utils/httpError");
const { ROLES } = require("../middleware/auth");
const { DISABLED_FOR, parseNewEmployee } = require("../utils/accounts");
const { createRateLimiter } = require("../utils/rateLimit");

/**
 * Public routes (no login needed). Right now that is only employee sign-up.
 *
 * Two ways to create the account:
 *
 *  1. With publicSupabase (the app has SUPABASE_ANON_KEY): we call Supabase's normal
 *     sign-up, which emails the person a confirmation link. Right afterwards we set
 *     their role on the server (users can't edit app_metadata themselves).
 *  2. Without it: the account is created directly as already confirmed, with no email.
 *
 * When requireApproval is on, the account is also locked until an admin enables it
 * on the Employees page.
 */
module.exports = function authRouter(supabase, { requireApproval = true, publicSupabase = null, siteUrl = "" } = {}) {
    const router = express.Router();

    // 5 sign-ups per hour from one address
    const allowSignUp = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

    /** Sign up through Supabase so it sends the confirmation email. */
    async function registerWithEmail({ name, email, phone, password }) {
        const { data, error } = await publicSupabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, phone, self_registered: true },
                emailRedirectTo: `${siteUrl}/email-confirmed.html`
            }
        });

        if (error) {
            const text = (error.message || "").toLowerCase();

            if (text.includes("rate limit")) {
                throw new HttpError(429, "Too many emails were sent just now. Please wait a few minutes and try again.");
            }

            if (text.includes("sending") && text.includes("email")) {
                console.error("Supabase could not send the confirmation email. Is SMTP set up?", error.message);
                throw new HttpError(502, "We couldn't send the confirmation email. Please contact the administrator.");
            }

            if (/already|registered|exists/.test(text)) {
                throw new HttpError(409, "An account with this email already exists. Try signing in or resetting your password.");
            }

            console.error("Sign-up failed:", error.message);
            throw new HttpError(400, "Could not create the account", { detail: error.message });
        }

        const user = data && data.user;

        // For an email that already has an account, Supabase hides the fact by returning
        // a user with no identities instead of an error
        if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) {
            throw new HttpError(409, "An account with this email already exists. Try signing in or resetting your password.");
        }

        // Give the account its role (and lock it if admin approval is on)
        const changes = { app_metadata: { role: ROLES.EMPLOYEE } };
        if (requireApproval) changes.ban_duration = DISABLED_FOR;

        const { error: roleError } = await supabase.auth.admin.updateUserById(user.id, changes);

        if (roleError) {
            // Never leave an account behind that has no role
            console.error("Could not set the employee role, removing the new account:", roleError.message);
            await supabase.auth.admin.deleteUser(user.id);
            throw new HttpError(500, "Could not create the account. Please try again.");
        }

        // If Supabase's "Confirm email" option is off it signs the person in straight away
        // and sends no email. The account is still fine, so we just report it honestly.
        return { emailSent: !data.session };
    }

    /** Create an already-confirmed account (no email). */
    async function registerDirectly({ name, email, phone, password }) {
        const attributes = {
            email,
            password,
            email_confirm: true,
            app_metadata: { role: ROLES.EMPLOYEE },
            user_metadata: { name, phone, self_registered: true }
        };

        if (requireApproval) attributes.ban_duration = DISABLED_FOR;

        const { error } = await supabase.auth.admin.createUser(attributes);

        if (error) {
            if (/already|registered|exists/i.test(error.message)) {
                throw new HttpError(409, "An account with this email already exists. Try signing in or resetting your password.");
            }

            console.error("Failed to register employee:", error.message);
            throw new HttpError(400, "Could not create the account", { detail: error.message });
        }

        return { emailSent: false };
    }

    router.post("/register", async (req, res) => {
        if (!allowSignUp(req.ip)) {
            throw new HttpError(429, "Too many sign-up attempts. Please try again later.");
        }

        const details = parseNewEmployee(req.body, { phoneRequired: true });

        const { emailSent } = publicSupabase
            ? await registerWithEmail(details)
            : await registerDirectly(details);

        const steps = [];

        if (emailSent) steps.push(`We sent a confirmation link to ${details.email}. Open it to confirm your email.`);
        if (requireApproval) steps.push("The administrator also has to approve your account.");
        steps.push(steps.length === 0 ? "You can sign in now." : "Then you can sign in.");

        res.status(201).json({
            message: `Account created. ${steps.join(" ")}`,
            emailSent,
            approvalRequired: requireApproval
        });
    });

    return router;
};
