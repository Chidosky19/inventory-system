# Chidosky Electronics - Inventory System

One project with everything in it: the admin dashboard, the employee sales desk and the
server behind them. The server also serves the web pages, so the whole system runs from
one command at one address.

```
inventory-system/
├── package.json        shortcuts: npm run setup / start / dev / test
├── backend/            Node + Express API (talks to Supabase)
│   ├── .env            your settings (create it from .env.example, never share it)
│   ├── sql/            scripts to run once in Supabase
│   └── src/ tests/
└── frontend/           the web pages
    ├── pages/          every HTML page, all in one place
    ├── css/            stylesheets
    └── js/             scripts (js/pages has one per page)
```

## What it does

- **Admin:** dashboard with today's, yesterday's, weekly and monthly income, products, stock, sales and reports (including income for every day, with a date range and CSV export), employees (approve, disable,
  reset passwords, see each person's sales), messages from the Contact page, CSV export of
  sales and products.
- **Employees:** sign up (name, email, phone number and password), confirm their email, sign in, record sales, see their own sales,
  print a receipt, change their name and password.
- **Everyone:** forgot password by email, light and dark mode, phone-friendly pages,
  About, Contact and Support pages.

## 1. Start it

You need [Node.js](https://nodejs.org) 18 or newer. In PowerShell:

```
cd inventory-system
npm run setup
```

Then create `backend/.env`: copy `backend/.env.example`, rename the copy to `.env`, and
fill it in (see the comments inside the file). Then:

```
npm start
```

and open <http://localhost:3000>. Use `npm run dev` instead while you are editing code
(it restarts the server for you).

> If npm says it "could not read package.json", you are in the wrong folder. Run
> `dir` and make sure you can see `package.json` and the `backend` and `frontend` folders.

## 2. Supabase: run the scripts once

In Supabase, open **SQL Editor -> New query**, paste one script at a time from
`backend/sql/`, and press **Run**:

| Script | What for |
|---|---|
| `001_employee_support.sql` | Records who made each sale (needed for "My sales" and "Sold by") |
| `002_contact_messages.sql` | Stores messages from the Contact page |
| `003_allow_product_delete.sql` | Optional. Lets you delete products that already have sales |

## 3. Supabase: email setup (confirmation and forgot password)

Both emails are sent by Supabase. The menu names below may be worded slightly differently
in your dashboard, but they are all under **Authentication**.

**a) Turn confirmation on.** Sign In / Providers -> Email -> switch **Confirm email** on.

**b) Tell Supabase where your site is.** URL Configuration:
- **Site URL**: `http://localhost:3000` (your real web address once deployed)
- **Redirect URLs**: add
  `http://localhost:3000/email-confirmed.html` and
  `http://localhost:3000/reset-password.html`
  (and the same two with your real web address later)

**c) Set up an email sender (SMTP).** This one matters. Supabase's built-in sender is only
for testing: it sends very few emails per hour and may only deliver to people on your
Supabase team. For real staff you need your own sender under **SMTP Settings**:

- **Gmail** (quick to start): turn on 2-step verification on the Google account, create an
  *App password*, then use host `smtp.gmail.com`, port `465`, username = your Gmail
  address, password = the app password.
- **Brevo** or **Resend** (better for many emails): create a free account, verify your
  sender address or domain, and copy the SMTP host, port, username and password they show.

Fill in the sender name (for example "Chidosky Electronics") and sender email, save, then
register a test employee with a real inbox.

**d) Put the public key in `.env`.** On Supabase's API Keys page copy the *publishable*
key (the same one that is in `frontend/js/config.js`) into `SUPABASE_ANON_KEY`. Without
it the app still works but creates employees with no confirmation email.

Optional: Authentication -> Email Templates lets you rewrite the wording of the
"Confirm signup" and "Reset password" emails.

## How the sign-up flow works

1. The person fills in `register.html` (name, email, phone number and password). The server asks Supabase to create the account,
   and Supabase emails them a link.
2. They click the link and land on `email-confirmed.html`. That only confirms the address,
   it does not sign them in.
3. If `REQUIRE_APPROVAL=true` (the default), the admin also has to click **Approve** on the
   Employees page. Set it to `false` in `.env` if you don't want that second step.
4. They sign in at `employee-login.html`. If they try before confirming, the page offers
   to send the link again.

**Forgot password:** "Forgot password?" on the sign-in page -> Supabase emails a link ->
`reset-password.html` -> choose a new password. A signed-in person can also change it on
the My account page.

## When something goes wrong

| What you see | Usually means |
|---|---|
| "We couldn't send the confirmation email" | SMTP isn't set up yet (step 3c) |
| "Too many emails were sent just now" | Supabase's email limit. Add your own SMTP, or wait |
| Email link opens a wrong or blocked page | Site URL / Redirect URLs missing (step 3b) |
| Employee can't sign in after confirming | Waiting for admin approval, or the account is disabled |
| Sale recorded but "could not be linked" | `001_employee_support.sql` not run yet |
| Product can't be deleted | It has sales; see `003_allow_product_delete.sql` |

More detail on the server is in `backend/README.md` and on the pages in `frontend/README.md`.
