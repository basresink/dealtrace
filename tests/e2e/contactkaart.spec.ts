// Contactkaart in de opzet van DealDrive: kop, statstrook en dezelfde tabbladen als de accountkaart, met
// alleen wat bij het contact hoort. Op de accountkaart staat bij elk item de naam van het contact met een link.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

const TABS = ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'campagnes', 'documenten', 'kwalificatie']

test.describe('contactkaart', () => {
  test('kop, statstrook en dezelfde tabbladen als de accountkaart', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/contacten/ct-07')
    await expect(page.getByTestId('contact-naam')).toContainText('Wietse Testsma')
    await expect(page.getByTestId('contact-account')).toHaveAttribute('href', '/accounts/pr-06')
    await expect(page.getByTestId('contact-rol')).toBeVisible()
    await expect(page.getByTestId('contactgegevens')).toContainText('@')
    await expect(page.getByTestId('statstrook')).toContainText('Open acties')
    const labels = async () => page.locator('[data-test^=tab-]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-test')}:${e.childNodes[0]?.textContent}`))
    for (const t of TABS) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
    const opContact = await labels()
    await ga(page, '/accounts/pr-06')
    expect(await labels()).toEqual(opContact)

    // De tijdlijn van het contact: alleen momenten van dit contact, zonder contactlink.
    await ga(page, '/contacten/ct-07')
    await expect(page.getByTestId('tijdlijn')).toBeVisible()
    await expect(page.getByTestId('tl-contact')).toHaveCount(0)
    await page.getByTestId('tab-kwalificatie').click()
    await expect(page).toHaveURL(/tab=kwalificatie/)
    await expect(page.getByTestId('naar-accountkaart')).toHaveAttribute('href', '/accounts/pr-06?tab=kwalificatie')
    // Deals en Eigen velden hebben geen tabblad meer; eigen velden staan in het Info-venster.
    await expect(page.getByTestId('tab-deals')).toHaveCount(0)
    await expect(page.getByTestId('tab-eigenvelden')).toHaveCount(0)
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('contact-info-knop').click()
    await expect(page.getByTestId('contact-info-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('kop: Briefing, Volgen en Invloed op één regel op 1280; op 390 hulp, Volgen, Invloed en Meer', async ({ page }) => {
    await login(page, 'u-01')
    await page.setViewportSize({ width: 1280, height: 900 })
    await ga(page, '/contacten/ct-07')
    const acties = page.locator('.ck-acties')
    for (const id of ['briefing-knop', 'knop-volgen', 'knop-invloed']) await expect(acties.getByTestId(id)).toBeVisible()
    const ids = await acties.locator('[data-test]').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    expect(ids.indexOf('knop-invloed')).toBe(ids.indexOf('knop-volgen') + 1)
    const tops = await page.locator('.ck-acties > button, .ck-acties > div').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    await page.getByTestId('kop-meer').click()
    await expect(page.getByTestId('kop-meer-menu').getByTestId('contact-info-knop')).toBeVisible()
    await expect(page.getByTestId('kop-meer-menu').getByTestId('bel-knop')).toHaveAttribute('href', /^tel:/)
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 390, height: 844 })
    await ga(page, '/contacten/ct-07')
    await expect(page.getByTestId('knop-invloed')).toBeVisible()
    const rij = await page.locator('.ck-acties > button, .ck-acties > div, .ck-acties .kop-iconen > button').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(rij).size).toBe(1)
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('kop-meer-menu').getByTestId('briefing-knop').click()
    await expect(page.getByTestId('briefing-flyout')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('een notitie op de contactkaart staat op de accountkaart met de naam van het contact', async ({ page }) => {
    await login(page, 'u-01')
    const tekst = `Testnotitie contact ${Date.now() % 100000}`
    await ga(page, '/contacten/ct-07?tab=notities')
    await page.getByTestId('notitie').fill(tekst)
    await page.getByTestId('notitie-bewaar').click()
    await expect(page.locator('.tl-tekst', { hasText: tekst })).toBeVisible()

    const api = await (await page.request.get('/api/contacten/ct-07/tabbladen')).json()
    expect(api.momenten.length).toBeGreaterThan(0)
    expect(api.momenten.every((m: any) => m.contactId === 'ct-07')).toBe(true)

    await ga(page, '/accounts/pr-06?tab=notities')
    const kaart = page.locator('.tl-kaart', { hasText: tekst })
    await expect(kaart.getByTestId('tl-contact')).toHaveText('Wietse Testsma')
  })

  test('de tijdlijn van het account toont de contactnaam met een link naar de contactkaart', async ({ page }) => {
    await login(page, 'u-01')
    const api = await (await page.request.get('/api/accounts/pr-06/tabbladen')).json()
    const metContact = api.momenten.filter((m: any) => m.contactId)
    expect(metContact.length).toBeGreaterThan(0)
    expect(metContact.every((m: any) => typeof m.contactNaam === 'string' && m.contactNaam.length)).toBe(true)
    for (const soort of ['taken', 'afspraken', 'mails', 'verslagen', 'inzichten']) expect(api[soort].every((x: any) => 'contactId' in x && 'contactNaam' in x)).toBe(true)

    await ga(page, '/accounts/pr-06')
    const link = page.getByTestId('tijdlijn').getByTestId('tl-contact').filter({ hasText: 'Wietse Testsma' }).first()
    await expect(link).toHaveAttribute('href', '/contacten/ct-07')
    await link.click()
    await expect(page).toHaveURL(/\/contacten\/ct-07/)
    await expect(page.getByTestId('contact-naam')).toContainText('Wietse Testsma')
  })
})
