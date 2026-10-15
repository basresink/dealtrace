// P27: inloggen met een code per mail (mock), TOTP voor de founder, eenmalige codes, limiet,
// toestellen en uitloggen op alle toestellen. Geen wachtwoorden.
import { expect, test } from '@playwright/test'
import { totpCode } from '../../server/utils/totp'

const code = async (request: any, email: string) => (await (await request.get(`/api/auth/testcode?email=${encodeURIComponent(email)}`)).json()).code as string

test('accountmanager logt in met een code van zes cijfers en landt op Vandaag', async ({ page }) => {
  await page.goto('/login'); await page.waitForLoadState('networkidle')
  await page.getByTestId('email').fill('lieke@voltvast.test')
  await page.getByTestId('stuur-code').click()
  await expect(page.getByTestId('bevestiging')).toHaveText('Als dit adres bij Dealtrace hoort, staat er een code in je mail.')
  await expect(page.getByTestId('code')).toHaveAttribute('autocomplete', 'one-time-code')
  await expect(page.getByTestId('code')).toHaveAttribute('inputmode', 'numeric')
  await page.getByTestId('code').fill(await code(page.request, 'lieke@voltvast.test'))
  await page.waitForURL((u) => u.pathname === '/')
  await expect(page.locator('input[type=password]')).toHaveCount(0)
})

test('een verkeerde code geeft de generieke fout; een gebruikte code werkt geen tweede keer', async ({ request }) => {
  await request.post('/api/auth/code', { data: { email: 'lieke@voltvast.test' } })
  const c = await code(request, 'lieke@voltvast.test')
  const fout = c === '000000' ? '111111' : '000000'
  const r1 = await request.post('/api/auth/verifieer', { data: { email: 'lieke@voltvast.test', code: fout } })
  expect(r1.status()).toBe(401)
  expect((await r1.json()).statusMessage).toBe('Deze code klopt niet of is verlopen. Vraag een nieuwe code aan.')
  expect((await request.post('/api/auth/verifieer', { data: { email: 'lieke@voltvast.test', code: c } })).status()).toBe(200)
  expect((await request.post('/api/auth/verifieer', { data: { email: 'lieke@voltvast.test', code: c } })).status()).toBe(401)
})

test('onbekend adres krijgt dezelfde bevestiging; de zesde aanvraag binnen een uur geeft 429', async ({ request }) => {
  const adres = `onbekend-${Date.now()}@voorbeeld.test`
  for (let i = 0; i < 5; i++) {
    const r = await request.post('/api/auth/code', { data: { email: adres } })
    expect(r.status()).toBe(202)
    expect((await r.json()).tekst).toBe('Als dit adres bij Dealtrace hoort, staat er een code in je mail.')
  }
  const zes = await request.post('/api/auth/code', { data: { email: adres } })
  expect(zes.status()).toBe(429)
  expect((await zes.json()).statusMessage).toBe('Je hebt te vaak een code aangevraagd. Probeer het over een uur opnieuw.')
})

test('de founder komt zonder TOTP niet verder; met de code uit de authenticator wel', async ({ page }) => {
  await page.goto('/login'); await page.waitForLoadState('networkidle')
  await page.getByTestId('email').fill('founder@dealtrace.test')
  await page.getByTestId('stuur-code').click()
  await page.getByTestId('code').fill(await code(page.request, 'founder@dealtrace.test'))
  await expect(page.getByTestId('stap-totp')).toBeVisible()
  expect((await page.request.get('/api/me')).status()).toBe(401)
  await page.getByTestId('totp').fill(totpCode('JBSWY3DPEHPK3PXP'))
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
  expect((await page.request.get('/api/platform/klanten')).status()).toBe(200)
})

test('Mijn instellingen: toestellen en "Uitloggen op alle toestellen" maakt elke sessie ongeldig', async ({ browser }) => {
  const a = await browser.newContext()
  const b = await browser.newContext()
  // Twee toestellen van dezelfde gebruiker (hier via de ontwikkelinlog, om de codelimiet niet te raken).
  for (const c of [a, b]) expect((await c.request.post('/api/sessie/ontwikkel', { data: { gebruikerId: 'u-t2' } })).status()).toBe(200)
  const p = await a.newPage()
  await p.goto('/mij'); await p.waitForLoadState('networkidle')
  await expect(p.getByTestId('toestellen')).toContainText('dit toestel')
  await p.getByTestId('uit-alle').click()
  await p.getByTestId('bevestig').click()
  await p.waitForURL((u) => u.pathname.startsWith('/login'))
  expect((await b.request.get('/api/me')).status()).toBe(401)
  await a.close(); await b.close()
})

test('op de laptop de zijbalk; op 820 px de icoonstrook; geen onderbalk', async ({ page }) => {
  await page.goto('/login'); await page.waitForLoadState('networkidle')
  await page.click('[data-test=login-u-03]')
  await page.waitForURL((u) => u.pathname === '/')
  await expect(page.locator('.app-sidebar')).toBeVisible()
  await expect(page.getByTestId('onderbalk')).toBeHidden()
  await page.setViewportSize({ width: 820, height: 1100 })
  await expect.poll(async () => (await page.locator('.app-sidebar').boundingBox())!.width).toBe(64)
  await expect(page.getByTestId('onderbalk')).toBeHidden()
})
