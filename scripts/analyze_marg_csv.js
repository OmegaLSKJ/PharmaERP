import fs from 'node:fs'
import Papa from 'papaparse'

const raw = fs.readFileSync('C:/Users/SCL/Downloads/Marg.csv', 'utf8').replace(/^\uFEFF/, '')
const parsed = Papa.parse(raw, {
  header: false,
  skipEmptyLines: true
})

const reportHeader = parsed.data[0][0]
const asOnDate = parsed.data[1][0]
const colHeaders = parsed.data[2]
const dataRows = parsed.data.slice(4)

console.log('--- MARG.CSV ANALYSIS ---')
console.log('Report Header:', reportHeader)
console.log('As On Date:', asOnDate)
console.log('Total Batches/Rows:', dataRows.length)

const itemsMap = new Map()
const companies = new Set()
const suppliers = new Set()
let totalStock = 0
let totalValuation = 0
let zeroStockCount = 0
let expiredCount = 0

const now = new Date('2026-07-03')

for (const row of dataRows) {
  const code = (row[0] || '').trim()
  const name = (row[1] || '').trim()
  const unit = (row[2] || '').trim()
  const stock = parseFloat(row[3]) || 0
  const costPrice = parseFloat(row[8]) || 0
  const value = parseFloat(String(row[9] || '').replace(/,/g, '')) || (stock * costPrice)
  const mrp = parseFloat(row[10]) || 0
  const purchasePrice = parseFloat(row[11]) || 0
  const salesPrice = parseFloat(row[12]) || 0
  const company = (row[13] || '').trim()
  const batch = (row[16] || '').trim()
  const exp = (row[18] || '').trim()
  const supplier = (row[19] || '').trim()

  if (!name && !code) continue

  totalStock += stock
  totalValuation += value
  if (stock <= 0) zeroStockCount++

  if (company) companies.add(company)
  if (supplier) suppliers.add(supplier)

  const key = `${code}__${name}`
  if (!itemsMap.has(key)) {
    itemsMap.set(key, {
      code,
      name,
      unit,
      company,
      mrp,
      salesPrice,
      purchasePrice,
      totalItemStock: 0,
      totalItemValue: 0,
      batches: []
    })
  }

  const itm = itemsMap.get(key)
  itm.totalItemStock += stock
  itm.totalItemValue += value
  itm.batches.push({ batch, exp, stock, mrp, costPrice, value, supplier })
}

console.log('Unique Products:', itemsMap.size)
console.log('Unique Companies/Manufacturers:', companies.size)
console.log('Unique Suppliers:', suppliers.size)
console.log('Total Stock Units:', totalStock.toLocaleString('en-IN'))
console.log('Total Stock Valuation: ₹', totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 }))
console.log('Zero/Negative Stock Batches:', zeroStockCount)

console.log('\nTop 15 Products by Stock Quantity:')
const sortedByStock = Array.from(itemsMap.values()).sort((a, b) => b.totalItemStock - a.totalItemStock)
sortedByStock.slice(0, 15).forEach((item, idx) => {
  console.log(
    `${idx + 1}. [Code: ${item.code}] ${item.name} | Mfg: ${item.company} | Stock: ${item.totalItemStock} ${item.unit} | Value: ₹${item.totalItemValue.toFixed(2)} | MRP: ₹${item.mrp} | Batches: ${item.batches.length}`
  )
})

console.log('\nTop 10 Manufacturers by Total Stock Value:')
const mfgMap = new Map()
for (const item of itemsMap.values()) {
  const m = item.company || 'Unknown'
  mfgMap.set(m, (mfgMap.get(m) || 0) + item.totalItemValue)
}
const sortedMfg = Array.from(mfgMap.entries()).sort((a, b) => b[1] - a[1])
sortedMfg.slice(0, 10).forEach(([mfg, val], idx) => {
  console.log(`${idx + 1}. ${mfg}: ₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
})
