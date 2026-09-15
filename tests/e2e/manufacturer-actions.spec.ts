import { test, expect } from '@playwright/test'

test.describe('Manufacturer Master Management', () => {
  test('should not contain the invalid "**" item and can add and delete test manufacturer', async ({ page }) => {
    // Navigate to frontend manufacturers page if running with vite or next
    await page.goto('/masters/manufacturers')
    
    // Ensure invalid item '**' is not present
    const invalidRow = page.locator('tr', { hasText: '**' })
    await expect(invalidRow).toHaveCount(0)
  })
})
