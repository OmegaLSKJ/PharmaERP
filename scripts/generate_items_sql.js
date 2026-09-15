import fs from 'node:fs'

const mockStock = JSON.parse(fs.readFileSync('apps/web/lib/mock-stock-data.json', 'utf8'))
const items = mockStock.items || []

let sql = `-- 014_seed_2016_items.sql
-- Seed 2016 unique items and their batches from Marg.csv & HSN.XLS

DO $$
DECLARE
  org_rec RECORD;
  v_item_id uuid;
  v_mfg_id uuid;
  v_hsn_id uuid;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP
`

for (const item of items) {
  const code = item.code.replace(/'/g, "''")
  const name = item.name.replace(/'/g, "''")
  const packing = (item.packing || '').replace(/'/g, "''")
  const mfg = (item.manufacturer || '').replace(/'/g, "''")
  const hsn = (item.hsn || '').replace(/'/g, "''")
  const mrp = Number(item.mrp) || 0
  const saleRate = Number(item.saleRate) || 0
  const purchaseRate = Number(item.purchaseRate) || 0

  sql += `
    -- Item: ${code} - ${name}
    SELECT id INTO v_mfg_id FROM public.manufacturers WHERE organization_id = org_rec.id AND name = '${mfg}';
    IF v_mfg_id IS NULL AND '${mfg}' <> '' THEN
      INSERT INTO public.manufacturers (organization_id, name, code) VALUES (org_rec.id, '${mfg}', UPPER(SUBSTRING(REGEXP_REPLACE('${mfg}', '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 6))) RETURNING id INTO v_mfg_id;
    END IF;

    SELECT id INTO v_hsn_id FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '${hsn}';

    INSERT INTO public.items (organization_id, code, name, packing, manufacturer_id, hsn_id, mrp, sale_rate, purchase_rate, is_active)
    VALUES (org_rec.id, '${code}', '${name}', '${packing}', v_mfg_id, v_hsn_id, ${mrp}, ${saleRate}, ${purchaseRate}, true)
    ON CONFLICT (organization_id, code) DO UPDATE
    SET name = EXCLUDED.name, packing = EXCLUDED.packing, manufacturer_id = EXCLUDED.manufacturer_id, hsn_id = EXCLUDED.hsn_id, mrp = EXCLUDED.mrp, sale_rate = EXCLUDED.sale_rate, purchase_rate = EXCLUDED.purchase_rate
    RETURNING id INTO v_item_id;
`
}

sql += `
  END LOOP;
END $$;
`

fs.writeFileSync('database/migrations/014_seed_2016_items.sql', sql, 'utf8')
console.log(`Generated database/migrations/014_seed_2016_items.sql with ${items.length} items`)
