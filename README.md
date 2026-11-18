# Chidosky Electronics - Inventory System

One project with everything in it: the admin dashboard, the employee sales desk and the
server behind them. The server also serves the web pages, so the whole system runs from
one command at one address.

```
inventory-system/
├── package.json              shortcuts: npm run setup / start / dev
├── README.md                 this file
├── backend/                  the server (Node + Express, talks to Supabase)
│   ├── server.js             starts the server
│   ├── .env                  your settings (copy .env.example, never share it)
│   ├── sql/
│   │   ├── setup.sql                           run once in Supabase
│   │   └── optional-allow-product-delete.sql   optional
│   └── src/
│       ├── app.js            builds the app: security, routes, error handling
│       ├── config.js         reads .env
│       ├── supabase.js       the database connection
│       ├── middleware/       auth.js (who is logged in, which role), errorHandler.js
│       ├── routes/           products, stock, sales, dashboard, employees, auth, contact, me
│       └── utils/            validation, database helper, error type, rate limit, account checks
└── frontend/                 what people see in the browser
    ├── favicon.svg           browser-tab icon
    ├── pages/                every HTML page
    ├── css/                  admin.css (admin pages + products), admin-login.css,
    │                         employee.css, site.css (About/Contact/Support/My account),
    │                         ui.css (pop-ups, confirm box, loading, notification bell)
    └── js/
        ├── core/             config.js (your settings), theme.js, auth-utils.js, auth-guard.js,
        │                     utils.js (helpers + money-amount font), api.js (all backend requests)
        ├── components/       layout.js (phone menu, tables), notifications.js (bell + alerts)
        └── pages/            one script per page
```

## What it does

- **Admin:** dashboard (income, sales trend, top sellers, low stock), products, stock in/out,
  sales, reports (income per day, date range, CSV export), employees (approve, disable, reset
  passwords, see each person's sales), messages from the Contact page, and a notification bell
  for new sales, messages and staff sign-ups.
- **Employees:** sign up, confirm their email, sign in, record sales, see their own sales,
  print a receipt, change their name and password.
- **Everyone:** forgot password by email, light and dark mode, phone-friendly pages.

## 1. Start it

You need [Node.js](https://nodejs.org) 18 or newer. In PowerShell:

```
cd inventory-system
npm run setup
```

Create `backend/.env`: copy `backend/.env.example`, rename the copy to `.env`, and fill it in:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side secret key. Never put it in frontend code or share it |
| `SUPABASE_ANON_KEY` | Publishable key. Lets Supabase email a confirmation link on sign-up |
| `ADMIN_EMAILS` | Comma-separated admin emails. **Set this.** If empty, any account without an employee role counts as an admin |
| `SITE_URL` | Where the site is reached (`http://localhost:3000`, or your real address once online). Email links send people back here |
| `REQUIRE_APPROVAL` | `true` (default): self sign-ups stay locked until an admin approves. `false`: they can sign in right away |
| `CORS_ORIGINS` | Extra website addresses allowed to call the API (not needed when one server serves everything) |
| `NODE_ENV` | `production` when online |
| `PORT` | Port to listen on (default 3000). Hosts like Render set this for you |

Then:

```
npm start
```

and open <http://localhost:3000>. Use `npm run dev` while editing code (it restarts for you).

> If npm says it "could not read package.json", you are in the wrong folder. Run `dir` and
> make sure you can see `package.json`, `backend` and `frontend`.

Frontend settings (shop name, phone, address, currency, Supabase publishable key) are in
`frontend/js/core/config.js`.

## 2. Supabase: run the scripts once

In Supabase open **SQL Editor -> New query**, paste a script from `backend/sql/`, press **Run**:

| Script | What for |
|---|---|
| `setup.sql` | Needed. Records who made each sale, and creates the table for Contact page messages. Safe to run again |
| `optional-allow-product-delete.sql` | Optional. Lets you delete products that already have sales (their history then shows "Unknown product") |

The `record_sale` database function in Supabase is also required by the sales feature.

## 3. Supabase: email setup (confirmation and forgot password)

Both emails are sent by Supabase, under **Authentication**.

**a) Turn confirmation on.** Sign In / Providers -> Email -> switch **Confirm email** on.

**b) Tell Supabase where your site is.** URL Configuration:
- **Site URL**: `http://localhost:3000` (your real address once online)
- **Redirect URLs**: add `/email-confirmed.html` and `/reset-password.html` on that address
  (and the same two with your real address later)

**c) Set up an email sender (SMTP).** Supabase's built-in sender is only for testing: it sends
very few emails per hour. For real staff use your own sender under **SMTP Settings**:
- **Gmail:** turn on 2-step verification, create an *App password*, then use host
  `smtp.gmail.com`, port `465`, your Gmail address and the app password.
- **Brevo** or **Resend:** create a free account, verify your sender, copy the SMTP details.

**d) Put the publishable key in `.env`** as `SUPABASE_ANON_KEY`. Without it the app still
works but creates employees with no confirmation email.

## Roles and sign-up

| | Admin | Employee |
|---|---|---|
| Dashboard, reports, stock in/out | yes | no |
| Add / edit / delete products | yes | no |
| View products | yes | yes (read-only) |
| Record sales | yes | yes |
| View sales | all sales | only their own |
| Manage employee accounts | yes | no |

A user is an admin if their email is in `ADMIN_EMAILS`. Employees get
`app_metadata.role = "employee"` in Supabase, which users cannot edit themselves.

**Sign-up flow:** the person fills in `register.html`; the server creates the account and
Supabase emails a link; they confirm on `email-confirmed.html`; with `REQUIRE_APPROVAL=true`
the admin also clicks **Approve** on the Employees page; then they sign in at
`employee-login.html`. Sign-ups are limited to 5 per hour per IP address.

**Forgot password:** "Forgot password?" on the sign-in page -> email link -> `reset-password.html`.

## Notifications

On the admin pages a bell shows new sales, unread messages, employees waiting for approval and
products that need restocking, with badges in the menu. Every 15 seconds the page asks the
server one tiny question (`GET /dashboard/alerts`); when something changed it shows a pop-up.
"New sales" are counted since you last opened the Sales page or pressed "Mark sales as seen"
(remembered per browser). Employees get a pop-up whenever they record a sale.

## Putting it online (Render)

1. Put the project on GitHub (`.env` is already ignored).
2. On Render create a **Web Service** from the repository: Build Command `npm run setup`,
   Start Command `npm start`, Health Check Path `/health`.
3. Add the variables from the table above (`SITE_URL` = your Render address, `NODE_ENV=production`).
4. Behind a host's proxy, make sure `src/app.js` has `app.set("trust proxy", 1);` right after
   `const app = express();`, so the sign-up limit counts real visitors.
5. In Supabase set the Site URL and Redirect URLs to your Render address (step 3b).

## API

Every route except `/`, `/health`, `/auth/register` and `/contact` needs the header
`Authorization: Bearer <Supabase access token>`.

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Employee sign-up `{ name, email, phone, password }` |
| POST | `/contact` | public | Contact form message `{ name, email, topic?, message }` |
| GET | `/messages` | admin | Messages from the Contact page |
| PATCH / DELETE | `/messages/:id` | admin | Mark read / unread `{ is_read }`, delete |
| GET | `/me` | both | Current user: id, email, name, role |
| GET | `/dashboard` | admin | Statistics and low-stock products |
| GET | `/dashboard/alerts` | admin | Newest sale, unread messages, employees waiting (for the bell) |
| GET | `/products`, `/products/:id` | both | View products |
| POST / PUT / DELETE | `/products`, `/products/:id` | admin | Add, edit, delete products |
| POST | `/stock/in/:productId`, `/stock/out/:productId` | admin | Add / remove stock `{ quantity, note? }` |
| GET | `/stock/history` | admin | Stock movements |
| POST | `/sales` | both | Record a sale `{ product_id, quantity }` |
| GET | `/sales`, `/sales/:id` | both | Sales (employees: only their own) |
| GET / POST | `/employees` | admin | List / add employees `{ name, email, password }` |
| PATCH | `/employees/:id` | admin | Disable / enable `{ disabled: true \| false }` |
| PATCH | `/employees/:id/password` | admin | Reset an employee's password `{ password }` |
| DELETE | `/employees/:id` | admin | Delete an employee (their sales are kept) |

Errors are always `{ "error": "readable message" }` with a suitable status code (400 invalid
input, 401 not signed in, 403 not allowed or account disabled, 404 not found, 409 stock changed
by another request).

## Security notes

- Turn off public sign-ups in Supabase (Authentication -> Sign In / Providers). Employee sign-up
  here doesn't need them, and an account made through Supabase's own sign-up has no role.
- Never commit `.env` (it is in `.gitignore`) and never put the secret key in frontend code.
- Enable Row Level Security on your tables in Supabase, so the publishable key in the browser
  cannot read them directly. The server uses the secret key and is not affected.

## When something goes wrong

| What you see | Usually means |
|---|---|
| "Missing required environment variable(s)" | `backend/.env` is missing or misnamed |
| "We couldn't send the confirmation email" | SMTP isn't set up yet (step 3c) |
| "Too many emails were sent just now" | Supabase's email limit. Add your own SMTP, or wait |
| Email link opens a wrong or blocked page | Site URL / Redirect URLs missing (step 3b) |
| Employee can't sign in after confirming | Waiting for admin approval, or the account is disabled |
| Sale recorded but "could not be linked" | `setup.sql` not run yet |
| Product can't be deleted | It has sales; see `optional-allow-product-delete.sql` |
