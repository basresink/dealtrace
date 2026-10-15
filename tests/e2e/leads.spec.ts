// P11: leadgenerator met AI-zoeker en KvK (mock, geen netwerk), koppelingen, rondes en verbruik,
// en KvK opzoeken op de telefoon.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test.describe('Leadgenerator op de desktop', () => {
  test('ronde starten: vijf groepen met bewijs en meters; Neem over maakt een prospect', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator')
    await page.getByTestId('zoekopdracht-aanpassen').click()
    const p = page.getByTestId('zoekpaneel')
    await p.getByTestId('zp-branche').selectOption('br-01')
    await p.getByTestId('zp-aanleiding').fill('werft servicemonteurs')
    await page.getByTestId('nieuwe-ronde').click()
    await expect(page.getByText(/bedrijven gevonden|Bewaard resultaat/)).toBeVisible()
    await expect(page.getByTestId('vakken')).toContainText('4321 en 4322')
    await expect(page.locator('[data-groep="alBekend"]')).toContainText('Testinstallatie Koperwiek')
    await expect(page.locator('[data-groep="alBekend"]')).toContainText('Al prospect in DealDrive')
    await expect(page.getByTestId('meter-kvk')).toContainText('/ 2.000')
    const kaart = page.locator('[data-groep="passend"] article, [data-groep="onbeoordeeld"] article').first()
    const naam = (await kaart.getAttribute('data-lead'))!
    await expect(kaart.locator('.bewijs')).toHaveCount(6)
    await kaart.getByTestId('neem-over').click()
    await expect(page.getByTestId('neem-over-flyout')).toBeVisible()
    await page.getByTestId('no-bevestig').click()
    await expect(page.getByText(new RegExp(`${naam.replace(/[.&]/g, '.')} staat nu bij je prospects`))).toBeVisible()
    await expect(page.locator(`[data-groep="alBekend"] [data-lead="${naam}"]`)).toBeVisible()
  })

  test('Niet relevant vraagt een reden en bewaart hem', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator')
    const kaart = page.locator('article[data-lead]').filter({ has: page.getByTestId('niet-relevant') }).first()
    const naam = (await kaart.getAttribute('data-lead'))!
    await kaart.getByTestId('niet-relevant').click()
    await expect(kaart.getByTestId('afwijzen-bevestig')).toBeDisabled()
    await kaart.locator('[data-reden="Te klein"]').click()
    await kaart.getByTestId('afwijzen-bevestig').click()
    await expect(page.getByText('Reden bewaard. Dit bedrijf komt niet terug.')).toBeVisible()
    await expect(page.locator(`[data-lead="${naam}"]`)).toHaveCount(0)
  })

  test('Toch uitzoeken maakt een dossier', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator')
    const knop = page.getByTestId('toch-uitzoeken').first()
    test.skip(!(await knop.count()), 'Geen lead om uit te zoeken')
    await knop.click()
    await expect(page.getByText(/Dossier van .* is bijgewerkt/)).toBeVisible()
  })

  test('Rondes en verbruik toont de ronde; Koppelingen toont KvK', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator?tab=rondes')
    await expect(page.getByTestId('rondes')).toContainText('KvK')
    await expect(page.getByTestId('rondes-vandaag')).toContainText('/ 10')
    await page.getByTestId('tab-koppelingen').click()
    await expect(page.getByTestId('kvk-status')).toHaveText('Gekoppeld')
    await expect(page.getByTestId('kvk-sleutel')).toHaveCount(0)
  })

  test('beheerder: een verlopen sleutel geeft uitleg in gewone taal; opslaan pas na testen', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/leadgenerator?tab=koppelingen')
    await page.getByTestId('kvk-sleutel').fill('verlopen-sleutel-1234')
    await expect(page.getByTestId('kvk-opslaan')).toBeDisabled()
    await page.getByTestId('kvk-test').click()
    await expect(page.getByTestId('kvk-fout')).toHaveText('De KvK-sleutel is verlopen. Vraag een nieuwe aan bij KvK en plak hem hier.')
    const status = await (await page.request.get('/api/koppelingen/kvk')).json()
    expect(JSON.stringify(status)).not.toContain('kvk-mock')
  })

  test('zonder sleutel is KvK niet kiesbaar (Testorganisatie Tweede)', async ({ request }) => {
    await apiLogin(request, 'u-t1')
    expect((await (await request.get('/api/kvk/status')).json()).gekoppeld).toBe(false)
    const r = await request.post('/api/kvk/zoek', { data: { naam: 'Teeuwen' } })
    expect(r.status()).toBe(400)
  })

  test('Beginner: Leadgenerator nog niet aangezet; een ronde geeft 403 met reden niveau', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/leadgenerator')
    await expect(page.getByTestId('tab-zoeken')).toHaveCount(0)
    const r = await page.request.post('/api/leads/ronde', { data: { zoekopdracht: {}, bronnen: ['kvk'] } })
    expect(r.status()).toBe(403)
    expect((await r.json()).data.reden).toBe('niveau')
  })
})

test.describe('Op de telefoon', () => {
  const NAMEN: Record<number, string> = { 375: 'Elektrotechniek Vecht', 390: 'Groen Installatietechniek', 412: 'Zonnewerk Twente' }
  for (const breedte of [375, 390, 412]) {
    test(`${breedte} px: Leadgenerator zegt "Beter op een groot scherm"; KvK opzoeken en toevoegen in hooguit 3 tikken`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: 800 })
      await login(page, 'u-03')
      await ga(page, '/leadgenerator')
      await expect(page.getByTestId('groot-scherm')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      await page.getByRole('button', { name: 'Zoeken' }).first().click() // tik 1
      await page.locator('.zoek-invoer').fill(NAMEN[breedte]!.split(' ')[0]!)
      const groep = page.getByTestId('kvk-register')
      const rij = groep.locator('.zoek-rij').filter({ hasText: NAMEN[breedte]! })
      await expect(rij).toBeVisible()
      const voegToe = rij.getByTestId('kvk-voeg-toe')
      if (await voegToe.count()) {
        const box = await voegToe.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        await voegToe.click() // tik 2
        await expect(page.getByText(`${NAMEN[breedte]} staat erbij.`)).toBeVisible()
      } else {
        await rij.getByText('Open kaart').click()
      }
      await page.waitForURL(/\/accounts\//)
    })
  }
  test('zonder verbinding zegt de groep KvK-register dat het alleen met verbinding kan', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await login(page, 'u-03')
    await page.getByRole('button', { name: 'Zoeken' }).first().click()
    await context.setOffline(true)
    await page.locator('.zoek-invoer').fill('Teeuwen')
    await expect(page.getByTestId('kvk-register')).toContainText('KvK zoeken kan alleen met verbinding')
    await context.setOffline(false)
  })
})
