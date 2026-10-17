// Contactkaart in de opzet van DealDrive: kop, statstrook en dezelfde tabbladen als de accountkaart, met
// alleen wat bij het contact hoort. Op de accountkaart staat bij elk item de naam van het contact met een link.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

const TABS = ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'documenten']

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
    await expect(page.getByTestId('tab-kwalificatie')).toHaveCount(0)
    await expect(page.getByTestId('tab-accountplan')).toHaveCount(0)
    await expect(page.getByTestId('tab-campagnes')).toHaveCount(0)
    await ga(page, '/accounts/pr-06')
    // De accountkaart heeft dezelfde tabbladen.
    expect(await labels()).toEqual(opContact)

    // De tijdlijn van het contact: alleen momenten van dit contact; de metaregel noemt het contact zelf niet
    // (je zit al op zijn kaart), wel de gebruiker.
    await ga(page, '/contacten/ct-07')
    await expect(page.getByTestId('tijdlijn')).toBeVisible()
    await expect(page.getByTestId('tijdlijn').getByTestId('tl-contact')).toHaveCount(0)
    await expect(page.getByTestId('tijdlijn').getByTestId('tl-door').first()).toHaveText(/^door \S+ \S+/)
    // Reis staat onder Meer, met de stand van het account en een link naar de accountkaart.
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('meer-reis').click()
    await expect(page.getByTestId('reis-flyout').getByTestId('reis-blok')).toBeVisible()
    await expect(page.getByTestId('naar-accountkaart')).toHaveAttribute('href', '/accounts/pr-06?meer=reis')
    // Escape gaat terug naar Meer; nog een keer Escape sluit Meer.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('meer-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('meer-flyout')).toHaveCount(0)
    // Deals en Eigen velden hebben geen tabblad meer; eigen velden staan in het Info-venster.
    await expect(page.getByTestId('tab-deals')).toHaveCount(0)
    await expect(page.getByTestId('tab-eigenvelden')).toHaveCount(0)
    await page.getByTestId('contact-info-knop').click()
    await expect(page.getByTestId('contact-info-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('kop: Zoeken, Vraag AI, Info en Meer op één regel op 1280; op 390 Info en Meer; de rest onder Meer', async ({ page }) => {
    await login(page, 'u-01')
    await page.setViewportSize({ width: 1280, height: 900 })
    await ga(page, '/contacten/ct-07')
    const kop = await page.locator('.ck-acties [data-test]:not([data-test=kop-iconen]):visible').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-test'), top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })))
    expect(kop.map((k) => k.id)).toEqual(['kop-zoeken', 'vraag-ai', 'contact-info-knop', 'kop-meer'])
    expect(new Set(kop.map((k) => k.top)).size).toBe(1)
    expect(kop.every((k) => k.h >= 44)).toBe(true)
    await expect(page.getByTestId('kop-account')).toHaveCount(0)
    await expect(page.getByTestId('hulp-knop')).toHaveCount(0)
    await page.getByTestId('kop-meer').click()
    const meer = page.getByTestId('meer-flyout')
    for (const id of ['briefing-knop', 'knop-volgen', 'knop-invloed', 'meer-dossier', 'meer-kwalificatie', 'meer-reis', 'meer-campagnes']) await expect(meer.getByTestId(id)).toBeVisible()
    for (const id of ['meer-ritme', 'bel-knop', 'contact-info-knop']) await expect(meer.getByTestId(id)).toHaveCount(0)
    // Kwalificatie: de rol van dit contact en BAND van het account.
    await meer.getByTestId('meer-kwalificatie').click()
    const kw = page.getByTestId('kwalificatie-flyout')
    await expect(kw.getByTestId('kwalificatie-contact')).toContainText('in het buying committee')
    await expect(kw.getByTestId('band')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(kw).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await ga(page, '/contacten/ct-07')
    const rij = await page.locator('.ck-acties [data-test]:not([data-test=kop-iconen]):visible').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-test'), top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })))
    expect(rij.map((k) => k.id)).toEqual(['contact-info-knop', 'kop-meer'])
    expect(new Set(rij.map((k) => k.top)).size).toBe(1)
    expect(rij.every((k) => k.h >= 44)).toBe(true)
    await page.getByTestId('kop-meer').click()
    await expect(page.getByTestId('meer-flyout').getByTestId('bel-knop')).toHaveCount(0)
    await page.getByTestId('meer-flyout').getByTestId('briefing-knop').click()
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
