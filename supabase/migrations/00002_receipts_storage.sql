-- ==========================================================================
-- Řemeslníci PWA – Receipts Storage Migration
-- ==========================================================================
-- Adds:
--   1. receipt_url column on expenses table
--   2. Storage bucket "receipts" (private)
--   3. RLS policies on storage.objects for user-scoped access
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Add receipt_url to expenses
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column if not exists receipt_url text not null default '';

-- ---------------------------------------------------------------------------
-- 2. Create storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Storage RLS policies
-- ---------------------------------------------------------------------------
-- Path format: {user_id}/{work_entry_id}/{expense_id}.jpg
-- First path segment = user_id → auth.uid()::text must match it.

create policy "receipts_select"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "receipts_insert"
on storage.objects for insert
with check (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "receipts_delete"
on storage.objects for delete
using (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);
