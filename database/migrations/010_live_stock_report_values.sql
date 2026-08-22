create or replace view public.erp_stock_position with (security_invoker=true) as
select sm.organization_id, i.id item_id, i.code item_code, i.name item_name, i.schedule_class, i.is_recalled, ib.id item_batch_id, ib.batch_number, ib.expiry_on, w.id warehouse_id, w.name warehouse_name, round(sum(sm.quantity),3) quantity,
  coalesce((select sum(sr.quantity) from public.stock_reservations sr where sr.item_batch_id=ib.id and sr.warehouse_id=w.id and sr.status='active' and (sr.expires_at is null or sr.expires_at>now())),0) reserved_quantity,
  ib.mrp, i.purchase_rate
from public.stock_movements sm join public.item_batches ib on ib.id=sm.item_batch_id join public.items i on i.id=ib.item_id join public.warehouses w on w.id=sm.warehouse_id
group by sm.organization_id,i.id,i.code,i.name,i.schedule_class,i.is_recalled,ib.id,ib.batch_number,ib.expiry_on,ib.mrp,w.id,w.name,i.purchase_rate;
grant select on public.erp_stock_position to service_role;
