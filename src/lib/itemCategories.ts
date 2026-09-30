export const STANDARD_ITEM_CATEGORIES = [
  'All Categories',
  'Antibiotics',
  'Analgesics & Pain Relief',
  'Gastrointestinal & Antacids',
  'Respiratory & Cough',
  'Antidiabetic',
  'Cardiovascular & BP',
  'Antiallergic & Steroids',
  'Vitamins & Supplements',
  'Topical & Dermatology',
  'Injectables & Infusions',
  'Neurology & CNS',
  'Surgical & Medical Devices',
  'General Medicine'
] as const

export type StandardItemCategory = typeof STANDARD_ITEM_CATEGORIES[number]

/**
 * Resolves a pharmaceutical category from item name, salt composition, or existing raw category.
 */
export function resolveItemCategory(name?: string | null, saltName?: string | null, rawCategory?: string | null): string {
  if (
    rawCategory &&
    rawCategory.trim() &&
    rawCategory.trim().toLowerCase() !== 'medicine' &&
    rawCategory.trim().toLowerCase() !== 'general' &&
    rawCategory.trim().toLowerCase() !== 'all'
  ) {
    return rawCategory.trim()
  }

  const text = `${name || ''} ${saltName || ''}`.toLowerCase()

  if (text.match(/\b(syringe|needle|cannula|scalpel|surgical|infusion set|catheter|bandage|gauze|cotton|dressing|plaster|crepe|glove|iv set|tubing)/i)) {
    return 'Surgical & Medical Devices'
  }
  if (text.match(/\b(inj|injection|infusion|iv\b|ampoule|vial)/i)) {
    return 'Injectables & Infusions'
  }
  if (text.match(/\b(cream|oint|ointment|lotion|\bgels?\b|dusting|liniment|emulgel|sunscreen|shampoo|derma|scab|antifungal cream|permethrin)/i)) {
    return 'Topical & Dermatology'
  }
  if (text.match(/\b(amox|azithro|cipro|cefix|clavam|augment|clav|oflox|metronid|doxy|cefpodox|levoflox|ampicil|gentamic|meropen|piperacil|tazobact|ceftriax|erythro|clarithro|antibiotic|antibacterial|bact|cef|penicil|colistin|linezolid|faropen)/i)) {
    return 'Antibiotics'
  }
  if (text.match(/\b(para|paracetamol|aceclo|diclo|ibuprofen|tramadol|spas|combiflam|mefenamic|nimesulide|aspirin|ketorol|piroxicam|etoricoxib|analgesic|pain|naproxen|lornoxicam|thiocolchicoside|calpol)/i)) {
    return 'Analgesics & Pain Relief'
  }
  if (text.match(/\b(panto|pantoprazole|omep|omeprazole|rabe|rabeprazole|raniti|ranitidine|gelusil|digene|antacid|domperid|domperidone|sucralfate|esomeprazole|lansoprazole|ondansetron|gastro|digest|lactulose|cremaffin|polyethylene glycol|bisacodyl)/i)) {
    return 'Gastrointestinal & Antacids'
  }
  if (text.match(/\b(cough|kof|ambrox|dextro|phenyleph|ascoril|glycodin|solvin|cheston|benadryl|montelukast|salbutamol|deriphyllin|levosalbutamol|budesonide|respiratory|cold|chest|inhaler|resp|rotacap)/i)) {
    return 'Respiratory & Cough'
  }
  if (text.match(/\b(metformin|glimep|gliclaz|vilda|sitaglip|teneli|dapa|empaglif|insulin|voglibose|pioglitazone|diabet|glipizide|linagliptin)/i)) {
    return 'Antidiabetic'
  }
  if (text.match(/\b(telmi|amlo|aten|atorva|rosuva|losar|clopid|enalapril|ramipril|metoprolol|nebivolol|cilnidipine|cardio|blood pressure|hypertens|statin|diltiazem|carvedilol|propranolol|nitroglycerin|digoxin|spironolactone)/i)) {
    return 'Cardiovascular & BP'
  }
  if (text.match(/\b(cetiri|levocet|fexo|dexa|prednis|betameth|defcort|hydroxyzine|chlorpheniramine|antiallerg|allergy|histamin|steroid|triamcinolone|methylprednisolone|loratadine|bilastine)/i)) {
    return 'Antiallergic & Steroids'
  }
  if (text.match(/\b(gabapentin|pregabalin|levetiracetam|citicoline|piracetam|clonazepam|alprazolam|escitalopram|sertraline|duloxetine|amitriptyline|olanzapine|cns|neuro)/i)) {
    return 'Neurology & CNS'
  }
  if (text.match(/\b(vit|zinc|calc|b-complex|multivit|folic|iron|protein|tonic|becosule|d3|cholecalciferol|shelcal|supradyn|a to z|supplement|ferrous|folvite|cyanocobalamin|methylcobalamin|neurobion|zincovit)/i)) {
    return 'Vitamins & Supplements'
  }

  return 'General Medicine'
}

