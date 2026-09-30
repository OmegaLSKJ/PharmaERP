-- Preserve the existing manufacturer record and its item relationships while
-- replacing the imported placeholder value with a meaningful master-data name.
update public.manufacturers
set
  name = 'Unassigned Manufacturer',
  code = 'UNASSIGNED',
  is_active = true
where trim(name) = '**';
