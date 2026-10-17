import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// Accountplannen (Expert) in de opzet van DealDrive: overzicht met Actueel en Verlopen en afgerond en filters,
// de flyout van een plan (kop, kerngegevens, contactpersonen met rol, blokken, actieplan en de voet), een nieuw
// plan met alle secties waarvan de acties taken worden, wijzigen, afronden en verwijderen, de detailpagina met
// tabbladen, 1280 en 390 px, de ingang op de accountkaart, en Beginner en Gevorderd zien de functie niet.
test.describe('accountplannen', () => {
  // De dev-server wordt gedeeld; het laden van een plan krijgt wat ruimte.
  test.describe.configure({ timeout: 90_000 })
  test('overzicht: kop, kaart in Actueel en een lege groep Verlopen en afgerond', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await expect(page.getByText(/Accountplannen · \d+ actueel/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Eén plan per topprospect, elke stap aanwijsbaar.' })).toBeVisible()
    await expect(page.getByTestId('kop-zoeken')).toBeVisible()
    const kaart = page.getByTestId('ap-groep-actueel').getByTestId('ap-kaart-eva-plan-01')
    await expect(kaart).toContainText('Prospect')
    await expect(kaart).toContainText('Actueel')
    await expect(kaart).toContainText('Testtechniek Leusden')
    await expect(kaart).toContainText('Geldig:')
    await expect(kaart).toContainText('acties')
    await expect(kaart.getByTestId('ap-open-eva-plan-01')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    await expect(page.getByTestId('ap-groep-historie')).toBeVisible()
    // De zijbalk: Accountplannen in Planning.
    await expect(page.locator('.sb-groep[data-groep="Planning"] .sb-link[data-sleutel="nav.accountplannen"]')).toHaveAttribute('href', '/accountplannen')
  })

  test('flyout volgens de opzet: kop, kerngegevens, contactpersonen met rol, blokken, actieplan en de voet', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await page.getByTestId('ap-kaart-eva-plan-01').getByRole('button').click()
    const f = page.getByTestId('ap-flyout')
    await expect(f).toBeVisible()
    await expect(f).toContainText('Accountplan')
    await expect(f.getByTestId('apf-status')).toHaveText('Actueel', { timeout: 15_000 })
    await expect(f.getByTestId('apf-account')).toHaveAttribute('href', '/accounts/eva-a07')
    await expect(f.getByTestId('apf-periode')).toContainText('t/m')
    // Kerngegevens: eigenaar, geldigheid en "x van y klaar", met Markeer als afgerond.
    const kern = f.getByTestId('apf-kern')
    for (const t of ['Eigenaar', 'Geldigheid', 'Actieplan']) await expect(kern).toContainText(t)
    await expect(kern.getByTestId('apf-voortgang')).toHaveText(/\d+ van \d+ klaar/)
    await expect(kern.getByTestId('apf-afronden')).toHaveText('Markeer als afgerond')
    // Contactpersonen met hun rol.
    const cp = f.getByTestId('apf-blok-contacten')
    await expect(cp.getByTestId('apf-contact-eva-a07-c1')).toContainText('Corine Testleusden')
    await expect(cp.getByTestId('apf-contact-eva-a07-c1')).toContainText('Beslisser')
    for (const t of ['Klantinformatie', 'Doelstellingen (SMART)', 'Kansen', 'Bedreigingen', 'Strategieën', 'Evaluatie', 'Actieplan']) await expect(f).toContainText(t)
    await expect(f.locator('[data-test^="apf-actie-eva-tplan"]')).toHaveCount(3)
    // De voet: Verwijderen, Wijzigen, Open accountplan en Sluiten.
    await expect(f.getByTestId('apf-verwijder')).toHaveText('Verwijderen')
    await expect(f.getByTestId('apf-wijzig')).toHaveText('Wijzigen')
    await expect(f.getByTestId('apf-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    await f.getByTestId('apf-sluiten').click()
    await expect(f).toBeHidden()
    await expect(page).not.toHaveURL(/plan=/)
  })

  test('nieuw plan met alle secties: contactpersonen, blokken, voorzet, acties die taken worden; wijzigen, afronden en verwijderen', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await page.getByTestId('ap-nieuw').click()
    const n = page.getByTestId('ap-nieuw-flyout')
    await n.getByTestId('apn-zoek').fill('Testvloer Houten')
    await n.getByTestId('apn-kies-eva-a09').click()
    await expect(n.getByTestId('apn-gekozen')).toContainText('Testvloer Houten')
    const titel = `E2E plan ${crypto.randomUUID().slice(0, 6)}`
    await n.getByTestId('apn-titel').fill(titel)
    await n.getByTestId('apn-van').fill('2026-01-01')
    await n.getByTestId('apn-tot').fill('2026-12-31')
    // Contactpersonen uit het account, met hun rol.
    await n.getByTestId('apn-contact-kies').selectOption('eva-a09-c1')
    await n.getByTestId('apn-contact-kies').selectOption('eva-a09-c2')
    await expect(n.getByTestId('apn-contact-eva-a09-c1')).toContainText('Beslisser')
    await expect(n.getByTestId('apn-contact-eva-a09-c2')).toContainText('Champion')
    // De zes stappen.
    for (const nr of [1, 2, 3, 4, 5, 6]) await expect(n.getByTestId(`apn-stap-${nr}`)).toBeVisible()
    await n.getByTestId('apn-veld-klantinformatie').fill('Vloerenbedrijf in Houten met twintig mensen.')
    await n.getByTestId('apn-veld-doelstellingen').fill('Voor 1 juli een eerste project binnen.')
    await n.getByTestId('apn-veld-bedreigingen').fill('De huidige leverancier is goedkoper.')
    await n.getByTestId('apn-veld-strategieen').fill('Eerst de projectleider, dan de directeur.')
    await n.getByTestId('apn-veld-evaluatie').fill('Nog niet van toepassing.')
    // Een voorzet van de Pitstop is een voorstel: pas na Overnemen staat hij in het veld.
    await n.getByTestId('apv-vraag-kansen').click()
    await expect(n.getByTestId('apv-voorstel-kansen')).toContainText('Gebaseerd op')
    await expect(n.getByTestId('apn-veld-kansen')).toHaveValue('')
    await n.getByTestId('apv-neem-kansen').click()
    await expect(n.getByTestId('apn-veld-kansen')).not.toHaveValue('')
    // Twee acties; de eerste met een contactpersoon.
    await n.getByTestId('apn-actie-titel').fill('Kennismaking plannen met Els')
    await n.getByTestId('apn-actie-datum').fill('2026-11-12')
    await n.getByTestId('apn-actie-contact').selectOption('eva-a09-c1')
    await n.getByTestId('apn-actie-toevoegen').click()
    await n.getByTestId('apn-actie-titel').fill('Referentieproject laten zien')
    await expect(n.getByTestId('apn-acties').locator('li')).toHaveCount(1)
    await n.getByTestId('apn-maak').click()

    // Het nieuwe plan opent in de flyout.
    const f = page.getByTestId('ap-flyout')
    await expect(f.locator('#apf-titel')).toHaveText(titel, { timeout: 15_000 })
    await expect(page).toHaveURL(/plan=/)
    const planId = new URL(page.url()).searchParams.get('plan')!
    await expect(f.getByTestId('apf-blok-klantinformatie')).toContainText('Vloerenbedrijf in Houten')
    await expect(f.getByTestId('apf-blok-kansen')).not.toContainText('Waar zit groei')
    await expect(f.getByTestId('apf-contact-eva-a09-c2')).toContainText('Joost Testhouten')
    await expect(f.getByTestId('apf-voortgang')).toHaveText('0 van 2 klaar')
    // De acties zijn echte taken op het account.
    const tabs = await (await page.request.get('/api/accounts/eva-a09/tabbladen')).json()
    const taak = tabs.taken.find((t: any) => (t.titel ?? t.title) === 'Kennismaking plannen met Els')
    expect(taak).toBeTruthy()
    expect(taak.contactId).toBe('eva-a09-c1')
    expect(tabs.taken.some((t: any) => (t.titel ?? t.title) === 'Referentieproject laten zien')).toBe(true)
    // Per contact: de plannen waar Els in staat.
    const perContact = await (await page.request.get('/api/contacten/eva-a09-c1/accountplannen')).json()
    expect(perContact.plannen.some((p: any) => p.id === planId && p.alsContactpersoon && p.acties.length === 1)).toBe(true)

    // Afvinken in de flyout.
    await f.locator('[data-test^="apf-actie-"]').filter({ hasText: 'Kennismaking plannen met Els' }).getByTestId('apf-vink').check()
    await expect(f.getByTestId('apf-voortgang')).toHaveText('1 van 2 klaar')
    // Wijzigen: een contact eraf en de evaluatie bijwerken.
    await f.getByTestId('apf-wijzig').click()
    await f.getByTestId('apf-blok-contacten').getByRole('button', { name: /Haal Joost Testhouten/ }).click()
    await f.getByTestId('apf-veld-evaluatie').fill('Eerste gesprek gevoerd, project in voorbereiding.')
    await f.getByTestId('apf-bewaar').click()
    await expect(f.getByTestId('apf-blok-evaluatie')).toContainText('Eerste gesprek gevoerd')
    await expect(f.getByTestId('apf-contact-eva-a09-c2')).toHaveCount(0)
    // Afronden (evaluatie staat er, dus geen vraag) en weer heropenen.
    await f.getByTestId('apf-afronden').click()
    await expect(f.getByTestId('apf-status')).toHaveText('Afgerond')
    await expect(page.getByTestId('ap-groep-historie').getByTestId(`ap-kaart-${planId}`)).toBeVisible()
    await f.getByTestId('apf-afronden').click()
    await expect(f.getByTestId('apf-status')).toHaveText('Actueel')
    // Verwijderen vraagt eerst; de taken blijven staan.
    await f.getByTestId('apf-verwijder').click()
    await page.getByTestId('bevestig').click()
    await expect(f).toBeHidden()
    await expect(page.getByTestId(`ap-kaart-${planId}`)).toHaveCount(0)
    const na = await (await page.request.get('/api/accounts/eva-a09/tabbladen')).json()
    expect(na.taken.some((t: any) => (t.titel ?? t.title) === 'Referentieproject laten zien')).toBe(true)
    // Opruimen: de taken van deze test annuleren.
    for (const t of na.taken.filter((t: any) => ['Kennismaking plannen met Els', 'Referentieproject laten zien'].includes(t.titel ?? t.title))) await page.request.post(`/api/tasks/${t.id}/annuleren`, { data: { reden: 'Opruimen na de e2e-test' } })
  })

  test('filters: status en alleen mijn plannen', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await page.getByTestId('ap-filters').click()
    await page.getByTestId('ap-filter-afgerond').click()
    await expect(page).toHaveURL(/status=afgerond/)
    await expect(page.getByTestId('ap-kaart-eva-plan-01')).toHaveCount(0)
    await page.getByTestId('ap-filter-actueel').click()
    await expect(page.getByTestId('ap-kaart-eva-plan-01')).toBeVisible()
    await page.getByTestId('ap-filter-mij').click()
    await expect(page).toHaveURL(/van=mij/)
    await expect(page.getByTestId('ap-kaart-eva-plan-01')).toBeVisible()
  })

  test('detailpagina: blok, actie wordt een taak, tabbladen, notitie, afronden met vraag en verwijderen', async ({ page }) => {
    await login(page, 'u-07')
    const p = await (await page.request.post('/api/accountplannen', { data: { accountId: 'eva-a09', titel: `E2E pagina ${crypto.randomUUID().slice(0, 6)}`, contactIds: ['eva-a09-c1'] } })).json()
    await ga(page, `/accountplannen/${p.id}`)
    await expect(page.getByTestId('apd-titel')).toHaveText(p.titel)

    await page.getByTestId('apd-bewerk-kansen').click()
    await page.getByTestId('apd-tekst-kansen').fill('Twee nieuwbouwprojecten in de regio.')
    await page.getByTestId('apd-bewaar-kansen').click()
    await expect(page.getByTestId('apd-blok-kansen')).toContainText('Twee nieuwbouwprojecten in de regio.')

    await page.getByTestId('apd-actie-titel').fill('Projectschouw plannen met de directeur')
    await page.getByTestId('apd-actie-datum').fill('2026-11-12')
    await page.getByTestId('apd-actie-contact').selectOption('eva-a09-c1')
    await page.getByTestId('apd-actie-toevoegen').click()
    const rij = page.getByTestId('apd-actieplan').locator('[data-test^="apd-actie-"]').filter({ hasText: 'Projectschouw plannen' })
    await expect(rij).toContainText('Els Testhouten')
    await expect(page.getByTestId('apd-voortgang')).toContainText('0 van 1 acties klaar')
    const tabs = await (await page.request.get('/api/accounts/eva-a09/tabbladen')).json()
    const taak = tabs.taken.find((t: any) => (t.titel ?? t.title) === 'Projectschouw plannen met de directeur')
    expect(taak?.contactId).toBe('eva-a09-c1')
    await rij.getByTestId('apd-vink').check()
    await expect(page.getByTestId('apd-voortgang')).toContainText('1 van 1 acties klaar')

    // Tabbladen: contactpersonen met rol, taken, afspraken en notities.
    await page.getByTestId('apd-tab-contacten').click()
    await expect(page).toHaveURL(/tab=contacten/)
    await expect(page.getByTestId('apdc-contact-eva-a09-c1')).toContainText('Els Testhouten')
    await expect(page.getByTestId('apdc-rol-eva-a09-c1')).toHaveValue('beslisser')
    await page.getByTestId('apd-tab-taken').click()
    await expect(page.getByTestId('apd-tab-taken-inhoud')).toBeVisible()
    await page.getByTestId('apd-tab-afspraken').click()
    await expect(page.getByTestId('apd-tab-afspraken-inhoud')).toBeVisible()
    await page.getByTestId('apd-tab-notities').click()
    await page.getByTestId('apd-notitie-tekst').fill('De directeur wil eerst een referentie zien.')
    await page.getByTestId('apd-notitie-bewaar').click()
    await expect(page.getByTestId('apd-tab-notities-inhoud')).toContainText('De directeur wil eerst een referentie zien.')

    // Afronden zonder evaluatie vraagt eerst.
    await page.getByTestId('apd-afronden').click()
    await expect(page.getByText('De evaluatie is nog leeg')).toBeVisible()
    await page.getByTestId('bevestig').click()
    await expect(page.getByTestId('apd-status')).toHaveText('Afgerond')

    // Opruimen: de actie uit het plan (taak geannuleerd) en het plan weg.
    await page.getByTestId('apd-tab-plan').click()
    await rij.getByRole('button', { name: /Verwijder actie/ }).click()
    await page.getByTestId('bevestig').click()
    await expect(page.getByTestId('apd-voortgang')).toContainText('0 van 0 acties klaar')
    await page.getByTestId('apd-verwijder').click()
    await page.getByTestId('bevestig').click()
    await page.waitForURL(/\/accountplannen$/)
    await expect(page.getByTestId(`ap-kaart-${p.id}`)).toHaveCount(0)
  })

  for (const breedte of [1280, 390]) {
    test(`flyout en nieuw plan op ${breedte} px: geen horizontale scroll, tikdoelen`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
      await login(page, 'u-07')
      await ga(page, '/accountplannen?plan=eva-plan-01')
      const f = page.getByTestId('ap-flyout')
      await expect(f.getByTestId('apf-status')).toBeVisible({ timeout: 15_000 })
      const geenScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await geenScroll()
      for (const t of ['apf-verwijder', 'apf-wijzig', 'apf-open', 'apf-sluiten']) {
        const box = (await f.getByTestId(t).boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(breedte)
        if (breedte < 500) expect(box.height).toBeGreaterThanOrEqual(44)
      }
      await f.getByTestId('apf-sluiten').click()
      await page.getByTestId('ap-nieuw').click()
      const n = page.getByTestId('ap-nieuw-flyout')
      await expect(n.getByTestId('apn-stap-5')).toBeVisible()
      await geenScroll()
      if (breedte < 500) expect((await n.getByTestId('apn-maak').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    })
  }

  test('accountkaart: de plannen van het account en + Accountplan met het account ingevuld', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a07')
    // Accountplan staat onder Meer, direct na Campagnes; het tabblad is weg.
    await expect(page.getByTestId('tab-accountplan')).toHaveCount(0)
    await page.getByTestId('kop-meer').click()
    const ids = await page.getByTestId('meer-flyout').locator('.mf-kader').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    expect(ids.indexOf('meer-accountplan')).toBe(ids.indexOf('meer-campagnes') + 1)
    await expect(page.getByTestId('meer-accountplan').locator('.mf-regel')).toContainText(/\d+ van \d+ acties klaar/)
    await page.getByTestId('meer-accountplan').click()
    const blok = page.getByTestId('accountplan-flyout').getByTestId('ak-accountplannen')
    await expect(blok.getByTestId('ak-accountplan-eva-plan-01')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    // Het lopende plan: samenvatting, acties met de voortgang en de link naar het plan.
    await expect(blok.getByTestId('apt-lopend')).toContainText('Lopend accountplan')
    await expect(blok.getByTestId('apt-voortgang')).toContainText(/\d+ van \d+ acties klaar/)
    await expect(blok.getByTestId('apt-samenvatting')).toBeVisible()
    await expect(blok.getByTestId('apt-acties').locator('li').first()).toBeVisible()
    await expect(blok.getByTestId('apt-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    await blok.getByTestId('ak-accountplan-nieuw').click()
    await expect(page.getByTestId('apn-gekozen')).toContainText('Testtechniek Leusden')
  })

  test('accountkaart: lege staat met Maak accountplan; zonder de functie geen kader', async ({ page }) => {
    await login(page, 'u-07')
    const naam = `${crypto.randomUUID().slice(0, 10)} Planloos`
    const a = await (await page.request.post('/api/accounts', { data: { naam } })).json()
    // Een oude link naar het tabblad opent het venster Accountplan.
    await ga(page, `/accounts/${a.id}?tab=accountplan`)
    const blok = page.getByTestId('accountplan-flyout').getByTestId('ak-accountplannen')
    await expect(blok.getByTestId('apt-leeg')).toContainText('Nog geen accountplan')
    await blok.getByTestId('ak-accountplan-nieuw').click()
    await expect(page.getByTestId('apn-gekozen')).toContainText(naam)
    // Een Gevorderde heeft geen accountplannen en dus geen kader Accountplan.
    await login(page, 'u-01')
    await ga(page, '/accounts/pr-06')
    await page.getByTestId('kop-meer').click()
    await expect(page.getByTestId('meer-flyout').getByTestId('meer-campagnes')).toBeVisible()
    await expect(page.getByTestId('meer-flyout').getByTestId('meer-accountplan')).toHaveCount(0)
  })

  test('een plan is voor een topprospect: geen + Accountplan bij een klant, de API weigert een klant, de zoeker toont alleen prospects', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-k01?meer=accountplan')
    const blok = page.getByTestId('accountplan-flyout').getByTestId('ak-accountplannen')
    await expect(blok).toContainText('Een plan voor een klant maak je in DealDrive.')
    await expect(blok.getByTestId('ak-accountplan-nieuw')).toHaveCount(0)
    const r = await page.request.post('/api/accountplannen', { data: { accountId: 'eva-k01', titel: 'Plan voor een klant' } })
    expect(r.status()).toBe(422)
    const treffers = await (await page.request.get('/api/accounts/kies', { params: { q: 'Testwarmte', soort: 'prospect' } })).json()
    expect(treffers.some((t: any) => t.id === 'eva-k01')).toBe(false)
  })

  for (const [id, niveau] of [['u-02', 'Beginner'], ['u-01', 'Gevorderd']] as const) {
    test(`${niveau} ziet Accountplannen niet`, async ({ page }) => {
      await login(page, id)
      await expect(page.locator('.sb-groep .sb-link:not(.sb-link--slot)[data-sleutel="nav.accountplannen"]')).toHaveCount(0)
      await ga(page, '/accountplannen')
      await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
      expect((await page.request.get('/api/accountplannen', { timeout: 30_000 })).status()).toBe(403)
    })
  }
})
