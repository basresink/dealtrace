// Belscript Studio (/belscripts): standaardscript, templates, script per prospect en de belmodus.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test.describe('Belscript Studio', () => {
  test('salesmanager: blokken toevoegen, verplaatsen, variabele invoegen, voorbeeld en validatie bij activeren', async ({ page }) => {
    await login(page, 'u-04')
    await ga(page, '/belscripts')
    await expect(page.getByTestId('tab-standaard')).toHaveAttribute('aria-selected', 'true')
    const blokken = page.getByTestId('studio-blokken').locator('.ss-blok')
    const voor = await blokken.count()
    await page.getByTestId('nieuw-blok-soort').selectOption('vrij')
    await page.getByTestId('nieuw-blok').click()
    await expect(blokken).toHaveCount(voor + 1)
    // Het nieuwe blok staat voor de afsluiting en is open; voeg een variabele in op de cursor.
    const nieuw = page.locator('[data-test^="studio-tekst-"]').last()
    await page.getByTestId('studio-tekst-0').click()
    await page.getByTestId('var-account.plaats').click()
    await expect(page.getByTestId('studio-tekst-0')).toHaveValue(/\{account\.plaats\}/)
    await expect(nieuw).toBeVisible()
    // Verplaatsen.
    const eerste = await page.getByTestId('studio-blok-0').locator('.ss-blok-naam').textContent()
    await page.getByTestId('blok-neer-0').click()
    await expect(page.getByTestId('studio-blok-1').locator('.ss-blok-naam')).toContainText(eerste!.replace(/^\d+\.\s*/, ''))
    // Voorbeeld voor een prospect met de woordenteller.
    await expect(page.getByTestId('studio-voorbeeld')).toContainText('Opening')
    await expect(page.getByTestId('studio-woorden')).toContainText('richtlijn 150')
    // Zonder voicemail kan het niet actief worden.
    const n = await blokken.count()
    for (let i = n - 1; i >= 0; i--) if (/Voicemail/.test((await page.getByTestId(`studio-blok-${i}`).locator('.ss-blok-naam').textContent()) ?? '')) await page.getByTestId(`blok-weg-${i}`).click()
    await page.getByTestId('studio-activeer').click()
    await expect(page.getByTestId('studio-validatie')).toContainText('voicemail')
    await expect(page.getByTestId('studio-status')).toContainText('niet opgeslagen')
  })

  test('templates: filter, Bekijk en Gebruik als basis maken een concept dat je opslaat en activeert', async ({ page, request }) => {
    await login(page, 'u-04')
    await ga(page, '/belscripts?tab=templates')
    await expect(page.getByTestId('tpl-raster').locator('article')).toHaveCount(6)
    await page.getByTestId('tpl-filter-nieuw').click()
    await expect(page.getByTestId('tpl-raster').locator('article')).toHaveCount(2)
    await page.getByTestId('tpl-filter-alle').click()
    await expect(page.getByTestId('tpl-resultaat-koud')).toContainText(/gesprekken/)
    await page.getByTestId('tpl-bekijk-voicemail').click()
    await expect(page.getByTestId('tpl-flyout')).toContainText('Zo klinkt het bij')
    await page.getByTestId('tpl-flyout-gebruik').click()
    await expect(page.getByTestId('tab-standaard')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('studio-naam')).toHaveValue('Voicemail')
    await expect(page.getByTestId('studio-status')).toContainText('Concept · versie 0')
    await page.getByTestId('studio-concept').click()
    await expect(page.getByText('Concept opgeslagen.')).toBeVisible()
    await page.getByTestId('studio-activeer').click()
    await expect(page.getByTestId('studio-status')).toContainText('Actief · versie 1')
    // Opruimen: het script uit de keuze halen.
    const id = new URL(page.url()).searchParams.get('script')
    expect(id).toBeTruthy()
    await apiLogin(request, 'u-04')
    expect((await request.post(`/api/belscripts/${id}/archiveer`)).ok()).toBe(true)
  })

  test('accountmanager kijkt mee bij het standaardscript en mag geen template gebruiken', async ({ page, request }) => {
    await login(page, 'u-01')
    await ga(page, '/belscripts')
    await expect(page.getByTestId('studio-meekijken')).toBeVisible()
    await expect(page.getByTestId('studio-activeer')).toHaveCount(0)
    await ga(page, '/belscripts?tab=templates')
    await expect(page.getByTestId('tpl-gebruik-koud')).toHaveCount(0)
    await apiLogin(request, 'u-01')
    expect((await request.post('/api/belscripts', { data: { naam: 'x', doel: 'koud' } })).status()).toBe(403)
  })

  test('per prospect: gegevens met bron, Vul met AI, elk blok beoordelen, bewaren als versie en bellen in de belmodus', async ({ page, request }) => {
    await login(page, 'u-01')
    await ga(page, '/belscripts?tab=prospect')
    const eerste = page.locator('[data-test^="sp-prospect-"]').first()
    await expect(eerste).toBeVisible()
    await eerste.click()
    await expect(page.getByTestId('sp-gegevens')).toContainText('Winpunt')
    await expect(page.getByTestId('sp-gegeven-tijden')).toContainText('ontbreekt')
    await page.getByTestId('sp-vul').click()
    await expect(page.getByTestId('sp-teller')).toBeVisible()
    await expect(page.getByTestId('sp-bewaar')).toBeDisabled()
    // Herkomst: "Gebaseerd op" opent de bron.
    const chip = page.locator('.sp-chip:not([disabled])').first()
    if (await chip.count()) { await chip.click(); await expect(page.getByTestId('sp-bron-flyout')).toBeVisible(); await page.keyboard.press('Escape') }
    // Eén blok verwerpen (terugvalzin), de rest bevestigen.
    const verwerp = page.locator('[data-test^="sp-verwerp-"]')
    if ((await verwerp.count()) > 1) await verwerp.first().click()
    while (await page.locator('[data-test^="sp-bevestig-"]').count()) await page.locator('[data-test^="sp-bevestig-"]').first().click()
    await expect(page.getByTestId('sp-nog')).toHaveText('Alles beoordeeld.')
    const antwoord = page.waitForResponse((r) => /\/api\/belscripts\/prospect\/.+\/bewaar/.test(r.url()))
    await page.getByTestId('sp-bewaar').click()
    const r = await antwoord
    expect(r.ok()).toBe(true)
    const { id, versie } = await r.json()
    await expect(page.getByText(`Versie ${versie} bewaard`)).toBeVisible()
    await expect(page.getByTestId('sp-versies')).toContainText(`Versie ${versie}`)
    // Een bewaard concept kan niet nog eens bewaard worden.
    await apiLogin(request, 'u-01')
    expect((await request.post(`/api/belscripts/prospect/${id}/bewaar`, { data: { blokken: [] } })).status()).toBe(409)
    // De belmodus gebruikt de bewaarde versie.
    await page.getByTestId('sp-belmodus').click()
    await expect(page.getByTestId('tab-belmodus')).toHaveAttribute('aria-selected', 'true')
    const bm = page.getByTestId('studio-belmodus')
    await expect(bm.getByTestId('script-keuze')).toHaveValue(`pv:${id}`)
    await expect(bm.getByTestId('blok-teller')).toHaveText(/Blok 1 van/)
    await bm.getByTestId('volgende-blok').click()
    await expect(bm.getByTestId('blok-teller')).toHaveText(/Blok 2 van/)
    const bezwaar = bm.locator('[data-test^="bezwaar-"]').first()
    await bezwaar.click()
    await expect(bezwaar).toHaveAttribute('aria-expanded', 'true')
    await bm.getByTestId('sb-uitkomst-geen_gehoor').click()
    await expect(bm.getByTestId('sb-activiteit')).toContainText(`persoonlijke versie ${versie}`)
    await expect(bm.getByTestId('sb-activiteit')).not.toContainText('geen opengeklapt')
  })

  test('zonder besluit over een AI-blok geen versie (422); Belblokken linkt naar Belscripts', async ({ page, request }) => {
    await apiLogin(request, 'u-01')
    const keuze = await (await request.get('/api/belscripts/prospecten')).json()
    test.skip(!keuze.prospecten.length, 'Geen prospects')
    const r = await request.post('/api/belscripts/prospect/vul', { data: { accountId: keuze.prospecten[0].accountId } })
    expect(r.ok()).toBe(true)
    const c = await r.json()
    if (c.data.blokken.some((b: any) => b.status === 'voorgesteld')) expect((await request.post(`/api/belscripts/prospect/${c.conceptId}/bewaar`, { data: { blokken: [] } })).status()).toBe(422)
    await login(page, 'u-01')
    await ga(page, '/belblokken')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('naar-belscripts').click()
    await expect(page).toHaveURL(/\/belscripts/)
  })
})
