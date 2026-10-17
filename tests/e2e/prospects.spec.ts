// P03: lijst met filters, dubbelcheck, accountkaart en contacten, eigen velden.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe('prospects', () => {
  test('filter "Zonder beslisser": teller gelijk aan de rijen, en het overleeft herladen', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/prospects/alle')
    await page.getByTestId('filters-knop').click()
    const pil = page.getByTestId('filter-bereikbaarheid-zonderBeslisser')
    const teller = Number(await pil.locator('.pil-teller').textContent())
    await pil.click()
    await expect(page).toHaveURL(/bereikbaarheid=zonderBeslisser/)
    await expect(page.getByTestId('aantal')).toHaveText(`${teller} ${teller === 1 ? 'resultaat' : 'resultaten'}`)
    await page.reload()
    await expect(page.getByTestId('aantal')).toHaveText(`${teller} ${teller === 1 ? 'resultaat' : 'resultaten'}`)
  })

  test('geen hulpknop in de kop van /prospects en /prospects/alle; zoeken blijft, /klanten houdt hulp', async ({ page }) => {
    await login(page, 'u-03')
    for (const pad of ['/prospects', '/prospects/alle']) {
      await ga(page, pad)
      await expect(page.getByTestId('kop-knoppen').getByTestId('kop-zoeken')).toBeVisible()
      await expect(page.getByTestId('hulp-knop')).toHaveCount(0)
    }
    await ga(page, '/klanten')
    await expect(page.getByTestId('kop-knoppen').getByTestId('hulp-knop')).toBeVisible()
  })

  test('nieuwe prospect: de dubbelcheck vangt een bestaand bedrijf', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/prospects/alle')
    await page.getByTestId('nieuwe-prospect').click()
    await page.getByTestId('np-naam').fill('Testinstallatie Koperwiek B.V.')
    await expect(page.getByTestId('dubbelcheck')).toContainText('Bedoel je Testinstallatie Koperwiek in Amersfoort? Al in je bestand.')
    await page.getByTestId('np-bestaand').click()
    await expect(page).toHaveURL(/\/accounts\/pr-01$/)
  })

  test('snel contactpersoon als beslisser vult het buying committee', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/accounts/pr-03?tab=kwalificatie')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('contacten-knop').click()
    await page.getByTestId('snel-contact').click()
    const naam = `Testbeslisser${Date.now() % 100000}`
    await page.getByTestId('sc-achternaam').fill(naam)
    await page.getByTestId('sc-rol').selectOption('champion')
    await page.getByTestId('sc-toevoegen').click()
    // Escape sluit het bovenste venster (P27); twee keer sluit ook de contactenflyout.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    if (await page.locator('.fo-overlay').count()) await page.keyboard.press('Escape')
    await expect(page.locator('.fo-overlay')).toHaveCount(0)
    await expect(page.locator('[data-rol="champion"]')).toContainText(naam)
  })

  test('een klant staat in /klanten en niet in de prospectlijst; geen promoveren', async ({ request }) => {
    await apiLogin(request, 'u-02')
    const prospects = await (await request.get('/api/accounts?eigenaar=iedereen')).json()
    const klanten = await (await request.get('/api/accounts?soort=klant&eigenaar=iedereen')).json()
    expect(prospects.rijen.some((r: any) => r.id === 'kl-02')).toBe(false)
    expect(klanten.rijen.some((r: any) => r.id === 'kl-02')).toBe(true)
    expect((await request.put('/api/accounts/pr-02', { data: { status: 'klant' } })).status()).toBe(400)
  })

  test('verwijderen kan niemand meer (0064); deactiveren alleen met recht', async ({ request }) => {
    // pr-02 is van u-01: een collega (u-03) mag hem niet deactiveren; verwijderen kan zelfs de beheerder niet.
    await apiLogin(request, 'u-03')
    expect((await request.delete('/api/accounts/pr-02')).status()).toBe(405)
    expect((await request.post('/api/accounts/pr-02/deactiveren', { data: { reden: 'dubbel' } })).status()).toBe(403)
    await apiLogin(request, 'u-06')
    expect((await request.delete('/api/accounts/pr-02')).status()).toBe(405)
    expect((await (await request.get('/api/accounts/pr-02')).json()).gedeactiveerd).toBeNull()
  })

  test('eigen veld "vanaf Gevorderd" is voor een Beginner onzichtbaar, ook in de API', async ({ request }) => {
    await apiLogin(request, 'u-02')
    const r = await (await request.get('/api/accounts/pr-01')).json()
    expect(r.customFields).not.toHaveProperty('aantal_monteurs')
    expect(r.eigenVelden.map((v: any) => v.sleutel)).not.toContain('aantal_monteurs')
    await apiLogin(request, 'u-03')
    const g = await (await request.get('/api/accounts/pr-01')).json()
    expect(g.customFields).toHaveProperty('aantal_monteurs')
  })

  test('beheerder maakt een filterbaar keuzelijstveld; een Gevorderde ziet de pil met teller', async ({ request }) => {
    await apiLogin(request, 'u-06')
    const naam = `Testveld ${Date.now() % 100000}`
    const v = await request.post('/api/eigen-velden', { data: { object: 'account', naam, type: 'keuzelijst', data: { filterbaar: true, opties: [{ waarde: 'ja_graag', label: 'Ja graag' }] } } })
    expect(v.status()).toBe(200)
    const veld = await v.json()
    expect((await request.put('/api/accounts/pr-01', { data: { customFields: { [veld.sleutel]: 'ja_graag' } } })).status()).toBe(200)
    await apiLogin(request, 'u-03')
    const lijst = await (await request.get('/api/accounts')).json()
    expect(lijst.tellers[`cf.${veld.sleutel}`]?.ja_graag).toBe(1)
  })
})

test.describe('accountkaart op de telefoon', () => {
  test('compact, zonder horizontale scroll, bellen in 1 tik', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-03')
    await ga(page, '/accounts/pr-01')
    await expect(page.getByTestId('compacte-kaart')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    const bellen = page.getByTestId('ab-bellen')
    await expect(bellen).toHaveAttribute('href', /^tel:\+31/)
    expect(await bellen.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48)
  })
})
