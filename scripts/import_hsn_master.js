import fs from 'node:fs'
import path from 'node:path'

const HSN_DESCRIPTIONS = {
  '3004': 'Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses',
  '30049011': 'Formulations of Paracetamol',
  '30041010': 'Penicillins / Amoxicillin formulations',
  '30049031': 'Anti-bacterial / Antibiotic formulations',
  '30049072': 'Anthelmintics and Anti-parasitic preparations',
  '30049099': 'Other pharmaceutical medicaments and formulations',
  '30042019': 'Cephalosporins and other antibiotic preparations',
  '2106': 'Food preparations / Nutraceuticals and Dietary supplements',
  '21069099': 'Nutritional protein and vitamin dietary supplements',
  '3005': 'Wadding, gauze, bandages and surgical dressings',
  '3006': 'Pharmaceutical goods (sterile surgical catgut, dental cements, first-aid kits)',
  '3401': 'Medicated soaps, organic surface-active products and preparations for washing the skin',
  '4014': 'Hygienic or pharmaceutical articles of vulcanized rubber',
  '3002': 'Human blood, animal blood prepared for therapeutic uses, antisera, vaccines',
  '3003': 'Medicaments of two or more constituents mixed together for therapeutic uses (bulk)',
  '3304': 'Beauty or make-up preparations and preparations for the care of the skin',
  '3306': 'Preparations for oral or dental hygiene, including dentifrices',
  '9018': 'Instruments and appliances used in medical, surgical, dental or veterinary sciences',
  '9025': 'Hydrometers, thermometers, pyrometers, barometers and hygrometers'
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function run() {
  const hsnExtractedPath = 'C:/Users/SCL/.gemini/antigravity-ide/brain/40ea9821-cf2b-4309-880a-5805ecc066d0/scratch/hsn_extracted.json'
  const mockStockPath = path.resolve('apps/web/lib/mock-stock-data.json')

  console.log('Reading extracted HSN data...')
  const rawHsn = fs.readFileSync(hsnExtractedPath, 'utf8').replace(/^\uFEFF/, '')
  const hsnRows = JSON.parse(rawHsn)

  console.log('Reading current mock-stock-data.json...')
  const stockData = JSON.parse(fs.readFileSync(mockStockPath, 'utf8'))

  // 1. Build lookup from HSN Rows
  const hsnLookup = new Map()
  const uniqueHsns = new Map()

  for (const row of hsnRows) {
    if (!row.rawItem) continue
    const norm = normalize(row.rawItem)
    const code = (row.hsnCode || '').trim()
    const gstRate = Number(row.gstRate) || 12

    if (!hsnLookup.has(norm)) {
      hsnLookup.set(norm, {
        rawItem: row.rawItem,
        hsnCode: code || '3004',
        gstRate
      })
    }

    if (code && code !== 'HSN/SAC' && !code.includes('*')) {
      if (!uniqueHsns.has(code)) {
        uniqueHsns.set(code, {
          code,
          description: HSN_DESCRIPTIONS[code] || `Pharmaceutical / Healthcare preparation (HSN ${code})`,
          gst_rate: gstRate,
          type: 'Goods'
        })
      }
    }
  }

  // Ensure baseline standard HSN codes
  for (const [code, desc] of Object.entries(HSN_DESCRIPTIONS)) {
    if (!uniqueHsns.has(code)) {
      uniqueHsns.set(code, {
        code,
        description: desc,
        gst_rate: code === '2106' || code === '3401' ? 18 : 12,
        type: 'Goods'
      })
    }
  }

  // 2. Update stockData.items
  let matchedCount = 0
  for (const item of stockData.items) {
    const norm = normalize(item.name)
    const matched = hsnLookup.get(norm)
    if (matched) {
      item.hsn = matched.hsnCode || '3004'
      item.gstRate = matched.gstRate || 12
      matchedCount++
    } else {
      item.hsn = '3004'
      item.gstRate = 12
    }
  }

  console.log(`Matched and updated HSN & GST rates on ${matchedCount} / ${stockData.items.length} stock items.`)

  // 3. Populate HSN Master list
  const hsnMasterList = Array.from(uniqueHsns.values()).map((h, idx) => ({
    id: `h-${idx + 1}`,
    code: h.code,
    description: h.description,
    gst_rate: h.gst_rate,
    type: 'Goods'
  }))

  stockData.hsn = hsnMasterList
  console.log(`Generated ${hsnMasterList.length} unique HSN Master entries.`)

  // 4. Save updated mock-stock-data.json
  fs.writeFileSync(mockStockPath, JSON.stringify(stockData, null, 2), 'utf8')
  console.log(`Saved updated data to ${mockStockPath}`)

  // 5. Also create a copy in lib/mock-stock-data.json if needed
  const localMockPath = path.resolve('lib/mock-stock-data.json')
  fs.mkdirSync(path.dirname(localMockPath), { recursive: true })
  fs.writeFileSync(localMockPath, JSON.stringify(stockData, null, 2), 'utf8')
  console.log(`Saved backup copy to ${localMockPath}`)
}

run()
