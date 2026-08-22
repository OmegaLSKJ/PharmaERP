create or replace function public.erp_cancel_invoice(p_kind text,p_organization_id uuid,p_invoice_id uuid,p_reason text,p_actor_auth_id uuid default null,p_actor_email text default null,p_request_id uuid default null)
returns void language plpgsql security invoker set search_path=public as $$
declare v_voucher uuid; v_status text; v_date date;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'A cancellation reason is required.'; end if;
  if p_kind='sales' then
    select voucher_id,status::text,invoice_date into v_voucher,v_status,v_date from public.sales_invoices where id=p_invoice_id and organization_id=p_organization_id for update;
  elsif p_kind='purchases' then
    select voucher_id,status,invoice_date into v_voucher,v_status,v_date from public.purchase_invoices where id=p_invoice_id and organization_id=p_organization_id for update;
  else raise exception 'Unsupported invoice kind.';
  end if;
  if v_status is null then raise exception 'Invoice was not found.'; end if;
  if v_status<>'posted' then raise exception 'Only posted invoices can be cancelled.'; end if;
  perform public.erp_assert_open_period(p_organization_id,v_date);
  insert into public.stock_movements(organization_id,item_batch_id,warehouse_id,movement_type,quantity,occurred_at,source_type,source_id,remarks)
  select organization_id,item_batch_id,warehouse_id,case when p_kind='sales' then 'sale_return'::movement_type else 'purchase_return'::movement_type end,-quantity,now(),'invoice_cancellation',p_invoice_id,p_reason
  from public.stock_movements where organization_id=p_organization_id and source_id=p_invoice_id and source_type=case when p_kind='sales' then 'sales_invoice' else 'purchase_invoice' end;
  update public.vouchers set status='cancelled',narration=coalesce(narration,'')||' | Cancelled: '||p_reason where id=v_voucher;
  if p_kind='sales' then update public.sales_invoices set status='cancelled',cancellation_reason=p_reason,cancelled_at=now() where id=p_invoice_id;
  else update public.purchase_invoices set status='cancelled',cancellation_reason=p_reason,cancelled_at=now() where id=p_invoice_id; end if;
  insert into public.audit_logs(organization_id,entity_type,entity_id,action,before_state,after_state,actor_auth_id,actor_email,request_id,metadata) values(p_organization_id,p_kind,p_invoice_id,'cancelled',jsonb_build_object('status','posted'),jsonb_build_object('status','cancelled','reason',p_reason),p_actor_auth_id,p_actor_email,p_request_id,jsonb_build_object('stock_reversed',true,'voucher_cancelled',true));
end;
$$;

create or replace function public.erp_post_inventory_adjustment(p_organization_id uuid,p_document jsonb,p_actor_auth_id uuid default null,p_actor_email text default null,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_line jsonb; v_item uuid; v_batch uuid; v_warehouse uuid; v_number text:=nullif(trim(p_document->>'number'),''); v_date date:=coalesce(nullif(p_document->>'date','')::date,current_date); v_delta numeric;
begin
  if v_number is null or nullif(trim(p_document->>'reason'),'') is null or jsonb_array_length(coalesce(p_document->'lines','[]'::jsonb))=0 then raise exception 'Adjustment number, reason and lines are required.'; end if;
  perform public.erp_assert_open_period(p_organization_id,v_date);
  insert into public.inventory_adjustments(organization_id,adjustment_number,adjustment_date,reason,status,created_by_auth_id,posted_at) values(p_organization_id,v_number,v_date,p_document->>'reason','posted',p_actor_auth_id,now()) returning id into v_id;
  for v_line in select value from jsonb_array_elements(p_document->'lines') loop
    select id into v_item from public.items where organization_id=p_organization_id and (code=trim(v_line->>'itemCode') or lower(name)=lower(trim(v_line->>'name')));
    select id into v_batch from public.item_batches where item_id=v_item and batch_number=trim(v_line->>'batch');
    select id into v_warehouse from public.warehouses where organization_id=p_organization_id and (code=trim(v_line->>'warehouseCode') or lower(name)=lower(trim(v_line->>'warehouse')));
    v_delta:=coalesce(nullif(v_line->>'quantityDelta','')::numeric,0);
    if v_item is null or v_batch is null or v_warehouse is null or v_delta=0 then raise exception 'Invalid adjustment line.'; end if;
    insert into public.inventory_adjustment_lines(adjustment_id,item_batch_id,warehouse_id,quantity_delta,reason) values(v_id,v_batch,v_warehouse,v_delta,nullif(v_line->>'reason',''));
    insert into public.stock_movements(organization_id,item_batch_id,warehouse_id,movement_type,quantity,occurred_at,source_type,source_id,remarks) values(p_organization_id,v_batch,v_warehouse,'adjustment',v_delta,v_date::timestamptz,'inventory_adjustment',v_id,coalesce(nullif(v_line->>'reason',''),p_document->>'reason'));
  end loop;
  insert into public.audit_logs(organization_id,entity_type,entity_id,action,after_state,actor_auth_id,actor_email,request_id) values(p_organization_id,'inventory_adjustment',v_id,'posted',p_document,p_actor_auth_id,p_actor_email,p_request_id);
  return jsonb_build_object('id',v_id,'number',v_number,'status','posted');
end;
$$;

revoke execute on function public.erp_cancel_invoice(text,uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
revoke execute on function public.erp_post_inventory_adjustment(uuid,jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.erp_cancel_invoice(text,uuid,uuid,text,uuid,text,uuid),public.erp_post_inventory_adjustment(uuid,jsonb,uuid,text,uuid) to service_role;
