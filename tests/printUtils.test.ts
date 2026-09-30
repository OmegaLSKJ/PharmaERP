import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  detectOptimalOrientation,
  applyPrintOrientation,
  clearPrintOrientation,
  smartPrint,
  setupSmartPrint,
} from '../src/lib/printUtils'

// Lightweight in-memory DOM mock for node test runner
class MockElement {
  tagName: string
  id: string = ''
  className: string = ''
  attributes: Record<string, string> = {}
  children: MockElement[] = []
  parentElement: MockElement | null = null
  textContent: string = ''

  classList = {
    add: (...cls: string[]) => {
      const current = this.className.split(/\s+/).filter(Boolean)
      cls.forEach((c) => {
        if (!current.includes(c)) current.push(c)
      })
      this.className = current.join(' ')
    },
    remove: (...cls: string[]) => {
      const current = this.className.split(/\s+/).filter(Boolean)
      this.className = current.filter((c) => !cls.includes(c)).join(' ')
    },
    contains: (c: string) => this.className.split(/\s+/).includes(c),
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  setAttribute(k: string, v: string) {
    this.attributes[k] = v
  }

  getAttribute(k: string) {
    return this.attributes[k] ?? null
  }

  removeAttribute(k: string) {
    delete this.attributes[k]
  }

  appendChild(child: MockElement) {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  closest(selector: string): MockElement | null {
    if (selector.includes('data-print-orientation') && this.getAttribute('data-print-orientation')) {
      return this
    }
    return this.parentElement ? this.parentElement.closest(selector) : null
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] || null
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = []
    const traverse = (node: MockElement) => {
      for (const child of node.children) {
        let match = false
        if (selector === 'table' && child.tagName === 'TABLE') match = true
        if (selector === 'thead tr' && child.tagName === 'TR' && node.tagName === 'THEAD') match = true
        if (selector === 'tr' && child.tagName === 'TR') match = true
        if (selector === 'th, td' && (child.tagName === 'TH' || child.tagName === 'TD')) match = true
        if (selector.includes('data-print-orientation') && child.getAttribute('data-print-orientation')) match = true
        if (selector.includes('data-print-header') && child.getAttribute('data-print-header')) match = true
        if (selector.includes('tax-invoice-bill') && child.classList.contains('tax-invoice-bill')) match = true
        if (selector.includes('goods-receipt-note-print') && child.classList.contains('goods-receipt-note-print')) match = true
        if (selector.includes('print-landscape') && child.classList.contains('print-landscape')) match = true
        if (selector.includes('print-portrait') && child.classList.contains('print-portrait')) match = true

        if (match) results.push(child)
        traverse(child)
      }
    }
    traverse(this)
    return results
  }
}

describe('printUtils', () => {
  let mockHead: MockElement
  let mockBody: MockElement
  let mockHtml: MockElement

  beforeEach(() => {
    mockHead = new MockElement('head')
    mockBody = new MockElement('body')
    mockHtml = new MockElement('html')
    mockHtml.appendChild(mockHead)
    mockHtml.appendChild(mockBody)

    const mockElementsById: Record<string, MockElement> = {}

    const fakeDocument: any = {
      head: mockHead,
      body: mockBody,
      documentElement: mockHtml,
      createElement: (tag: string) => {
        const el = new MockElement(tag)
        return el
      },
      getElementById: (id: string) => mockElementsById[id] || null,
      querySelectorAll: (sel: string) => mockHtml.querySelectorAll(sel),
      querySelector: (sel: string) => mockHtml.querySelector(sel),
    }

    mockHead.appendChild = (child: MockElement) => {
      child.parentElement = mockHead
      mockHead.children.push(child)
      if (child.id) mockElementsById[child.id] = child
      return child
    }

    ;(globalThis as any).document = fakeDocument
    ;(globalThis as any).window = {
      print: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  })

  afterEach(() => {
    clearPrintOrientation()
  })

  describe('detectOptimalOrientation', () => {
    it('chooses portrait for statement of accounts / party ledger', () => {
      const container = new MockElement('div')
      const header = new MockElement('div')
      header.setAttribute('data-print-header', 'true')
      header.textContent = 'STATEMENT OF ACCOUNTS / PARTY LEDGER'
      container.appendChild(header)

      const table = new MockElement('table')
      const thead = new MockElement('thead')
      const tr = new MockElement('tr')

      for (let i = 0; i < 8; i++) {
        const th = new MockElement('th')
        th.textContent = `Col ${i + 1}`
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
      container.appendChild(table)
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('portrait')
    })

    it('chooses landscape for all transactions register (chronological)', () => {
      const container = new MockElement('div')
      const header = new MockElement('div')
      header.setAttribute('data-print-header', 'true')
      header.textContent = 'ALL TRANSACTIONS REGISTER (CHRONOLOGICAL)'
      container.appendChild(header)

      const table = new MockElement('table')
      const thead = new MockElement('thead')
      const tr = new MockElement('tr')

      for (let i = 0; i < 8; i++) {
        const th = new MockElement('th')
        th.textContent = `Col ${i + 1}`
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
      container.appendChild(table)
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('landscape')
    })

    it('chooses landscape for tables with 7 or more columns with company and narration details', () => {
      const container = new MockElement('div')
      const table = new MockElement('table')
      const thead = new MockElement('thead')
      const tr = new MockElement('tr')

      const cols = ['#', 'Date', 'Type', 'Voucher No', 'Company Name', 'Narration', 'Debit', 'Credit']
      cols.forEach((c) => {
        const th = new MockElement('th')
        th.textContent = c
        tr.appendChild(th)
      })
      thead.appendChild(tr)
      table.appendChild(thead)
      container.appendChild(table)
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('landscape')
    })

    it('chooses portrait for compact tables with <= 5 columns', () => {
      const container = new MockElement('div')
      const table = new MockElement('table')
      const thead = new MockElement('thead')
      const tr = new MockElement('tr')

      for (let i = 0; i < 4; i++) {
        const th = new MockElement('th')
        th.textContent = `Col ${i + 1}`
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
      container.appendChild(table)
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('portrait')
    })

    it('chooses landscape for 6 columns containing wide narration and party details', () => {
      const container = new MockElement('div')
      const table = new MockElement('table')
      const thead = new MockElement('thead')
      const tr = new MockElement('tr')

      const cols = ['Date', 'Voucher No', 'Party Name', 'Particulars / Narration', 'Debit', 'Credit']
      cols.forEach((text) => {
        const th = new MockElement('th')
        th.textContent = text
        tr.appendChild(th)
      })
      thead.appendChild(tr)
      table.appendChild(thead)
      container.appendChild(table)
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('landscape')
    })

    it('honors explicit data-print-orientation attribute', () => {
      const container = new MockElement('div')
      container.setAttribute('data-print-orientation', 'landscape')
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('landscape')

      container.setAttribute('data-print-orientation', 'portrait')
      expect(detectOptimalOrientation(container as any)).toBe('portrait')
    })

    it('chooses portrait for tax invoice bill even if columns exist', () => {
      const container = new MockElement('div')
      container.classList.add('tax-invoice-bill')
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('portrait')
    })

    it('chooses portrait for goods receipt note inward bills', () => {
      const container = new MockElement('div')
      container.classList.add('goods-receipt-note-print')
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('portrait')
    })

    it('chooses landscape for elements marked with print-landscape class', () => {
      const container = new MockElement('div')
      container.classList.add('print-landscape')
      mockBody.appendChild(container)

      expect(detectOptimalOrientation(container as any)).toBe('landscape')
    })
  })

  describe('applyPrintOrientation and clearPrintOrientation', () => {
    it('injects dynamic @page rule for landscape into document head', () => {
      applyPrintOrientation('landscape')

      const styleEl = (document as any).getElementById('smart-print-orientation-style')
      expect(styleEl).not.toBeNull()
      expect(styleEl?.textContent).toContain('size: A4 landscape !important')
      expect(styleEl?.textContent).toContain('margin: 8mm !important')
      expect(document.documentElement.getAttribute('data-print-orientation')).toBe('landscape')
      expect(document.body.classList.contains('print-orientation-landscape')).toBe(true)
    })

    it('injects dynamic @page rule for portrait into document head', () => {
      applyPrintOrientation('portrait')

      const styleEl = (document as any).getElementById('smart-print-orientation-style')
      expect(styleEl).not.toBeNull()
      expect(styleEl?.textContent).toContain('size: A4 portrait !important')
      expect(styleEl?.textContent).toContain('margin: 8mm !important')
      expect(document.documentElement.getAttribute('data-print-orientation')).toBe('portrait')
      expect(document.body.classList.contains('print-orientation-portrait')).toBe(true)
    })

    it('resets print orientation on clear', () => {
      applyPrintOrientation('landscape')
      clearPrintOrientation()

      expect(document.documentElement.getAttribute('data-print-orientation')).toBeNull()
      expect(document.body.classList.contains('print-orientation-landscape')).toBe(false)
    })
  })

  describe('smartPrint', () => {
    it('applies optimal orientation and invokes print', () => {
      const container = new MockElement('div')
      container.setAttribute('data-print-orientation', 'landscape')
      mockBody.appendChild(container)

      smartPrint({ target: container as any })

      expect(window.print).toHaveBeenCalled()
      expect(document.documentElement.getAttribute('data-print-orientation')).toBe('landscape')
    })
  })
})
