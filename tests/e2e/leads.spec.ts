// P11: leadgenerator met AI-zoeker en KvK (mock, geen netwerk), koppelingen, rondes en verbruik,
// en KvK opzoeken op de telefoon.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test.describe('Leadgenerator op de desktop', () => {
  test('ronde starten: vijf groepen met bewijs en meters; Voeg toe maakt een prospect', async ({ page }) => {
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
    await kaart.getByTestId('voeg-toe').click()
    await expect(page.getByTestId('voeg-toe-flyout')).toBeVisible()
    await page.getByTestId('vt-opslaan').click()
    await expect(page.getByTestId('toegevoegd-melding')).toContainText(`${naam} staat nu bij je prospects`)
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

  test('Zoekopdracht aanpassen heeft geen doelgroep meer; de groep heet Nog te beoordelen', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator')
    await page.getByTestId('zoekopdracht-aanpassen').click()
    await expect(page.getByTestId('zoekpaneel')).toBeVisible()
    await expect(page.getByTestId('zp-doelgroep')).toHaveCount(0)
    await expect(page.getByTestId('zoekpaneel')).not.toContainText('Doelgroep')
    await expect(page.getByTestId('vakken')).not.toContainText('Doelgroep')
    const groep = page.getByTestId('filter-onbeoordeeld')
    if (await groep.count()) await expect(groep).toContainText('Nog te beoordelen')
    await expect(page.getByText('Nog niet te beoordelen')).toHaveCount(0)
  })

  test('Niet relevant met een eigen reden: bewaard en terug te zien bij de filter Niet relevant', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator')
    const kaart = page.locator('article[data-lead]').filter({ has: page.getByTestId('niet-relevant') }).first()
    const naam = (await kaart.getAttribute('data-lead'))!
    await kaart.getByTestId('niet-relevant').click()
    await kaart.locator('[data-reden="Andere reden"]').click()
    await expect(kaart.getByTestId('afwijzen-bevestig')).toBeDisabled()
    await kaart.getByTestId('afwijs-eigen').fill('ok')
    await expect(kaart.getByTestId('afwijzen-bevestig')).toBeDisabled()
    const eigen = `Zit midden in een overname ${Date.now() % 10000}`
    await kaart.getByTestId('afwijs-eigen').fill(eigen)
    await kaart.getByTestId('afwijzen-bevestig').click()
    await expect(page.getByText('Reden bewaard. Dit bedrijf komt niet terug.')).toBeVisible()
    await expect(page.locator(`article[data-lead="${naam}"]`)).toHaveCount(0)
    await page.getByTestId('filter-afgewezen').click()
    const rij = page.locator(`[data-afgewezen="${naam}"]`)
    await expect(rij).toContainText('Andere reden')
    await expect(rij.getByTestId('afgewezen-eigen')).toHaveText(eigen)
    // Te kort of onbekend: de server weigert.
    const ander = (await (await page.request.get('/api/leads')).json()).leads.find((l: any) => l.status === 'nieuw')
    if (ander) {
      expect((await page.request.post(`/api/leads/${ander.id}/afwijzen`, { data: { reden: 'Andere reden', toelichting: 'x' } })).status()).toBe(422)
      expect((await page.request.post(`/api/leads/${ander.id}/afwijzen`, { data: { reden: 'Bestaat niet' } })).status()).toBe(422)
    }
  })

  test('Voeg toe: gegevens aanvullen, prospectreis met fase, eerste taak met contact en een accountplan', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/leadgenerator')
    const kaart = page.locator('article[data-lead]').filter({ has: page.getByTestId('voeg-toe') }).first()
    const naam = (await kaart.getAttribute('data-lead'))!
    await kaart.getByTestId('voeg-toe').click()
    const fo = page.getByTestId('voeg-toe-flyout')
    await expect(fo).toBeVisible()
    await expect(fo.getByTestId('vt-naam')).toHaveValue(naam)
    await fo.getByTestId('vt-telefoon').fill('030 123 4567')
    await fo.getByTestId('vt-contact-erbij').click()
    const n = await fo.locator('fieldset[data-test^="vt-contact-"]').count()
    await fo.getByTestId(`vt-contact-naam-${n - 1}`).fill('Testcontact Voegtoe')
    // Keuze 1: prospectreis met reis en fase.
    await expect(fo.getByTestId('vt-reis-aan')).toBeChecked()
    await fo.getByTestId('vt-reis').selectOption({ index: 1 })
    const fase = fo.getByTestId('vt-fase')
    await expect(fase).toBeVisible()
    await fase.selectOption({ index: 2 })
    const faseLabel = (await fase.locator('option:checked').textContent())!.trim()
    // Keuze 2: eerste taak met type, datum en contact.
    await expect(fo.getByTestId('vt-taak-aan')).toBeChecked()
    await fo.getByTestId('vt-taak-type').selectOption('mailen')
    await expect(fo.getByTestId('vt-taak-datum')).toBeVisible()
    await fo.getByTestId('vt-taak-contact').selectOption({ label: 'Testcontact Voegtoe' })
    // Keuze 3: accountplan (Eva is Expert, accountplannen staan aan).
    await fo.getByTestId('vt-accountplan').check()
    await fo.getByTestId('vt-opslaan').click()
    const melding = page.getByTestId('toegevoegd-melding')
    await expect(melding).toContainText(`${naam} staat nu bij je prospects`)
    await expect(melding).toContainText('accountplan')
    const href = (await melding.getByTestId('toegevoegd-open').getAttribute('href'))!
    expect(href).toMatch(/^\/accounts\/[0-9a-f-]{36}$/)
    await expect(melding.getByTestId('toegevoegd-plan')).toBeVisible()
    const id = href.split('/').pop()!
    const acc = await (await page.request.get(`/api/accounts/${id}`)).json()
    expect(acc.reis?.fase?.label).toBe(faseLabel)
    const tab = await (await page.request.get(`/api/accounts/${id}/tabbladen`)).json()
    const taak = (tab.taken ?? []).find((t: any) => t.actionType === 'mailen')
    expect(taak).toBeTruthy()
    expect(taak.contactNaam ?? '').toContain('Voegtoe')
    const plannen = await (await page.request.get(`/api/accountplannen?accountId=${id}`)).json()
    expect(JSON.stringify(plannen)).toContain(`Accountplan ${naam}`)
    await melding.getByTestId('toegevoegd-open').click()
    await page.waitForURL(new RegExp(`/accounts/${id}`))
  })

  test('Voeg toe zonder reis en zonder taak; zonder accountplannen geen vinkje (Gevorderd)', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator')
    const kaart = page.locator('article[data-lead]').filter({ has: page.getByTestId('voeg-toe') }).first()
    const naam = (await kaart.getAttribute('data-lead'))!
    await kaart.getByTestId('voeg-toe').click()
    const fo = page.getByTestId('voeg-toe-flyout')
    await expect(fo.getByTestId('vt-accountplan')).toHaveCount(0)
    await fo.getByTestId('vt-reis-aan').uncheck()
    await expect(fo.getByTestId('vt-zonder-reis')).toBeVisible()
    await fo.getByTestId('vt-taak-aan').uncheck()
    await expect(fo.getByTestId('vt-taak-type')).toHaveCount(0)
    await fo.getByTestId('vt-opslaan').click()
    const melding = page.getByTestId('toegevoegd-melding')
    await expect(melding).toContainText('Zonder eerste taak')
    const id = (await melding.getByTestId('toegevoegd-open').getAttribute('href'))!.split('/').pop()!
    const acc = await (await page.request.get(`/api/accounts/${id}`)).json()
    expect(acc.reis).toBeNull()
    const tab = await (await page.request.get(`/api/accounts/${id}/tabbladen`)).json()
    expect((tab.taken ?? []).filter((t: any) => t.status === 'open')).toHaveLength(0)
    expect(naam).toBeTruthy()
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
  test('390 px: de flyout Voeg toe past, met tikdoelen van 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    await ga(page, '/leadgenerator')
    const knop = page.getByTestId('voeg-toe').first()
    test.skip(!(await knop.count()), 'Geen lead om toe te voegen')
    await knop.click()
    const fo = page.getByTestId('voeg-toe-flyout')
    await expect(fo).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    for (const t of ['vt-opslaan', 'vt-reis-aan', 'vt-taak-type']) {
      const el = t === 'vt-reis-aan' ? fo.locator('label', { has: page.getByTestId(t) }) : fo.getByTestId(t)
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })
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
