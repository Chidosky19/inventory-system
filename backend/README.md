# Chidosky Electronics – Inventory API

Express + Supabase REST API for the inventory front-end.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in (see below).
3. `npm run dev` (auto-restarts on changes) or `npm start`.
4. `npm test` runs the automated tests (no real database needed).

### Environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side secret key. Never put this in front-end code or commit it |
| `PORT` | Port to listen on (default 3000) |
| `ADMIN_EMAILS` | Comma-separated emails that are admins. **Set this.** If empty, any account without an employee role is treated as an admin |
| `SUPABASE_ANON_KEY` | Publishable key. Lets Supabase email a confirmation link when an employee signs up. Optional |
| `SITE_URL` | Where the app is reached (`http://localhost:3000`). Email links send people back here |
| `REQUIRE_APPROVAL` | `true` (default): employees who sign up themselves stay locked until an admin enables them. `false`: they can sign in right away |
| `CORS_ORIGINS` | Extra website origins allowed to call the API. Any `localhost` port is allowed outside production |
| `NODE_ENV` | Set to `production` when deployed |

## Roles

| | Admin | Employee |
|---|---|---|
| Dashboard, reports, stock in/out | yes | no |
| Add / edit / delete products | yes | no |
| View products | yes | yes (read-only) |
| Record sales | yes | yes |
| View sales | all sales | only their own |
| Manage employee accounts | yes | no |

A user is an admin if their email is in `ADMIN_EMAILS`. Employees either sign up
on `register.html` or are created from the admin's **Employees** page. Both get
`app_metadata.role = "employee"` in Supabase, which users cannot edit themselves.
Disabled employees are refused on their next request.

Self sign-up goes through `POST /auth/register` on this server (not Supabase's own
sign-up), so the role is always set by us. With `REQUIRE_APPROVAL=true` the account
starts out disabled and shows as "Pending" until an admin clicks Enable. Sign-ups are
limited to 5 per hour per IP address; if you run behind a proxy, add
`app.set("trust proxy", 1)` in `src/app.js` so the real address is used.

Forgotten passwords are handled by Supabase itself (reset email -> `reset-password.html`),
so nothing extra is needed here.

### One-time database change

Run `sql/001_employee_support.sql` once in Supabase (SQL Editor). It adds the
columns that record who made each sale. Existing sales are unchanged.

A product that already has sales or stock history can't be deleted (the database
protects those records) and the app says so. If you do want to delete such products,
run `sql/003_allow_product_delete.sql`: the history is kept but shows "Unknown product".

For the Contact page, also run `sql/002_contact_messages.sql` once. It creates the
table that stores the messages people send.

## Structure

```
server.js                 Starts the server
src/
├── app.js                Builds the Express app (CORS, auth, routes, errors)
├── config.js             Reads environment variables
├── supabase.js           Supabase client
├── middleware/
│   ├── auth.js           Checks the login token, works out the role, requireRole()
│   └── errorHandler.js   Consistent JSON errors
├── routes/               products, stock, sales, dashboard, employees, me
└── utils/                validation, database helper, HttpError
sql/                      One-time database changes
tests/                    Automated tests
test-support/             Fake Supabase used by the tests
```

## API

Every route except `/`, `/health`, `/auth/register` and `/contact` needs the header
`Authorization: Bearer <Supabase access token>`.

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Employee sign-up `{ name, email, phone, password }` (phone is required) |
| POST | `/contact` | public | Contact form message `{ name, email, topic?, message }` |
| GET | `/messages` | admin | Messages from the Contact page |
| PATCH / DELETE | `/messages/:id` | admin | Mark read / unread `{ is_read }`, delete |
| GET | `/me` | both | Current user: id, email, name, role |
| GET | `/dashboard` | admin | Statistics and low-stock products (with names) |
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

Errors are always `{ "error": "readable message" }` with a suitable status code
(400 invalid input, 401 not signed in, 403 not allowed or account disabled, 404 not found,
409 stock changed by another request).

## Security notes

- Turn off public sign-ups in Supabase (Authentication → Sign In / Providers).
  Employee sign-up here doesn't need them, and an account made through Supabase's own
  sign-up has no role, so it could otherwise reach the API unless `ADMIN_EMAILS` is set.
- Never commit `.env` (it is in `.gitignore`).
- The `record_sale` database function in Supabase is still required by `POST /sales`.
