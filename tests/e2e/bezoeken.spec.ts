// Bezoeken in de opzet van DealDrive: kop met werkbalk, je week met regiodagen, kaart en routelijst
// per dag, kansen langs de route, bellijst (Top 5 of 10), te plannen bezoeken en ?datum= als deep link.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

const nl = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const vandaag = nl(new Date())
const maandag = plus(vandaag, -((new Date(`${vandaag}T12:00:00Z`).getUTCDay() + 6) % 7))

test.describe.configure({ mode: 'serial' })

test('Dag: kop, week met regiodagen, kaart, routelijst, statistiek, kansen, bellijst en te plannen', async ({ page }) => {
  await login(page, 'u-05')
  await ga(page, '/bezoeken')
  await expect(page.locator('h1.title')).toContainText(/bezoek|Geen bezoeken/)
  await expect(page.getByTestId('plus-bezoek')).toBeVisible()
  await expect(page.getByTestId('bz-week').locator('[data-test^="week-dag-"]')).toHaveCount(5)
  await expect(page.getByTestId('kaart')).toBeVisible()
  await expect(page.getByTestId('routelijst').locator('[data-test^="routedag-"]')).toHaveCount(1)
  await expect(page.getByTestId('dagstat')).toContainText('Contactmomenten')
  await expect(page.getByTestId('kansen')).toContainText('Kansen langs de route')
  await expect(page.getByTestId('te-plannen')).toContainText('Te plannen bezoeken')
  const bel = page.getByTestId('bellijst-naast')
  const vijf = await bel.locator('.bz-bel-rij').count()
  expect(vijf).toBeLessThanOrEqual(5)
  if (vijf === 5) {
    await page.getByTestId('bel-top-10').click()
    expect(await bel.locator('.bz-bel-rij').count()).toBeGreaterThanOrEqual(5)
  }
})

test('?datum= opent die dag; Hele week toont een blok per dag met bezoeken', async ({ page }) => {
  await login(page, 'u-05')
  await ga(page, `/bezoeken?datum=${maandag}`)
  await expect(page.getByTestId(`week-dag-${maandag}`)).toHaveClass(/bz-dag--aan/)
  await expect(page.getByTestId('routelijst').locator(`[data-test="routedag-${maandag}"]`)).toBeVisible()
  await page.getByTestId('weergave-week').click()
  await expect(page).toHaveURL(/weergave=week/)
  await expect(page.getByTestId('weergave-week')).toHaveClass(/bz-dag--aan/)
  await expect(page.locator('h1.title')).toContainText(/bezoek|Geen bezoeken/)
})

test('Filters: periode Morgen zet de datum in de URL; de kansfilters staan in hetzelfde paneel', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/bezoeken')
  await page.getByTestId('bz-filters').click()
  await expect(page.getByTestId('bz-filterpaneel')).toBeVisible()
  await page.getByTestId('periode-morgen').click()
  await expect(page).toHaveURL(new RegExp(`datum=${plus(vandaag, 1)}`))
  await expect(page.getByTestId('periode-morgen')).toHaveClass(/filter-pil--aan/)
  await page.getByTestId('periode-deze-week').click()
  await expect(page).toHaveURL(/weergave=week/)
})
