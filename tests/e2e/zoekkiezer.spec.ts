// Gedeelde zoekkiezer (ZoekKiezer) voor prospects en contacten: bij focus meteen een lijst (zes rijen in beeld,
// scrollen voor meer, eigen recente prospects eerst), typen filtert, kiezen met de muis of met pijltjes en Enter,
// Escape sluit. "+ Inzicht" op /inzichten kiest een prospect en optioneel een contact; het inzicht staat daarna
// ook op de contactkaart.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'
import type { Locator, Page } from '@playwright/test'

/** Aantal rijen dat in de lijst in beeld past (de lijst scrolt voor de rest). */
async function rijenInBeeld(page: Page, optie: Locator) {
  const lijst = await page.getByTestId('zoekkiezer-lijst').evaluate((e) => e.clientHeight)
  const rij = await optie.first().evaluate((e) => e.getBoundingClientRect().height)
  return Math.round(lijst / rij)
}

test.describe('zoekkiezer', () => {
  test('/inzichten: geen keuzeknop Prospects; + Inzicht links van Filters, met prospect en contact op de contactkaart', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/inzichten')
    await expect(page.getByTestId('filter-soort')).toHaveCount(0)
    const knop = page.getByTestId('inzicht-met-bron-knop')
    await expect(knop).toHaveText('Inzicht')
    // "+ Inzicht" staat links van Filters.
    expect((await knop.boundingBox())!.x).toBeLessThan((await page.getByTestId('inzicht-filters').boundingBox())!.x)
    await knop.click()
    const v = page.getByTestId('inzicht-met-bron')
    await expect(v).toBeVisible()

    // Meer dan zes treffers in de API; zes in beeld, de rest scrolt.
    const api = await (await page.request.get('/api/accounts/kies?q=Test')).json()
    expect(api.length).toBeGreaterThan(6)
    await v.getByTestId('imb-klant').pressSequentially('Test')
    await expect(v.getByTestId('imb-klant-optie')).toHaveCount(api.length)
    expect(await rijenInBeeld(page, v.getByTestId('imb-klant-optie'))).toBe(6)
    // Een inzicht mag alleen bij een eigen account: kies er een uit de eigen lijst met een contact.
    const eigen = ((await (await page.request.get('/api/accounts')).json()).rijen as { id: string; naam?: string; name?: string }[]).map((a) => ({ id: a.id, naam: (a.naam ?? a.name)! }))
    let prospect = ''
    for (const a of eigen) { if ((await (await page.request.get(`/api/contacten/kies?accountId=${a.id}`)).json()).length) { prospect = a.naam; break } }
    expect(prospect).not.toBe('')
    await v.getByTestId('imb-klant').fill('')
    await v.getByTestId('imb-klant').pressSequentially(prospect)
    await v.getByTestId('imb-klant-optie').filter({ hasText: prospect }).first().click()
    await expect(v.getByTestId('imb-klant-keuze')).toContainText(prospect)

    // Het contactveld toont de contacten van het gekozen prospect al bij focus.
    await v.getByTestId('imb-contact').click()
    await expect(v.getByTestId('imb-contact-optie').first()).toBeVisible()
    const contactNaam = (await v.getByTestId('imb-contact-optie').first().textContent())!.split(' · ')[0]!.trim()
    await v.getByTestId('imb-contact-optie').first().click()
    await expect(v.getByTestId('imb-contact-keuze')).toContainText(contactNaam)

    const titel = `Testinzicht ${Date.now() % 100000}`
    await v.getByTestId('imb-titel').fill(titel)
    await v.getByTestId('imb-bron').fill('Gesprek op de testbeurs')
    await v.getByTestId('imb-citaat').fill('We breiden volgend jaar uit.')
    const [verzoek] = await Promise.all([page.waitForRequest('**/api/signals/handmatig'), v.getByTestId('imb-opslaan').click()])
    const antwoord = await (await verzoek.response())!.json()
    const body = verzoek.postDataJSON()
    expect(body.contactId).toBeTruthy()
    await expect(v).toHaveCount(0)

    // Op de contactkaart (tabblad Inzichten) staat het inzicht bij dit contact.
    const tabs = await (await page.request.get(`/api/contacten/${body.contactId}/tabbladen`)).json()
    const gevonden = tabs.inzichten.find((i: any) => i.id === antwoord.id)
    expect(gevonden).toMatchObject({ title: titel, contactId: body.contactId })

    // Een contact van een ander account weigert de server.
    const ander = await (await page.request.get('/api/contacten/kies?q=Test')).json()
    const vreemd = ander.find((c: any) => c.accountId !== body.accountId)
    if (vreemd) expect((await page.request.post('/api/signals/handmatig', { data: { ...body, contactId: vreemd.id } })).status()).toBe(422)

    // Opruimen: het testinzicht afwijzen, zodat de tellers van Eva blijven.
    await page.request.post(`/api/signals/${antwoord.id}/afwijzen`, { data: { reden: 'Niet relevant' } })
  })

  test('Nieuwe taak: typen filtert, zes rijen in beeld; pijltjes en Enter kiezen', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/contacten/alle')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('lijst-taak').click()
    const veld = page.getByTestId('nt-klant')
    await veld.pressSequentially('Test')
    await expect(page.getByTestId('nt-klant-optie').nth(6)).toBeAttached()
    expect(await rijenInBeeld(page, page.getByTestId('nt-klant-optie'))).toBe(6)
    for (const t of await page.getByTestId('nt-klant-optie').allTextContents()) expect(t.toLowerCase()).toContain('test')
    const tweede = (await page.getByTestId('nt-klant-optie').nth(1).textContent())!.split(' · ')[0]!.trim()
    await veld.press('ArrowDown')
    await veld.press('Enter')
    await expect(page.getByTestId('nt-klant-keuze')).toContainText(tweede)
    // Het contactveld toont daarna de contacten van de gekozen klant (of meldt dat er geen zijn).
    await page.getByTestId('nt-contact').click()
    await expect(page.getByTestId('zoekkiezer-lijst').or(page.locator('.zoeklijst-leeg'))).toBeVisible()
  })

  test('bij focus meteen een lijst: label erboven, eigen prospects eerst, naam · branche, Escape sluit', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/contacten/alle')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('lijst-taak').click()
    const veld = page.getByTestId('nt-klant')
    // Het label staat boven het veld en hoort erbij.
    await expect(page.getByLabel('Prospect', { exact: true })).toHaveAttribute('data-test', 'nt-klant')
    await veld.focus()
    const opties = page.getByTestId('nt-klant-optie')
    await expect(opties.first()).toBeVisible()
    expect(await opties.count()).toBeGreaterThan(6)
    expect(await rijenInBeeld(page, opties)).toBe(6)
    // Dezelfde volgorde als de API zonder zoekterm: eigen prospects eerst.
    const api = await (await page.request.get('/api/accounts/kies')).json()
    const eigen = ((await (await page.request.get('/api/accounts')).json()).rijen as { id: string }[]).map((a) => a.id)
    expect(eigen).toContain(api[0].id)
    await expect(opties.first()).toContainText(api[0].naam)
    // Naam in normaal gewicht; branche of plaats gedempt erachter.
    const metSub = api.findIndex((a: any) => a.branche || a.plaats)
    if (metSub >= 0 && metSub < 6) await expect(opties.nth(metSub).locator('.zoeklijst-sub')).toContainText(api[metSub].branche ?? api[metSub].plaats)
    expect(await opties.first().locator('.zk-naam').evaluate((e) => getComputedStyle(e).fontWeight)).toBe('400')
    // De lijst scrolt voor meer.
    expect(await page.getByTestId('zoekkiezer-lijst').evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true)
    // Escape sluit de lijst, pijl omlaag opent hem weer.
    await veld.press('Escape')
    await expect(page.getByTestId('zoekkiezer-lijst')).toHaveCount(0)
    await expect(page.getByTestId('nieuwe-taak')).toBeVisible()
    await veld.press('ArrowDown')
    await expect(opties.first()).toBeVisible()
    // Het contactveld zonder prospect toont ook meteen contacten (naam · functie).
    await veld.press('Escape')
    await page.getByTestId('nt-contact').focus()
    await expect(page.getByTestId('nt-contact-optie').first()).toBeVisible()
  })

  test('telefoon: rijen van 44 px en zes in beeld', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-01')
    await ga(page, '/briefings')
    await page.getByTestId('bf-zoek').focus()
    const opties = page.getByTestId('bf-zoek-optie')
    await expect(opties.first()).toBeVisible()
    expect(Math.round(await opties.first().evaluate((e) => e.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44)
    expect(await rijenInBeeld(page, opties)).toBe(6)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
