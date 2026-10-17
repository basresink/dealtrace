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
  const vijf = await bel.locator('[data-test^="bel-kaart-"]').count()
  expect(vijf).toBeLessThanOrEqual(5)
  if (vijf === 5) {
    await page.getByTestId('bel-top-10').click()
    expect(await bel.locator('[data-test^="bel-kaart-"]').count()).toBeGreaterThanOrEqual(5)
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

test('dagkop: de datum is een link naar de agenda op die dag; Analyse rechtsboven (geen Meer, geen Agenda)', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, `/bezoeken?datum=${maandag}`)
  const kop = page.getByTestId('kop-knoppen')
  await expect(kop.getByTestId('kop-meer')).toHaveCount(0)
  await expect(kop.getByTestId('bz-agenda')).toHaveCount(0)
  await expect(kop.getByTestId('bezoekanalyse-knop')).toHaveText('Analyse')
  const link = page.getByTestId('routelijst').getByTestId('dagblok-datum')
  await expect(link).toHaveAttribute('href', `/agenda?weergave=dag&datum=${maandag}`)
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/agenda\\?weergave=dag&datum=${maandag}`))
  await ga(page, '/bezoeken')
  await page.getByTestId('kop-knoppen').getByTestId('bezoekanalyse-knop').click()
  await expect(page).toHaveURL(/\/bezoek-analyse$/)
})

test('bellijst en te plannen bezoeken als kaarten; een klik opent het taakvenster met de link naar de prospect', async ({ page }) => {
  for (const breedte of [1280, 900]) {
    await page.setViewportSize({ width: breedte, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/bezoeken')
    const bel = page.getByTestId('bellijst-naast')
    await expect(bel.locator('a', { hasText: /^Bel$/ })).toHaveCount(0)
    const kaart = bel.locator('[data-test^="bel-kaart-"]').filter({ has: page.locator('button.dp-kaart-titel') }).first()
    await expect(kaart).toBeVisible()
    const box = (await kaart.boundingBox())!
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 8)
    const fo = page.getByTestId('taak-flyout')
    await expect(fo).toBeVisible()
    await expect(fo.getByTestId('tf-account')).toHaveAttribute('href', /\/accounts\//)
    await expect(page).toHaveURL(/\/bezoeken/)
    await page.keyboard.press('Escape')
    await expect(fo).toHaveCount(0)
    const plan = page.getByTestId('te-plannen').locator('[data-test^="plan-kaart-"]').first()
    await expect(plan).toBeVisible()
    await plan.locator('.dp-kaart-titel').click()
    await expect(page.getByTestId('taak-flyout')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
  }
})
