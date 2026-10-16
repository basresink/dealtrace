import { expect, test } from '@playwright/test'
import { login } from './hulp'

test.describe('zijbalk per niveau', () => {
  test('Beginner buitendienst: 11 items en Bezoeken voor Belblokken', async ({ page }) => {
    await login(page, 'u-02')
    const items = page.locator('.sb-nav .sb-groep:not(.sb-slotgroep) .sb-link')
    await expect(items).toHaveCount(11)
    const sleutels = await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-sleutel')))
    expect(sleutels.indexOf('nav.bezoeken')).toBeLessThan(sleutels.indexOf('nav.belblokken'))
    await expect(page.locator('.sb-slotgroep-teller')).toHaveText('4')
    await expect(page.getByTestId('gebruikersblok')).toHaveText('ACCOUNTMANAGER · BEGINNER')
  })

  test('Nog niet aangezet opent de uitlegflyout', async ({ page }) => {
    await login(page, 'u-02')
    await page.click('.sb-slotgroep-kop')
    // aria-disabled: Playwright ziet het item als uitgeschakeld, maar een klik opent bewust de uitleg.
    await page.click('.sb-link--slot[data-sleutel="nav.leadgenerator"]', { force: true })
    const flyout = page.getByTestId('niet-aangezet-flyout')
    await expect(flyout).toBeVisible()
    await expect(flyout).toContainText('Gevorderd · nog niet aangezet')
    await expect(flyout).toContainText('Wat het doet')
    await expect(flyout).toContainText('Tot die tijd')
    await page.keyboard.press('Escape')
    await expect(flyout).toBeHidden()
  })

  test('directe link naar een functie die nog niet aanstaat toont de uitleg', async ({ page }) => {
    await login(page, 'u-02')
    await page.goto('/leadgenerator')
    await expect(page.getByText('nog niet aangezet', { exact: false }).first()).toBeVisible()
  })

  test('beheerder ziet de managergroep en de instellingen', async ({ page }) => {
    await login(page, 'u-06')
    await expect(page.locator('.sb-link[data-sleutel="nav.instellingen"]')).toBeVisible()
    await page.goto('/instellingen/gebruikers')
    await expect(page.getByTestId('gebruikers-tabel')).toBeVisible()
  })

  test('accountmanager krijgt geen toegang tot instellingen', async ({ page }) => {
    await login(page, 'u-02')
    await page.goto('/instellingen')
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
  })

  test('founder zonder organisatie komt op Platformbeheer', async ({ page }) => {
    await login(page, 'u-founder')
    await expect(page).toHaveURL(/\/platform\/klanten$/)
    // P24: alle platformschermen in de groep Beheer.
    await expect(page.locator('.sb-nav .sb-link')).toHaveCount(11)
  })
})
