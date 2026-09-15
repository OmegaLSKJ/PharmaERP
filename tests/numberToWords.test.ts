import { describe, expect, it } from 'vitest'
import { numberToWordsIndian } from '../src/lib/numberToWords'

describe('numberToWordsIndian', () => {
  it('converts sample purchase invoice total 1474 to words correctly', () => {
    expect(numberToWordsIndian(1474)).toBe('Rs. One Thousand Four Hundred and Seventy Four only')
  })

  it('handles zero, lakhs, and decimals', () => {
    expect(numberToWordsIndian(0)).toBe('Rs. Zero only')
    expect(numberToWordsIndian(100000)).toBe('Rs. One Lakh only')
    expect(numberToWordsIndian(1404.10)).toBe('Rs. One Thousand Four Hundred and Four and Ten Paise only')
  })
})
