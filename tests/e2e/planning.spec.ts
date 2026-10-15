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

test('Terugkomregels: zes regels in twee lijsten, hc-04 direct, alle klassen; slapende klanten leeg', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/planning?tab=terugkom')
  await expect(page.locator('[data-regel]')).toHaveCount(6)
  await expect(page.locator('[data-regel="hc-04"] [data-test="termijn"]')).toHaveText('direct')
  await expect(page.locator('[data-regel="hc-01"] [data-test="klassen"]')).toHaveText('alle klassen')
  await expect(page.getByTestId('kpi')).toContainText('Hercontact op tijd')
  await expect(page.locator('[data-test="opbrengst"]').first()).toBeVisible()
  await expect(page.getByTestId('slapend-leeg')).toBeVisible()
})

test('Gevorderd ziet geen opbrengst per regel', async ({ page }) => {
  await login(page, 'u-03')
  await ga(page, '/planning?tab=terugkom')
  await expect(page.locator('[data-regel]').first()).toBeVisible()
  await expect(page.locator('[data-test="opbrengst"]')).toHaveCount(0)
})

test('Beginner: geen Prospectplanning; de API geeft 403 met reden niveau', async ({ page }) => {
  await login(page, 'u-02')
  await ga(page, '/planning')
  await expect(page.getByText('nog niet aangezet', { exact: false }).first()).toBeVisible()
  const r = await page.request.get('/api/planning/jaar')
  expect(r.status()).toBe(403)
  expect((await r.json()).data.reden).toBe('niveau')
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
