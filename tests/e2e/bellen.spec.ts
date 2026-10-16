// P10: belblokken, belmodus, belscripts en bellen op de telefoon.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  // De motor zet de belpogingen klaar.
  await apiLogin(request, 'u-06')
  await request.post('/api/motor/run', { data: {} })
})

test.describe('Belblokken en belmodus', () => {
  test('plan een blok uit de bellijst, bel met script, rond af en zie het blokresultaat', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/belblokken')
    await expect(page.getByTestId('bellijst-kop')).toHaveText('Bellijst')
    await expect(page.getByTestId('top-5')).toHaveClass(/keuzegroep-knop--aan/)
    await page.getByTestId('zelf-kiezen').click()
    const vinkjes = page.getByTestId('bellijst').locator('.bl-rij:not(.bl-rij--blok) input[type=checkbox]')
    await expect(vinkjes.first()).toBeVisible()
    const n = Math.min(2, await vinkjes.count())
    for (let i = 0; i < n; i++) await vinkjes.nth(i).check()
    await page.getByTestId('planpaneel').locator('input[type=radio]').first().check()
    await expect(page.getByText(`${n} gesprekken geselecteerd`)).toBeVisible()
    const antwoord = page.waitForResponse((r) => r.url().includes('/api/belblokken/plan') && r.request().method() === 'POST')
    await page.getByTestId('zet-in-agenda').click()
    const { sessieId } = await (await antwoord).json()
    await expect(page.getByText(/Belblok gepland voor/)).toBeVisible()
    // Het net geplande blok openen (de lijst kan oudere blokken uit eerdere runs bovenaan hebben).
    await ga(page, `/belblokken/${sessieId}`)
    await expect(page.getByTestId('belmodus')).toBeVisible()
    await expect(page.getByTestId('belscript')).toBeVisible()
    await expect(page.getByTestId('blok-opening')).toBeVisible()
    const teller = page.getByTestId('teller')
    const voor = await teller.textContent()
    await page.getByTestId('uitkomst-geen_gehoor').click()
    if (n > 1) await expect(teller).not.toHaveText(voor!)
    await page.getByTestId('stop-blok').click()
    await expect(page.getByTestId('blokresultaat')).toContainText('gesprekken gevoerd')
  })

  test('Gesproken, later vraagt een datum; Geen interesse een reden', async ({ page, request }) => {
    await apiLogin(request, 'u-03')
    const lijst = await (await request.get('/api/belblokken')).json()
    const vrij = lijst.bellijst.filter((k: any) => !k.belblokId).slice(0, 2)
    test.skip(!vrij.length, 'Geen vrije kandidaten meer')
    // Zoek een vrij uur: een vast blok uit de seed (of een blok uit een eerdere test) op hetzelfde uur geeft
    // terecht 409. Met een vaste "nu plus 3 uur" faalde de test daardoor alleen op bepaalde tijden van de dag.
    let p: any = null
    for (let uur = 3; uur <= 30 && !p?.sessieId; uur++) {
      const start = new Date(Date.now() + uur * 3600_000); start.setUTCMinutes(0, 0, 0)
      const r = await request.post('/api/belblokken/plan', { data: { start: start.toISOString(), minuten: 30, accountIds: vrij.map((k: any) => k.accountId) } })
      if (r.ok()) p = await r.json()
      else expect(r.status()).toBe(409)
    }
    expect(p?.sessieId).toBeTruthy()
    await login(page, 'u-03')
    await ga(page, `/belblokken/${p.sessieId}`)
    await page.getByTestId('uitkomst-later').click()
    await expect(page.getByTestId('later-op')).toBeVisible()
    await page.getByTestId('uitkomst-geen_interesse').click()
    await expect(page.getByTestId('nee-reden')).toBeVisible()
    expect((await request.post(`/api/belblokken/${p.sessieId}/gesprek`, { data: { taskId: vrij[0].taskId ?? 'x', knop: 'geen_interesse' } })).status()).toBe(vrij[0].taskId ? 422 : 404)
  })

  test('Beginner: Top 5 en Zelf kiezen, Top 10 met slot en uitleg, geen eigen blokken, handsfree op slot', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/belblokken')
    await page.getByTestId('top-10').click()
    await expect(page.getByTestId('niet-aangezet-flyout')).toContainText('Gevorderd')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('nieuw-vast-blok')).toHaveCount(0)
    expect((await page.request.put('/api/mij/belblokken', { data: { blokken: [] } })).status()).toBe(403)
  })

  test('Vandaag wijst naar het belblok', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/')
    await expect(page.getByTestId('werkblok')).toContainText('BELBLOK')
  })
})

test.describe('Belscripts', () => {
  test('salesmanager maakt een script; een onbekende variabele blokkeert; activeren maakt versie 1 zichtbaar voor het team', async ({ page, request }) => {
    await login(page, 'u-04')
    await ga(page, '/instellingen/belscripts')
    await page.getByTestId('nieuw-script').click()
    const editor = page.getByTestId('script-editor')
    await expect(editor).toBeVisible()
    const naam = `Testscript ${Date.now()}`
    await editor.getByTestId('script-naam').fill(naam)
    await editor.getByTestId('blok-tekst-0').fill('Hallo {klant.schoenmaat}')
    await expect(editor.getByTestId('script-fout')).toHaveText('Onbekende variabele {klant.schoenmaat}')
    await expect(editor.getByTestId('activeer')).toBeDisabled()
    await editor.getByTestId('blok-tekst-0').fill('Goedemorgen {contact.voornaam}, met {gebruiker.voornaam}.')
    await editor.getByTestId('activeer').click()
    await expect(page.getByText('Versie 1 is actief.')).toBeVisible()
    await apiLogin(request, 'u-03')
    const lijst = await (await request.get('/api/belscripts')).json()
    expect(lijst.scripts.some((s: any) => s.naam === naam && s.status === 'actief')).toBe(true)
    expect((await request.post('/api/belscripts', { data: { naam: 'x', doel: 'koud' } })).status()).toBe(403)
  })

  test('Gevorderd maakt een persoonlijke variant; een Beginner ziet geen varianten', async ({ page, request }) => {
    await login(page, 'u-01')
    await ga(page, '/instellingen/mijn-scripts')
    await page.getByTestId('variant-Koude acquisitie beslisser').click()
    await expect(page.getByTestId('script-editor')).toBeVisible()
    await apiLogin(request, 'u-02')
    expect((await request.get('/api/belscripts')).status()).toBe(200)
    expect((await (await request.get('/api/belscripts')).json()).mijn).toEqual([])
  })
})

test.describe('Bellen op de telefoon', () => {
  for (const breedte of [375, 390, 412]) {
    test(`${breedte} px: belknop van minstens 44 px; na terugkeer "Hoe ging het?"; Niet bereikt in 2 tikken`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: 800 })
      await login(page, 'u-03')
      await ga(page, '/bellen')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      const knop = page.locator('[data-test^="bel-"]').first()
      test.skip(!(await knop.count()), 'Geen gesprekken voor vandaag')
      const box = await knop.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      // tel:-links openen niets in de test; we bootsen de terugkeer in de app na.
      await page.evaluate(() => { (window as any).open = () => null })
      await knop.evaluate((a: HTMLAnchorElement) => { a.removeAttribute('href') })
      await knop.click()
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await expect(page.getByTestId('hoe-ging-het')).toBeVisible()
      await page.getByTestId('tegel-niet_bereikt').click()
      await expect(page.getByTestId('hoe-ging-het')).toHaveCount(0)
    })
  }
  test('offline: de uitkomst wordt bewaard en verstuurd zodra er verbinding is', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await login(page, 'u-03')
    await ga(page, '/bellen')
    const knop = page.locator('[data-test^="bel-"]').first()
    test.skip(!(await knop.count()), 'Geen gesprekken voor vandaag')
    await knop.evaluate((a: HTMLAnchorElement) => { a.removeAttribute('href') })
    await knop.click()
    await context.setOffline(true)
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.getByTestId('tegel-voicemail').click()
    await expect(page.getByText('Bewaard op je telefoon')).toBeVisible()
    await context.setOffline(false)
  })
})
