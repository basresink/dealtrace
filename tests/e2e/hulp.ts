import type { APIRequestContext, Page } from '@playwright/test'

export async function login(page: Page, id: string) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.click(`[data-test=login-${id}]`)
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
  await page.waitForLoadState('networkidle')
}

export async function apiLogin(request: APIRequestContext, id: string) {
  const r = await request.post('/api/sessie/ontwikkel', { data: { gebruikerId: id } })
  if (!r.ok()) throw new Error(`login ${id} mislukt: ${r.status()}`)
}
