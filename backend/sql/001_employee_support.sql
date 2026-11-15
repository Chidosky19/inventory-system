-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It lets the app remember which employee recorded each sale.
-- Existing sales are not changed (they will show "-" under "Sold by").

alter table public.sales
    add column if not exists created_by uuid references auth.users (id) on delete set null,
    add column if not exists sold_by text;

create index if not exists sales_created_by_idx on public.sales (created_by);
