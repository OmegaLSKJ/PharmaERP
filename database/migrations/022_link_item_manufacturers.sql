-- 022_link_item_manufacturers.sql
-- Backfill and link all items having manufacturer_id IS NULL to their corresponding manufacturers.

DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP
    -- 1. Ensure any missing manufacturers referenced in stock_import_rows exist in public.manufacturers
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

    -- 2. Backfill items.manufacturer_id from stock_import_rows
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
      AND i.id = sir.item_id
      AND i.manufacturer_id IS NULL;

  END LOOP;
END $$;
