alter function public.erp_post_note(uuid, character varying, uuid, uuid, date, jsonb, numeric, numeric, numeric, text, character varying, uuid)
  set search_path = public;

revoke execute on function public.erp_post_note(uuid, character varying, uuid, uuid, date, jsonb, numeric, numeric, numeric, text, character varying, uuid)
  from public, anon, authenticated;
grant execute on function public.erp_post_note(uuid, character varying, uuid, uuid, date, jsonb, numeric, numeric, numeric, text, character varying, uuid)
  to service_role;

create index if not exists idx_stock_import_rows_item_id
  on public.stock_import_rows(item_id);
create index if not exists idx_stock_import_rows_stock_movement_id
  on public.stock_import_rows(stock_movement_id);
