// Contactkaart in de opzet van DealDrive: kop, statstrook en dezelfde tabbladen als de accountkaart, met
// alleen wat bij het contact hoort. Op de accountkaart staat bij elk item de naam van het contact met een link.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

const TABS = ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'deals', 'campagnes', 'documenten', 'kwalificatie', 'eigenvelden']

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
    await page.getByTestId('tab-deals').click()
    await expect(page.getByTestId('deals-account')).toBeVisible()
    await page.getByTestId('contact-info-knop').click()
    await expect(page.getByTestId('contact-info-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
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
