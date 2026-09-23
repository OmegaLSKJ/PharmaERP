-- The Party Master used retail_wholesale for its single drug licence field.
-- Normalize it so the UI can reliably distinguish drug and food licences.
update public.drug_licenses
set license_type = 'drug_license'
where party_id is not null
  and license_type = 'retail_wholesale';
