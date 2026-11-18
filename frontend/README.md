# Chidosky Electronics – Inventory Front-End

Browser front-end for the inventory system. It talks to the REST backend
(`API_URL` in `js/core/config.js`) and uses Supabase to sign in admins and employees.

## Structure

```
frontend/
├── favicon.svg             Browser-tab icon (swap in your own logo here)
├── pages/                  every HTML page, all in one place
│   ├── index.html              Dashboard (admin): figures, sales trend, top sellers, low stock
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
│   ├── admin.css           Admin pages (colours, light/dark theme, layout)
│   ├── products.css        Products page (cards, list view, filters)
│   ├── admin-login.css     Admin login page
│   ├── employee.css        Employee login, sign-up, reset pages and the sales desk
│   ├── site.css            About, Contact, Support, My account
│   └── ui.css              Shared by admin + employee pages: pop-ups, confirm box, loading
│                           placeholders, empty states, notification bell, money-amount font
└── js/
    ├── core/               Used by (almost) every page
    │   ├── config.js           API URL, Supabase keys, locale, currency, shop details  <- edit settings here
    │   ├── theme.js            Light/dark theme (loaded in <head>)
    │   ├── auth-utils.js       Roles and which page each role belongs on
    │   ├── auth-guard.js       Sends signed-out / wrong-role visitors away, handles logout
    │   ├── utils.js            Formatting, CSV download, table helpers, pop-ups (toast) and confirm box
    │   ├── amounts.js          Keeps ₦ amounts in the original font while the rest uses Roboto Mono
    │   └── api.js              Every backend request in one place
    ├── components/         Page chrome used by the admin pages
    │   ├── layout.js           Mobile sidebar toggle, current date
    │   ├── tables.js           Loading placeholders, phone "card" tables
    │   └── notifications.js    Bell, menu badges, dashboard chips, new-sale / message pop-ups
    └── pages/              One script per page
```

Pages link to each other by file name (`products.html`) and reach the shared files with
`../css/...` and `../js/core/...` or `../js/components/...`.

## Running

Normally you don't run this folder on its own: the backend serves it, so `npm start` in
the project root and opening <http://localhost:3000> is enough.

To work on the pages with a separate static server (for example the VS Code "Live Server"
extension), open `pages/employee-login.html` with it and keep the backend running on
`http://localhost:3000`. The pages detect this and talk to the backend automatically.
To point at a deployed backend, change `API_URL` in `js/core/config.js`.

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
hours from `CONFIG.SITE` in `js/core/config.js`. They are placeholders for now, so change them.
The contact form sends the message to the backend; it shows up on the **Messages** page, where you can reply by email.

If someone opens the wrong kind of page, they are sent to their own. This is
for convenience only: the backend refuses anything an employee isn't allowed to
do, even if they call it directly.

## Talking to the backend

Every request sends the signed-in user's Supabase token in an
`Authorization: Bearer ...` header (see `js/core/api.js`), and the backend rejects
requests without a valid one. If the session expires, the user is sent back to
`login.html`. Start the backend (see its README) before opening the pages.

## Notifications

On the admin pages a bell in the top bar shows new sales, unread messages, employees waiting for
approval and products that need restocking. The same counts appear as badges in the menu and in
the browser tab title. Every 15 seconds the page asks the backend one small question
(`GET /dashboard/alerts`); only when something changed does it load the details and show a
pop-up. "New sales" are counted from the last time you opened the Sales page or pressed
"Mark sales as seen" (remembered per browser). Employees get a pop-up whenever they record a sale.
