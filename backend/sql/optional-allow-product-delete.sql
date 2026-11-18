-- OPTIONAL. Run in Supabase -> SQL Editor only if you want to be able to delete products
-- that already have sales or stock history.
--
-- Right now the database refuses, because those records point at the product.
-- After this change, deleting a product keeps its sales and stock history, but they
-- will show "Unknown product" instead of the product's name. Nothing else is lost.
--
-- If you would rather keep product names on old sales, don't run this: set the
-- product's quantity to 0 instead of deleting it.

do $$
declare
    r record;
begin
    for r in
        select c.conrelid::regclass as tbl, c.conname, a.attname as col
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
        where c.contype = 'f'
          and c.confrelid = 'public.products'::regclass
          and array_length(c.conkey, 1) = 1
    loop
        execute format('alter table %s alter column %I drop not null', r.tbl, r.col);
        execute format('alter table %s drop constraint %I', r.tbl, r.conname);
        execute format(
            'alter table %s add constraint %I foreign key (%I) references public.products (id) on delete set null',
            r.tbl, r.conname, r.col
        );
    end loop;
end
$$;
