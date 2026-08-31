import fs from 'node:fs'

const mockStock = JSON.parse(fs.readFileSync('apps/web/lib/mock-stock-data.json', 'utf8'))
const hsnList = mockStock.hsn || []

let sql = `-- 013_seed_hsn_master.sql
-- Seed HSN/SAC codes from HSN.XLS

DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP
`

for (const h of hsnList) {
  const code = h.code.replace(/'/g, "''")
  const desc = (h.description || '').replace(/'/g, "''")
  const gst = Number(h.gst_rate) || 0
  sql += `    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate) VALUES (org_rec.id, '${code}', '${desc}', ${gst}) ON CONFLICT (organization_id, code) DO UPDATE SET description = EXCLUDED.description, gst_rate = EXCLUDED.gst_rate;\n`
}

sql += `  END LOOP;
END $$;
`

fs.writeFileSync('database/migrations/013_seed_hsn_master.sql', sql, 'utf8')
console.log(`Generated database/migrations/013_seed_hsn_master.sql with ${hsnList.length} HSN codes`)
