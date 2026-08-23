import { expect, test } from '@playwright/test'

test('health endpoint is ready and unauthenticated ERP API is protected', async ({ request }) => {
  const health = await request.get('/api/health')
  expect(health.ok()).toBeTruthy()
  const protectedResponse = await request.get('/api/v1/dashboard')
  expect(protectedResponse.status()).toBe(401)
  const userAdmin = await request.get('/api/admin/users')
  expect(userAdmin.status()).toBe(401)
})

test('login is keyboard reachable on desktop and mobile', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /sign in|welcome/i })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
