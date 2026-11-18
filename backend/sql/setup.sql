-- DATABASE SETUP. Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again: nothing is changed twice.
--
--  Part 1: lets the app remember which employee recorded each sale.
--          Existing sales are not changed (they will show "-" under "Sold by").
--  Part 2: creates the table that stores messages sent from the Contact page.


-- ===== Part 1: who made each sale =====

alter table public.sales
    add column if not exists created_by uuid references auth.users (id) on delete set null,
    add column if not exists sold_by text;

create index if not exists sales_created_by_idx on public.sales (created_by);


-- ===== Part 2: Contact page messages =====

create table if not exists public.contact_messages (
    id         bigint generated always as identity primary key,
    name       text        not null,
    email      text        not null,
    topic      text        not null default 'Other',
    message    text        not null,
    is_read    boolean     not null default false,
    created_at timestamptz not null default now()
);

-- Only the backend (secret key) touches this table, so nobody can read it from the browser
alter table public.contact_messages enable row level security;
