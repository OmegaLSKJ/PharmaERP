-- 023_map_all_items_hsn.sql
-- Backfill and ensure 100% of all items in public.items are mapped to their corresponding HSN/SAC code.

DO $$
DECLARE
  org_rec RECORD;
  v_hsn_3004 uuid;
  v_hsn_2106 uuid;
  v_hsn_3401 uuid;
  v_hsn_3002 uuid;
  v_hsn_3005 uuid;
  v_hsn_3006 uuid;
  v_hsn_9018 uuid;
  v_hsn_4014 uuid;
  v_hsn_3822 uuid;
  v_hsn_3304 uuid;
  v_hsn_2309 uuid;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP

    -- 1. Ensure authoritative standard HSN master codes exist for the organization
    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3004', 'Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses', 5)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 5;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '2106', 'Food preparations / Nutraceuticals and Dietary supplements', 18)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 18;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3401', 'Medicated soaps, organic surface-active products and preparations for washing the skin', 18)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 18;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3002', 'Human blood, animal blood, vaccines, toxins, cultures of micro-organisms', 5)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 5;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3005', 'Wadding, gauze, bandages and surgical dressings', 5)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 5;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3006', 'Pharmaceutical goods, dental cements, first-aid boxes and kits', 12)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 12;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '9018', 'Instruments and appliances used in medical, surgical, dental or veterinary sciences, syringes, needles', 12)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 12;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '4014', 'Hygienic or pharmaceutical articles of vulcanized rubber, gloves', 12)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 12;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3822', 'Diagnostic or laboratory reagents on a backing, prepared diagnostic or laboratory reagents', 12)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 12;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '3304', 'Beauty or make-up preparations and preparations for the care of the skin, medicated creams, lotions', 18)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 18;

    INSERT INTO public.hsn_codes (organization_id, code, description, gst_rate)
    VALUES (org_rec.id, '2309', 'Preparations of a kind used in animal feeding / Veterinary feed supplements', 12)
    ON CONFLICT (organization_id, code) DO UPDATE SET gst_rate = 12;

    -- Grab primary UUIDs
    SELECT id INTO v_hsn_3004 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3004' LIMIT 1;
    SELECT id INTO v_hsn_2106 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '2106' LIMIT 1;
    SELECT id INTO v_hsn_3401 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3401' LIMIT 1;
    SELECT id INTO v_hsn_3002 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3002' LIMIT 1;
    SELECT id INTO v_hsn_3005 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3005' LIMIT 1;
    SELECT id INTO v_hsn_3006 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3006' LIMIT 1;
    SELECT id INTO v_hsn_9018 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '9018' LIMIT 1;
    SELECT id INTO v_hsn_4014 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '4014' LIMIT 1;
    SELECT id INTO v_hsn_3822 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3822' LIMIT 1;
    SELECT id INTO v_hsn_3304 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '3304' LIMIT 1;
    SELECT id INTO v_hsn_2309 FROM public.hsn_codes WHERE organization_id = org_rec.id AND code = '2309' LIMIT 1;

    -- 2. Map items by pharma statutory classification where hsn_id IS NULL
    -- Medical & surgical appliances / syringes
    UPDATE public.items
    SET hsn_id = v_hsn_9018
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(syringe|needle|cannula|scalpel|catheter|infusion|surgical|transfusion)';

    -- Medicated soaps and skin cleansers
    UPDATE public.items
    SET hsn_id = v_hsn_3401
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(soap|cleans|bath bar|wash)';

    -- Food preparations & nutraceutical supplements
    UPDATE public.items
    SET hsn_id = v_hsn_2106
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(protein|whey|powder|supplement|sachet|energy|glucose|nutra|malt)';

    -- Vaccines, toxoids, antisera
    UPDATE public.items
    SET hsn_id = v_hsn_3002
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(vaccine|toxoid|anti-venom|antivenom|serum|tetanus|rabies|hepatitis)';

    -- Bandages, gauze, surgical dressings
    UPDATE public.items
    SET hsn_id = v_hsn_3005
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(cotton|bandage|gauze|dressing|plaster|tape|crepe)';

    -- Vulcanized rubber / gloves
    UPDATE public.items
    SET hsn_id = v_hsn_4014
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(glove|condom|rubber)';

    -- Diagnostic test kits and reagents
    UPDATE public.items
    SET hsn_id = v_hsn_3822
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(test|strip|cassette|reagent)';

    -- Medicated cosmetic lotions and creams
    UPDATE public.items
    SET hsn_id = v_hsn_3304
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(cream|lotion|sunscreen|moisturiz)';

    -- Veterinary and animal feed supplements
    UPDATE public.items
    SET hsn_id = v_hsn_2309
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL
      AND name ~* '(vet|bolus|cattle|poultry|feed|animal)';

    -- Default fallback for all remaining pharmaceutical items: 3004 (5% GST)
    UPDATE public.items
    SET hsn_id = v_hsn_3004
    WHERE organization_id = org_rec.id
      AND hsn_id IS NULL;

  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_hsn_id ON public.items(hsn_id);
