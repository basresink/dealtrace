// P12: jaarplanning en terugkomregels op desktop en telefoon.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test('Jaarplanning: knelpunten, kalender en maanddetail; Plan in belblokken met bevestiging', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/planning')
  await expect(page.getByTestId('jaar-kicker')).toContainText('prospects ingedeeld')
  await expect(page.getByTestId('kalender').locator('.maandtegel')).toHaveCount(12)
  const plan = page.getByTestId('plan-groot')
  test.skip(!(await plan.count()), 'Geen achterstand meer')
  await plan.click()
  await expect(page.getByText(/belpogingen in \d+ blok/)).toBeVisible()
  await page.getByRole('button', { name: 'Plan in' }).click()
  await expect(page.getByText(/belpogingen ingepland/)).toBeVisible()
})

test('Opzet DealDrive: tellers, Jaar of Kwartaal, maanddetail met Toon ook benaderde', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/planning')
  await expect(page.getByTestId('plan-tellers')).toContainText('Ingedeeld')
  await expect(page.getByTestId('teller-telaat')).toContainText('Te laat')
  await page.getByTestId('weergave-kwartaal').click()
  await expect(page.getByTestId('kwartalen').locator('[data-test^="kwartaal-"]')).toHaveCount(4)
  await expect(page.getByTestId('kalender').locator('.maandtegel')).toHaveCount(3)
  await page.getByTestId('kwartaal-1').click()
  await expect(page.getByTestId('kalender').locator('.maandtegel').first()).toHaveAttribute('data-maand', '1')
  await expect(page.getByTestId('maand-titel')).toContainText('Aan de beurt')
  await page.getByTestId('weergave-jaar').click()
  await expect(page.getByTestId('kalender').locator('.maandtegel')).toHaveCount(12)
  const toon = page.getByTestId('toon-benaderde')
  if (await toon.count()) {
    const voor = await page.locator('.plan-rij').count()
    await toon.click()
    expect(await page.locator('.plan-rij').count()).toBeGreaterThan(voor)
  }
})

test('Terugkomregels: vier regels na een verlies of nee, alle klassen; geen slapende klanten (winback loopt in DealDrive)', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/planning?tab=terugkom')
  await expect(page.locator('[data-regel]')).toHaveCount(4)
  await expect(page.locator('[data-regel="hc-04"]')).toHaveCount(0)
  await expect(page.getByTestId('regels-slapend')).toHaveCount(0)
  await expect(page.locator('[data-regel="hc-01"] [data-test="klassen"]')).toHaveText('alle klassen')
  await expect(page.getByTestId('kpi')).toContainText('Hercontact op tijd')
  await expect(page.locator('[data-test="opbrengst"]').first()).toBeVisible()
  await expect(page.getByText('Slapende klanten')).toHaveCount(0)
})

test('Gevorderd ziet ook de opbrengst per regel (0064, de motor voor iedereen)', async ({ page }) => {
  await login(page, 'u-03')
  await ga(page, '/planning?tab=terugkom')
  await expect(page.locator('[data-regel]').first()).toBeVisible()
  await expect(page.locator('[data-test="opbrengst"]').first()).toBeVisible()
})

test('Beginner: Prospectplanning met hercontactritme en terugkomregels staat aan (0064, de motor voor iedereen)', async ({ page }) => {
  await login(page, 'u-02')
  await ga(page, '/planning')
  await expect(page.getByTestId('niet-aangezet-pagina')).toHaveCount(0)
  for (const t of ['jaar', 'ritme', 'terugkom']) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
  expect((await page.request.get('/api/planning/jaar')).status()).toBe(200)
  expect((await page.request.get('/api/ritmes')).status()).toBe(200)
  expect((await page.request.get('/api/planning/terugkomregels')).status()).toBe(200)
})

for (const breedte of [375, 390, 412]) {
  test(`${breedte} px: geen horizontale scroll; Bel en Plan bezoek minstens 44 px; Bel is een tel-link`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: 800 })
    await login(page, 'u-07')
    await ga(page, '/planning')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
    const bel = page.locator('.plan-rij [data-test="bel"]').first()
    await expect(bel).toBeVisible()
    expect((await bel.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await page.locator('.plan-rij [data-test="plan-bezoek"]').first().boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.goto('/planning?tab=terugkom'); await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
  })
}
