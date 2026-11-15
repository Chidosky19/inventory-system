# Chidosky Electronics – Inventory Front-End

Browser front-end for the inventory system. It talks to the REST backend
(`API_URL` in `js/config.js`) and uses Supabase to sign in admins and employees.

## Structure

```
frontend/
├── pages/                  every HTML page, all in one place
│   ├── index.html              Dashboard (admin)
│   ├── products.html           Products (cards or list, search, filters, sorting, add, edit, delete, export)
│   ├── sales.html              Record sales + history (export)
│   ├── stock.html              Stock in / out + history
│   ├── reports.html            Revenue summary, best sellers, charts
│   ├── employees.html          Approve, disable, delete employees; see their sales (admin)
│   ├── messages.html           Messages sent from the Contact page (admin)
│   ├── login.html              Admin login
│   ├── employee-login.html     Employee login
│   ├── register.html           Employee sign-up
│   ├── email-confirmed.html    Where the confirmation email link lands
│   ├── forgot-password.html    Asks Supabase to email a reset link
│   ├── reset-password.html     Page the reset link opens: choose a new password
│   ├── employee.html           Employee workspace: record sales, my sales, receipt
│   ├── account.html            My account: change name and password (admin and employee)
│   └── about.html, contact.html, support.html     Public info pages
├── css/
│   ├── style.css           Admin pages (variables + light/dark theme)
│   ├── employee.css        Employee login, sign-up, reset pages and the sales desk
│   ├── products.css        Products page (cards, list view, filters)
│   ├── admin-login.css     Admin login page
│   └── site.css            About, Contact, Support, My account
└── js/
    ├── config.js           API URL, Supabase keys, locale, currency, shop details  <- edit settings here
    ├── theme.js            Light/dark theme (loaded in <head>)
    ├── auth-utils.js       Roles and which page each role belongs on
    ├── auth-guard.js       Sends signed-out / wrong-role visitors away, handles logout
    ├── utils.js            Money/date formatting, CSV download, table + message helpers
    ├── api.js              Every backend request in one place
    ├── layout.js           Mobile sidebar toggle, current date
    └── pages/              One script per page
```

Pages link to each other by file name (`products.html`) and reach the shared files with
`../css/...` and `../js/...`.

## Running

Normally you don't run this folder on its own: the backend serves it, so `npm start` in
the project root and opening <http://localhost:3000> is enough.

To work on the pages with a separate static server (for example the VS Code "Live Server"
extension), open `pages/employee-login.html` with it and keep the backend running on
`http://localhost:3000`. The pages detect this and talk to the backend automatically.
To point at a deployed backend, change `API_URL` in `js/config.js`.

## Two kinds of users

- **Admin** signs in at `login.html` and sees every page.
- **Employee** signs in at `employee-login.html` and only gets the sales
  workspace (`employee.html`). An employee can sign up on `register.html` and
  sign in later once the admin approves the account (see `REQUIRE_APPROVAL` in the
  backend README), or the admin can create the account on the **Employees** page.
  That page also shows each employee's sales, and lets you disable, delete or
  reset a password.

## Setting up Supabase for password reset

The reset email is sent by Supabase, so two things must be set in the Supabase
dashboard (Authentication):

1. **URL Configuration**: add the address of `reset-password.html` (for example
   `http://127.0.0.1:5500/reset-password.html` while testing, and your real site
   address later) to *Redirect URLs*. Without this the link in the email won't work.
2. **SMTP Settings**: Supabase's built-in email sender is limited to a few emails per
   hour and is meant for testing. Add your own SMTP provider before real staff use it.

## Shop details

The About, Contact and Support pages read the shop's email, phone, address and opening
hours from `CONFIG.SITE` in `js/config.js`. They are placeholders for now, so change them.
The contact form opens the visitor's email app with the message filled in.

If someone opens the wrong kind of page, they are sent to their own. This is
for convenience only: the backend refuses anything an employee isn't allowed to
do, even if they call it directly.

## Talking to the backend

Every request sends the signed-in user's Supabase token in an
`Authorization: Bearer ...` header (see `js/api.js`), and the backend rejects
requests without a valid one. If the session expires, the user is sent back to
`login.html`. Start the backend (see its README) before opening the pages.
