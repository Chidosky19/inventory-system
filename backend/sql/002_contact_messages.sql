-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Stores the messages sent from the Contact page.

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
