-- Preserve existing HSN code records and item linkages while replacing
-- legacy imported raw placeholder descriptions with professional and sensible descriptions.

UPDATE public.hsn_codes
SET description = 'General Pharmaceutical Formulations (HSN Not Applicable)'
WHERE code = '*NOT'
  AND (description IS NULL OR description = 'Pharmaceutical HSN *NOT' OR trim(description) = '');

UPDATE public.hsn_codes
SET description = 'Healthcare & Pharmaceutical Formulations (Exempt / Non-GST)'
WHERE code = '*NOT APPLI'
  AND (description IS NULL OR description LIKE '%HSN *NOT APPLI%' OR trim(description) = '');
