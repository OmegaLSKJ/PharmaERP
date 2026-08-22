import { chromium } from 'playwright'

const url = 'http://localhost:4173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(url, { waitUntil: 'networkidle' })

// Loader should disappear and app--ready appear within ~4s
await page.waitForSelector('.app.app--ready', { timeout: 8000 }).catch(() => {})

const ready = await page.$('.app.app--ready') !== null
const loaderGone = await page.$('.loader:not(.loader--hidden)') === null
const lineTransform = await page.$eval('.hero__line-inner', (el) => getComputedStyle(el).transform).catch(() => 'n/a')
const ctaOpacity = await page.$eval('.hero__cta', (el) => getComputedStyle(el).opacity).catch(() => 'n/a')
const navOpacity = await page.$eval('.nav', (el) => getComputedStyle(el).opacity).catch(() => 'n/a')

console.log(JSON.stringify({ ready, loaderGone, lineTransform, ctaOpacity, navOpacity, errors }, null, 2))
await browser.close()
