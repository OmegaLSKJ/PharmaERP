-- Make opening-stock movements traceable and idempotent at the source-row level.
alter table public.stock_movements
  add column if not exists import_row_id uuid references public.stock_import_rows(id);

create unique index if not exists stock_movements_import_row_id_key
  on public.stock_movements(import_row_id)
  where import_row_id is not null;
