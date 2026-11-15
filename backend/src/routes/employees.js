const express = require("express");
const HttpError = require("../utils/httpError");
const { ROLES } = require("../middleware/auth");
const { DISABLED_FOR, validatePassword, parseNewEmployee } = require("../utils/accounts");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isDisabled = user => Boolean(user.banned_until) && new Date(user.banned_until) > new Date();
const isEmployee = user => Boolean(user && user.app_metadata && user.app_metadata.role === ROLES.EMPLOYEE);

function toEmployee(user) {
    const metadata = user.user_metadata || {};

    return {
        id: user.id,
        name: metadata.name || "",
        email: user.email,
        phone: metadata.phone || "",
        disabled: isDisabled(user),
        // signed up on their own, locked, and never signed in: waiting for approval
        pending: isDisabled(user) && Boolean(metadata.self_registered) && !user.last_sign_in_at,
        // signed up by email but hasn't clicked the confirmation link yet
        unconfirmed: !user.email_confirmed_at && !user.confirmed_at,
        created_at: user.created_at
    };
}

function parseId(value) {
    if (!UUID.test(value)) throw new HttpError(400, "Invalid employee ID");
    return value;
}

module.exports = function employeesRouter(supabase) {
    const router = express.Router();

    /** Fetch one account and make sure it is an employee (admins can never be changed here). */
    async function getEmployeeOr404(id) {
        const { data, error } = await supabase.auth.admin.getUserById(id);

        if (error || !isEmployee(data && data.user)) {
            throw new HttpError(404, "Employee not found");
        }

        return data.user;
    }

    // LIST EMPLOYEES
    router.get("/", async (req, res) => {
        const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

        if (error) {
            console.error("Failed to retrieve employees:", error.message);
            throw new HttpError(500, "Failed to retrieve employees", { detail: error.message });
        }

        const employees = data.users
            .filter(isEmployee)
            .map(toEmployee)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.status(200).json({ employees });
    });

    // ADD EMPLOYEE
    router.post("/", async (req, res) => {
        const { name, email, phone, password } = parseNewEmployee(req.body);

        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: { role: ROLES.EMPLOYEE },
            user_metadata: phone ? { name, phone } : { name }
        });

        if (error) {
            if (/already|registered|exists/i.test(error.message)) {
                throw new HttpError(409, "An account with this email already exists");
            }

            console.error("Failed to create employee:", error.message);
            throw new HttpError(400, "Failed to create employee", { detail: error.message });
        }

        res.status(201).json({ message: "Employee added successfully", employee: toEmployee(data.user) });
    });

    // DISABLE / ENABLE EMPLOYEE   body: { disabled: true | false }
    router.patch("/:id", async (req, res) => {
        const id = parseId(req.params.id);
        const disabled = req.body && req.body.disabled;

        if (typeof disabled !== "boolean") {
            throw new HttpError(400, "disabled must be true or false");
        }

        await getEmployeeOr404(id);

        const { data, error } = await supabase.auth.admin.updateUserById(id, {
            ban_duration: disabled ? DISABLED_FOR : "none"
        });

        if (error) {
            console.error("Failed to update employee:", error.message);
            throw new HttpError(500, "Failed to update employee", { detail: error.message });
        }

        res.status(200).json({
            message: disabled ? "Employee disabled" : "Employee enabled",
            employee: toEmployee(data.user)
        });
    });

    // RESET PASSWORD   body: { password }   (the admin chooses a new password for the employee)
    router.patch("/:id/password", async (req, res) => {
        const id = parseId(req.params.id);
        const password = validatePassword(req.body && req.body.password);

        await getEmployeeOr404(id);

        const { error } = await supabase.auth.admin.updateUserById(id, { password });

        if (error) {
            console.error("Failed to reset password:", error.message);
            throw new HttpError(500, "Failed to reset password", { detail: error.message });
        }

        res.status(200).json({ message: "Password reset successfully" });
    });

    // DELETE EMPLOYEE (their past sales are kept)
    router.delete("/:id", async (req, res) => {
        const id = parseId(req.params.id);

        await getEmployeeOr404(id);

        const { error } = await supabase.auth.admin.deleteUser(id);

        if (error) {
            console.error("Failed to delete employee:", error.message);
            throw new HttpError(500, "Failed to delete employee", { detail: error.message });
        }

        res.status(200).json({ message: "Employee deleted successfully" });
    });

    return router;
};
