-- 024_main_store_stock.sql
-- Ensure Main Store exists as primary Godown / Store Room with address and full stock allocation

DO $$
DECLARE
  org_rec RECORD;
  v_main_wh_id uuid;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP
    -- 1. Ensure or update MAIN warehouse to "Main Store"
    INSERT INTO public.warehouses (organization_id, code, name, warehouse_type, address, capacity, is_active)
    VALUES (
      org_rec.id,
      'MAIN',
      'Main Store',
      'Store Room',
      'MAIN ROAD, NH - 52, BORGANG, BISWANATH, ASSAM',
      100000,
      true
    )
    ON CONFLICT (organization_id, code) DO UPDATE
    SET name = 'Main Store',
        warehouse_type = 'Store Room',
        address = 'MAIN ROAD, NH - 52, BORGANG, BISWANATH, ASSAM',
        capacity = GREATEST(public.warehouses.capacity, 100000),
        is_active = true
    RETURNING id INTO v_main_wh_id;

    IF v_main_wh_id IS NULL THEN
      SELECT id INTO v_main_wh_id FROM public.warehouses WHERE organization_id = org_rec.id AND code = 'MAIN';
    END IF;

    -- 2. Link any unallocated stock movements to Main Store
    UPDATE public.stock_movements
    SET warehouse_id = v_main_wh_id
    WHERE organization_id = org_rec.id
      AND (warehouse_id IS NULL OR warehouse_id NOT IN (SELECT id FROM public.warehouses WHERE organization_id = org_rec.id));

  END LOOP;
END $$;
