// Gedeelde zoekkiezer (ZoekKiezer) voor prospects en contacten: tijdens het typen een lijst met hooguit zes
// treffers, kiezen met de muis of met pijltjes en Enter. "+ Inzicht" op /inzichten kiest een prospect en
// optioneel een contact; het inzicht staat daarna ook op de contactkaart.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('zoekkiezer', () => {
  test('/inzichten: geen knop Klanten; + Inzicht met prospect en contact komt op de contactkaart', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/inzichten')
    await expect(page.getByTestId('filter-soort').locator('button')).toHaveText(['Alle', 'Prospects'])
    const knop = page.getByTestId('inzicht-met-bron-knop')
    await expect(knop).toHaveText('Inzicht')
    await knop.click()
    const v = page.getByTestId('inzicht-met-bron')
    await expect(v).toBeVisible()

    // Meer dan zes treffers in de API, zes in de lijst.
    const api = await (await page.request.get('/api/accounts/kies?q=Test')).json()
    expect(api.length).toBeGreaterThan(6)
    await v.getByTestId('imb-klant').pressSequentially('Test')
    await expect(v.getByTestId('imb-klant-optie')).toHaveCount(6)
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

  test('Nieuwe taak: typen toont hooguit zes treffers; pijltjes en Enter kiezen', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/contacten/alle')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('lijst-taak').click()
    const veld = page.getByTestId('nt-klant')
    await veld.pressSequentially('Test')
    await expect(page.getByTestId('nt-klant-optie')).toHaveCount(6)
    const tweede = (await page.getByTestId('nt-klant-optie').nth(1).textContent())!.split(' · ')[0]!.trim()
    await veld.press('ArrowDown')
    await veld.press('Enter')
    await expect(page.getByTestId('nt-klant-keuze')).toContainText(tweede)
    // Het contactveld toont daarna de contacten van de gekozen klant (of meldt dat er geen zijn).
    await page.getByTestId('nt-contact').click()
    await expect(page.getByTestId('zoekkiezer-lijst').or(page.locator('.zoeklijst-leeg'))).toBeVisible()
  })
})
