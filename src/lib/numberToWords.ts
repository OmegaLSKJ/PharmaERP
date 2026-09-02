/**
 * Converts a numeric amount into Indian Rupee words format.
 * Example: 1474 -> "Rs. One Thousand Four Hundred and Seventy Four only"
 */
export function numberToWordsIndian(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rs. Zero only'

  const isNegative = amount < 0
  const absAmount = Math.abs(amount)
  
  const rupees = Math.floor(absAmount)
  const paise = Math.round((absAmount - rupees) * 100)

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ]

  function convertTwoDigits(n: number): string {
    if (n < 20) return units[n]
    const ten = Math.floor(n / 10)
    const unit = n % 10
    return `${tens[ten]}${unit > 0 ? ` ${units[unit]}` : ''}`
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100)
    const rem = n % 100
    let str = ''
    if (hundred > 0) {
      str += `${units[hundred]} Hundred`
      if (rem > 0) str += ' and '
    }
    if (rem > 0) {
      str += convertTwoDigits(rem)
    }
    return str
  }

  let words = ''
  
  // Indian numbering: Crores (10,00,00,00), Lakhs (1,00,000), Thousands (1,000), Hundreds
  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const remainder = rupees % 1000

  if (crore > 0) {
    words += `${convertTwoDigits(crore)} Crore `
  }
  if (lakh > 0) {
    words += `${convertTwoDigits(lakh)} Lakh `
  }
  if (thousand > 0) {
    words += `${convertTwoDigits(thousand)} Thousand `
  }
  if (remainder > 0) {
    words += convertThreeDigits(remainder)
  }

  words = words.trim()
  if (!words) words = 'Zero'

  let result = `Rs. ${words}`
  if (paise > 0) {
    result += ` and ${convertTwoDigits(paise)} Paise`
  }
  result += ' only'

  if (isNegative) {
    result = `Minus ${result}`
  }

  return result
}
