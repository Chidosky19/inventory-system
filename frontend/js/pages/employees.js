/**
 * Employees page (admin only): add, approve, disable and delete employee accounts,
 * reset passwords and look at what each employee has sold.
 */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const COLUMNS = 8;

    const table = $("employeesTable");
    const form = $("employeeForm");
    const message = $("employeeMessage");
    const submit = $("employeeSubmit");

    const reset = {
        modal: $("resetPasswordModal"),
        form: $("resetPasswordForm"),
        input: $("resetPasswordInput"),
        message: $("resetPasswordMessage"),
        submit: $("resetPasswordSubmit"),
        close: $("resetPasswordClose"),
        copy: $("resetCopy"),
        generate: $("resetGenerate")
    };

    let employees = [];
    let sales = [];
    let resetEmployeeId = null;


    /* ---------- Helpers ---------- */

    /** A random 12-character password using the browser's secure random generator. */
    function generatePassword() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        const values = crypto.getRandomValues(new Uint32Array(12));

        return Array.from(values, value => alphabet[value % alphabet.length]).join("");
    }

    /** Sales made by one employee (the API tags each sale with the employee's id). */
    const salesOf = id => sales.filter(sale => sale.created_by === id);

    function createButton(label, icon, style, action, id) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = `btn btn-sm ${style}`;
        button.dataset.action = action;
        button.dataset.id = id;
        button.innerHTML = `<i class="bi ${icon}"></i> ${label}`;

        return button;
    }


    /* ---------- Table ---------- */

    function renderEmployees() {
        if (employees.length === 0) {
            Utils.setTableMessage(table, COLUMNS, "No employees yet. Add your first one using the form.");
            return;
        }

        const rows = employees.map(employee => {
            const mine = salesOf(employee.id);

            const row = Utils.createRow([
                employee.name || "-",
                employee.email
            ]);

            // phone number as a tap-to-call link
            const phoneCell = document.createElement("td");
            if (employee.phone) {
                const call = document.createElement("a");
                call.href = `tel:${employee.phone}`;
                call.textContent = employee.phone;
                phoneCell.appendChild(call);
            } else {
                phoneCell.textContent = "-";
            }
            row.appendChild(phoneCell);

            let status;
            if (employee.unconfirmed) {
                status = Utils.createBadge("Email not confirmed", "info");
                status.classList.add("text-dark");
            } else if (employee.pending) {
                status = Utils.createBadge("Pending", "warning");
                status.classList.add("text-dark");
            } else if (employee.disabled) {
                status = Utils.createBadge("Disabled", "secondary");
            } else {
                status = Utils.createBadge("Active", "success");
            }
            Utils.appendCell(row, status);

            const count = document.createElement("td");
            count.textContent = mine.length;
            row.appendChild(count);

            const revenue = document.createElement("td");
            revenue.textContent = Utils.formatMoney(Utils.sumBy(mine, "total_price"));
            row.appendChild(revenue);

            const added = document.createElement("td");
            added.textContent = Utils.formatDate(employee.created_at);
            row.appendChild(added);

            const actions = document.createElement("div");
            actions.className = "d-flex gap-1 flex-wrap";

            if (employee.pending) {
                actions.append(createButton("Approve", "bi-person-check", "btn-success", "enable", employee.id));
            } else if (employee.disabled) {
                actions.append(createButton("Enable", "bi-person-check", "btn-success", "enable", employee.id));
            } else {
                actions.append(createButton("Disable", "bi-person-slash", "btn-warning", "disable", employee.id));
            }

            actions.append(
                createButton("Sales", "bi-receipt", "btn-outline-secondary", "sales", employee.id),
                createButton("Password", "bi-key", "btn-outline-primary", "reset", employee.id),
                createButton("Delete", "bi-trash", "btn-danger", "delete", employee.id)
            );
            Utils.appendCell(row, actions);

            return row;
        });

        table.replaceChildren(...rows);
    }

    async function loadEmployees() {
        Utils.setTableMessage(table, COLUMNS, "Loading employees...");

        try {
            const result = await Api.getEmployees();
            employees = result.employees || [];

            // The sales figures are a bonus: if they fail to load, still show the team
            try {
                const salesResult = await Api.getSales();
                sales = salesResult.sales || [];
            } catch (error) {
                console.error(error);
                sales = [];
            }

            renderEmployees();
        } catch (error) {
            console.error(error);
            Utils.setTableMessage(table, COLUMNS, "Unable to load employees.");
            Utils.setMessage(message, error.message);
        }
    }


    /* ---------- Actions ---------- */

    async function addEmployee(event) {
        event.preventDefault();

        const employee = {
            name: $("employeeName").value.trim(),
            email: $("employeeEmail").value.trim(),
            phone: $("employeePhone").value.trim(),
            password: $("employeePassword").value
        };

        if (!employee.name || !employee.email || employee.password.length < 8) {
            Utils.setMessage(message, "Enter a name, an email and a password of at least 8 characters.");
            return;
        }

        submit.disabled = true;

        try {
            await Api.createEmployee(employee);

            form.reset();
            Utils.setMessage(message, `${employee.name} was added. Share their email and password so they can sign in.`, "success");

            await loadEmployees();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        } finally {
            submit.disabled = false;
        }
    }

    async function setDisabled(id, disabled) {
        const employee = employees.find(item => item.id === id);
        const name = employee ? employee.name || employee.email : "this employee";

        if (disabled && !confirm(`Disable ${name}? They will be signed out and unable to log in until you enable them again.`)) {
            return;
        }

        try {
            await Api.setEmployeeDisabled(id, disabled);
            Utils.setMessage(message, `${name} was ${disabled ? "disabled" : "enabled"}.`, "success");

            await loadEmployees();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }

    /* ---------- One employee's sales ---------- */

    function openSalesModal(id) {
        const employee = employees.find(item => item.id === id);
        if (!employee) return;

        const mine = salesOf(id);
        const body = $("employeeSalesTable");

        $("employeeSalesTitle").textContent = `Sales by ${employee.name || employee.email}`;
        $("employeeSalesSummary").textContent = mine.length === 0
            ? ""
            : `${mine.length} sale${mine.length === 1 ? "" : "s"}, ${Utils.formatMoney(Utils.sumBy(mine, "total_price"))} in total.`;

        if (mine.length === 0) {
            Utils.setTableMessage(body, 4, "No sales recorded by this employee yet.");
        } else {
            body.replaceChildren(...mine.map(sale => Utils.createRow([
                sale.products?.product_name || "Unknown product",
                sale.quantity,
                Utils.formatMoney(sale.total_price),
                new Date(sale.created_at).toLocaleString(CONFIG.LOCALE, { dateStyle: "medium", timeStyle: "short" })
            ])));
        }

        bootstrap.Modal.getOrCreateInstance($("employeeSalesModal")).show();
    }


    /* ---------- Reset password ---------- */

    function openResetModal(id) {
        const employee = employees.find(item => item.id === id);
        if (!employee) return;

        resetEmployeeId = id;

        $("resetPasswordName").textContent = employee.name || employee.email;
        reset.input.value = "";
        reset.input.readOnly = false;
        reset.submit.hidden = false;
        reset.submit.disabled = false;
        reset.generate.hidden = false;
        reset.copy.hidden = true;
        reset.close.textContent = "Cancel";
        Utils.setMessage(reset.message);

        bootstrap.Modal.getOrCreateInstance(reset.modal).show();
    }

    async function resetPassword(event) {
        event.preventDefault();

        const password = reset.input.value;

        if (password.length < 8) {
            Utils.setMessage(reset.message, "The password must be at least 8 characters.");
            return;
        }

        const employee = employees.find(item => item.id === resetEmployeeId);
        const name = employee ? employee.name || employee.email : "the employee";

        reset.submit.disabled = true;

        try {
            await Api.resetEmployeePassword(resetEmployeeId, password);

            // Keep the window open so the admin can copy the password and pass it on
            reset.input.readOnly = true;
            reset.submit.hidden = true;
            reset.generate.hidden = true;
            reset.copy.hidden = false;
            reset.close.textContent = "Done";
            Utils.setMessage(reset.message, `Password reset. Give ${name} the new password shown above.`, "success");
        } catch (error) {
            console.error(error);
            reset.submit.disabled = false;
            Utils.setMessage(reset.message, error.message);
        }
    }

    async function copyPassword() {
        try {
            await navigator.clipboard.writeText(reset.input.value);
            reset.copy.innerHTML = '<i class="bi bi-clipboard-check"></i>';
        } catch (error) {
            reset.input.select(); // clipboard blocked: select it so Ctrl+C works
        }
    }

    async function deleteEmployee(id) {
        const employee = employees.find(item => item.id === id);
        const name = employee ? employee.name || employee.email : "this employee";

        if (!confirm(`Delete ${name}? This cannot be undone. Their past sales will be kept.`)) return;

        try {
            await Api.deleteEmployee(id);
            Utils.setMessage(message, `${name} was deleted.`, "success");

            await loadEmployees();
        } catch (error) {
            console.error(error);
            Utils.setMessage(message, error.message);
        }
    }


    /* ---------- Events ---------- */

    form.addEventListener("submit", addEmployee);
    $("refreshEmployees").addEventListener("click", loadEmployees);

    $("generatePassword").addEventListener("click", () => {
        $("employeePassword").value = generatePassword();
    });

    table.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const { action, id } = button.dataset;

        if (action === "disable") setDisabled(id, true);
        if (action === "enable") setDisabled(id, false);
        if (action === "reset") openResetModal(id);
        if (action === "sales") openSalesModal(id);
        if (action === "delete") deleteEmployee(id);
    });

    reset.form.addEventListener("submit", resetPassword);
    reset.generate.addEventListener("click", () => { reset.input.value = generatePassword(); });
    reset.copy.addEventListener("click", copyPassword);

    loadEmployees();
})();
