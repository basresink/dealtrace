// Signaalradar (F5): raster branche maal signaalsoort met golven uit de fictieve seed (seedSignaalradar),
// wissel Mijn regio en Hele organisatie, detail met accounts, winpunt en capaciteit, geen golf met uitleg,
// Start belronde maakt een campagneconcept en Zet in belblok zet eigen accounts in het volgende belblok.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test('raster met golven, wissel naar de hele organisatie en een cel zonder golf', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/signaalradar')
  await expect(page.locator('h1.title')).toContainText(/golve?n? in jouw markt/)
  await expect(page.getByTestId('sr-mij')).toHaveText('Mijn regio')
  await expect(page.getByTestId('sr-mij')).toHaveAttribute('aria-pressed', 'true')
  const golf = page.getByTestId('sr-cel-br-01-vacatures')
  await expect(golf).toHaveClass(/sr-cel--(golf|sterk)/)
  // Zonder keuze opent de sterkste golf.
  await expect(page.getByTestId('sr-detail-kicker')).toContainText('Golf')
  await golf.click()
  await expect(page).toHaveURL(/cel=br-01%7Cvacatures|cel=br-01\|vacatures/)
  await expect(page.getByTestId('sr-waarom')).toContainText('Een golf begint bij 1,5 keer normaal en 5 accounts')
  expect(await page.getByTestId('sr-accounts').locator('li').count()).toBeGreaterThanOrEqual(5)
  await expect(page.getByTestId('sr-winpunt')).toContainText('Winpunt dat past')
  await expect(page.getByTestId('sr-winpunt')).toContainText('WINPUNTVOOR')
  await expect(page.getByTestId('sr-capaciteit')).toContainText(/belblok/)
  await expect(page.getByTestId('sr-belronde')).toBeEnabled()

  // Geen golf: te weinig accounts, met uitleg en een link naar Inzichten.
  await page.getByTestId('sr-cel-br-01-directiewissel').click()
  await expect(page.getByTestId('sr-waarom')).toContainText('Geen golf')
  await expect(page.getByTestId('sr-waarom')).toContainText('minstens 5 accounts')
  await expect(page.getByTestId('sr-naar-inzichten')).toBeVisible()
  await expect(page.getByTestId('sr-belronde')).toHaveCount(0)

  await page.getByTestId('sr-org').click()
  await expect(page).toHaveURL(/reikwijdte=org/)
  await expect(page.locator('h1.title')).toContainText('in de hele organisatie')
  await expect(page.getByTestId('sr-cel-br-01-nieuwe-vestiging')).toHaveClass(/sr-cel--(golf|sterk)/)
})

test('Start belronde maakt een campagneconcept met de accounts en het winpunt', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/signaalradar?cel=br-02%7Cnieuwbouw-vergunning')
  await expect(page.getByTestId('sr-detail-kicker')).toContainText('Golf')
  await page.getByTestId('sr-belronde').click()
  await expect(page).toHaveURL(/\/campagnes\/[0-9a-f-]{36}/)
  await expect(page.getByTestId('bord-kop')).toContainText('Belronde nieuwbouw of vergunning')
  await expect(page.getByTestId('bord-activeer')).toBeVisible()
})

test('Zet in belblok zet eigen accounts in het volgende belblok (API)', async ({ page }) => {
  await apiLogin(page.request, 'u-07')
  const cel = await (await page.request.get('/api/signaalradar/cel?reikwijdte=mij&branche=br-01&soort=vacatures')).json()
  expect(cel.golf).toBe(true)
  expect(cel.accounts.length).toBeGreaterThanOrEqual(5)
  const r = await page.request.post('/api/signaalradar/belblok', { data: { reikwijdte: 'mij', branche: 'br-01', soort: 'vacatures' } })
  expect(r.ok()).toBe(true)
  const b = await r.json()
  expect(b.inBlok + b.geschoven + b.alIngepland).toBeGreaterThan(0)
  expect(b.toast).toMatch(/belblok/)
  // Geen golf: de server weigert.
  const geen = await page.request.post('/api/signaalradar/belronde', { data: { reikwijdte: 'mij', branche: 'br-01', soort: 'directiewissel' } })
  expect(geen.status()).toBe(409)
})

test('Beginner ziet Signaalradar bij Nog niet aangezet; de API weigert', async ({ page }) => {
  await apiLogin(page.request, 'u-02')
  const r = await page.request.get('/api/signaalradar')
  expect(r.status()).toBe(403)
})

test('telefoon: cellen als knoppen per branche, geen horizontale scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'u-07')
  await ga(page, '/signaalradar')
  await expect(page.getByTestId('sr-raster')).toBeHidden()
  const knop = page.getByTestId('sr-mcel-br-01-vacatures')
  await expect(knop).toBeVisible()
  expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const breed = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(breed).toBeLessThanOrEqual(0)
  await knop.click()
  await expect(page.getByTestId('sr-detail-kicker')).toContainText('Golf')
})
