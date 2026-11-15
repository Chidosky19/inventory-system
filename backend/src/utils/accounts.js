const HttpError = require("./httpError");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?\d{7,15}$/;

// About 100 years. An account "disabled" this way stays locked until an admin enables it.
const DISABLED_FOR = "876000h";

/** Supabase needs 8+ characters, and the hashing method caps passwords at 72. */
function validatePassword(password) {
    if (typeof password !== "string" || password.length < 8) {
        throw new HttpError(400, "Password must be at least 8 characters");
    }

    if (password.length > 72) {
        throw new HttpError(400, "Password must be 72 characters or fewer");
    }

    return password;
}

/**
 * Phone number without spaces, dashes or brackets ("0803 123 4567" -> "08031234567").
 * Returns "" when it was left empty and isn't required.
 */
function parsePhone(value, { required = false } = {}) {
    const raw = typeof value === "string" ? value.trim() : "";

    if (!raw) {
        if (required) throw new HttpError(400, "Phone number is required");
        return "";
    }

    const cleaned = raw.replace(/[\s\-().]/g, "");

    if (!PHONE.test(cleaned)) {
        throw new HttpError(400, "Please enter a valid phone number, for example 08031234567");
    }

    return cleaned;
}

function parseNewEmployee(body, { phoneRequired = false } = {}) {
    const input = body && typeof body === "object" ? body : {};
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

    if (!name) throw new HttpError(400, "Name is required");
    if (name.length > 80) throw new HttpError(400, "Name is too long");
    if (!EMAIL.test(email)) throw new HttpError(400, "Please enter a valid email address");

    const phone = parsePhone(input.phone, { required: phoneRequired });

    return { name, email, phone, password: validatePassword(input.password) };
}

module.exports = { DISABLED_FOR, validatePassword, parsePhone, parseNewEmployee };
