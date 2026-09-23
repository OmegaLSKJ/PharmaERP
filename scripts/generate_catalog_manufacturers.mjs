import fs from 'fs';
import path from 'path';

// 1. Read mock-stock-data.json
const data = JSON.parse(fs.readFileSync('./lib/mock-stock-data.json', 'utf8'));
const items = data.items || [];

const nameToMfg = {};
const codeToMfg = {};
const allMfgs = new Set();

for (const item of items) {
  const mfg = (item.manufacturer || item.company || '').trim();
  if (!mfg) continue;
  allMfgs.add(mfg);

  const nameKey = (item.name || '').trim().toUpperCase();
  const codeKey = (item.code || '').trim().toUpperCase();
  if (nameKey) nameToMfg[nameKey] = mfg;
  if (codeKey) codeToMfg[codeKey] = mfg;
}

console.log(`Extracted ${allMfgs.size} distinct manufacturers, ${Object.keys(nameToMfg).length} item names, ${Object.keys(codeToMfg).length} item codes.`);

// Save JSON for the application
const catalogPayload = {
  names: nameToMfg,
  codes: codeToMfg,
};

fs.writeFileSync('./src/lib/catalogManufacturers.json', JSON.stringify(catalogPayload), 'utf8');
console.log('Wrote src/lib/catalogManufacturers.json');

// 2. Generate database/migrations/025_link_all_item_manufacturers.sql
let sql = `-- 025_link_all_item_manufacturers.sql
-- Backfill and ensure 100% of all items in public.items have manufacturer_id properly linked.
-- 1. Inserts all known pharmaceutical manufacturers if missing.
-- 2. Links public.items.manufacturer_id by code, name, and stock_import_rows.

DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP

    -- 1. Insert known manufacturers from catalog
`;

const sortedMfgs = Array.from(allMfgs).sort();
for (const mfg of sortedMfgs) {
  const escapedMfg = mfg.replace(/'/g, "''");
  const code = mfg.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'MFG';
  sql += `    INSERT INTO public.manufacturers (organization_id, name, code, is_active) VALUES (org_rec.id, '${escapedMfg}', '${code}', true) ON CONFLICT (organization_id, name) DO NOTHING;\n`;
}

sql += `
    -- 2. Ensure manufacturers from stock_import_rows exist
    INSERT INTO public.manufacturers (organization_id, name, code, is_active)
    SELECT DISTINCT
      org_rec.id,
      TRIM(COALESCE(NULLIF(sir.manufacturer, ''), NULLIF(sir.company, ''))),
      UPPER(SUBSTRING(REGEXP_REPLACE(TRIM(COALESCE(NULLIF(sir.manufacturer, ''), NULLIF(sir.company, ''))), '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6)),
      true
    FROM public.stock_import_rows sir
    WHERE sir.organization_id = org_rec.id
      AND COALESCE(NULLIF(sir.manufacturer, ''), NULLIF(sir.company, '')) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.manufacturers m
        WHERE m.organization_id = org_rec.id
          AND LOWER(TRIM(m.name)) = LOWER(TRIM(COALESCE(NULLIF(sir.manufacturer, ''), NULLIF(sir.company, ''))))
      )
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- 3. Link items from stock_import_rows where item_id, item_code, or product_name matches
    UPDATE public.items i
    SET manufacturer_id = m.id
    FROM public.stock_import_rows sir
    JOIN public.manufacturers m
      ON m.organization_id = org_rec.id
     AND (
       LOWER(TRIM(m.name)) = LOWER(TRIM(sir.manufacturer))
       OR LOWER(TRIM(m.name)) = LOWER(TRIM(sir.company))
     )
    WHERE i.organization_id = org_rec.id
      AND (
        i.id = sir.item_id
        OR (i.code IS NOT NULL AND i.code = sir.item_code)
        OR LOWER(TRIM(i.name)) = LOWER(TRIM(sir.product_name))
      )
      AND i.manufacturer_id IS NULL;

    -- 4. Temporary table for catalog mappings
    CREATE TEMP TABLE temp_catalog_mfg (
      item_code text,
      item_name text,
      mfg_name text
    ) ON COMMIT DROP;

`;

// Chunk items into insert statements
const entries = Object.entries(nameToMfg);
const chunkSize = 500;
for (let i = 0; i < entries.length; i += chunkSize) {
  const chunk = entries.slice(i, i + chunkSize);
  const rows = chunk.map(([itemName, mfg]) => {
    const escName = itemName.replace(/'/g, "''");
    const escMfg = mfg.replace(/'/g, "''");
    return `('${escName}', '${escMfg}')`;
  });
  sql += `    INSERT INTO temp_catalog_mfg (item_name, mfg_name) VALUES ${rows.join(',\n    ')};\n`;
}

sql += `
    -- 5. Update items where manufacturer_id is still NULL by matching item_name
    UPDATE public.items i
    SET manufacturer_id = m.id
    FROM temp_catalog_mfg t
    JOIN public.manufacturers m
      ON m.organization_id = org_rec.id
     AND LOWER(TRIM(m.name)) = LOWER(TRIM(t.mfg_name))
    WHERE i.organization_id = org_rec.id
      AND i.manufacturer_id IS NULL
      AND UPPER(TRIM(i.name)) = t.item_name;

    DROP TABLE IF EXISTS temp_catalog_mfg;

  END LOOP;
END $$;
`;

fs.writeFileSync('./database/migrations/025_link_all_item_manufacturers.sql', sql, 'utf8');
console.log('Wrote database/migrations/025_link_all_item_manufacturers.sql');
