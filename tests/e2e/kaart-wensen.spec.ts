// Wensen voor de accountkaart en de contactkaart (okt 2026), op 1280 en 390 px:
// 1. Info als eigen knop in de kop van de accountkaart, tussen Contacten en Meer.
// 2. Vanuit Meer terug naar Meer: de knop "Meer" in de kop en Escape gaan terug, het kruisje sluit alles.
// 3. Het Dossier heeft geen blok "Bronnen om te volgen" meer.
// 4. BAND uit de gespreksverslagen: per letter een voorstel met herkomst, te bevestigen, bewerken of verwerpen.
// 5. Geen venster Ritme meer: Zet nee, Pauzeer en Terugkomdatum staan in het venster Reis.
// 6. Campagnes en Accountplan onder Meer in plaats van als tabblad.
// 7. Contactkaart: Info in de kop in plaats van Account; geen Info en Bel in Meer; geen "Account ·" in de stuurstrip.
// 8. Contactkaart: de metaregel noemt het contact zelf niet, wel de gebruiker.
// 9. Contactkaart: het accountplan waarin het contact staat, onder Meer met een link naar het plan.
import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ timeout: 180_000 })

const geenScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
const kopKnoppen = (page: Page, kop: string) => page.locator(`${kop} [data-test]:not([data-test=kop-iconen]):visible`).evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-test'), h: Math.round(e.getBoundingClientRect().height) })))

for (const breedte of [1280, 390]) {
  test.describe(`${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte === 390 ? 844 : 900 } })

    test('accountkaart: Info in de kop, terug naar Meer, geen Ritme, geen Bronnen om te volgen', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/accounts/eva-a04')
      // 1. Info tussen Contacten en Meer.
      const kop = await kopKnoppen(page, '.ak-acties')
      const ids = kop.map((k) => k.id)
      expect(ids.indexOf('info-knop')).toBe(ids.indexOf('contacten-knop') + 1)
      expect(ids.indexOf('kop-meer')).toBe(ids.indexOf('info-knop') + 1)
      expect(kop.every((k) => k.h >= 44)).toBe(true)
      await geenScroll(page)
      await page.getByTestId('info-knop').click()
      const info = page.getByTestId('info-flyout')
      await expect(info).toBeVisible()
      // Niet vanuit Meer geopend: geen terugknop.
      await expect(info.getByTestId('fs-terug')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(info).toHaveCount(0)

      // 2. Dossier vanuit Meer: terug met de knop Meer.
      await page.getByTestId('kop-meer').click()
      const meer = page.getByTestId('meer-flyout')
      await expect(meer.getByTestId('info-knop')).toHaveCount(0)
      await expect(meer.getByTestId('meer-ritme')).toHaveCount(0)
      await meer.getByTestId('meer-dossier').click()
      const dossier = page.getByTestId('dossier-flyout')
      await expect(dossier.getByTestId('dossier')).toBeVisible()
      // 3. Geen Bronnen om te volgen.
      await expect(dossier.getByTestId('bronnen-volgen')).toHaveCount(0)
      await expect(dossier).not.toContainText('Bronnen om te volgen')
      const terug = dossier.getByTestId('fs-terug')
      await expect(terug).toHaveText('Meer')
      if (breedte === 390) expect((await terug.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await geenScroll(page)
      await terug.click()
      await expect(dossier).toHaveCount(0)
      await expect(meer).toBeVisible()
      // Escape in Kwalificatie brengt je ook terug naar Meer.
      await meer.getByTestId('meer-kwalificatie').click()
      await expect(page.getByTestId('kwalificatie-flyout')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('kwalificatie-flyout')).toHaveCount(0)
      await expect(meer).toBeVisible()
      // 5. Reis heeft het ritme; het kruisje sluit alles.
      await meer.getByTestId('meer-reis').click()
      const reis = page.getByTestId('reis-flyout')
      await expect(reis.getByTestId('reis-blok')).toBeVisible()
      await expect(reis.getByTestId('ritme')).toBeVisible()
      await reis.getByTestId('reis-flyout-sluit').click()
      await expect(reis).toHaveCount(0)
      await expect(meer).toHaveCount(0)
    })

    test('accountkaart: Zet nee en Terugkomdatum in het venster Reis; ?meer=ritme opent Reis', async ({ page }) => {
      await login(page, 'u-07')
      const a = await (await page.request.post('/api/accounts', { data: { naam: `${crypto.randomUUID().slice(0, 10)} Ritmeloos` } })).json()
      await ga(page, `/accounts/${a.id}?meer=ritme`)
      const reis = page.getByTestId('reis-flyout')
      await expect(reis.getByTestId('ritme')).toBeVisible()
      await expect(reis.getByTestId('zet-nee-knop')).toBeVisible()
      await expect(page.getByTestId('ritme-flyout')).toHaveCount(0)
      await reis.getByTestId('zet-nee-knop').click()
      await expect(page.getByTestId('zet-nee')).toBeVisible()
      await geenScroll(page)
    })

    test('accountkaart: Campagnes en Accountplan onder Meer, niet als tabblad', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/accounts/eva-a07')
      for (const t of ['campagnes', 'accountplan']) await expect(page.getByTestId(`tab-${t}`)).toHaveCount(0)
      await page.getByTestId('kop-meer').click()
      const meer = page.getByTestId('meer-flyout')
      await meer.getByTestId('meer-campagnes').click()
      const camp = page.getByTestId('campagnes-flyout')
      await expect(camp.getByTestId('kaart-campagnes')).toBeVisible()
      await camp.getByTestId('fs-terug').click()
      await meer.getByTestId('meer-accountplan').click()
      const plan = page.getByTestId('accountplan-flyout')
      await expect(plan.getByTestId('apt-lopend')).toBeVisible()
      await expect(plan.getByTestId('apt-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
      await geenScroll(page)
    })

    test('contactkaart: Info in de kop, geen Account, geen Info en Bel in Meer, metaregel zonder het contact, accountplan van het account onder Meer', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/contacten/eva-a07-c1')
      // 7. Info staat waar Account stond; geen "Account ·" in de stuurstrip.
      await expect(page.getByTestId('kop-account')).toHaveCount(0)
      const kop = await kopKnoppen(page, '.ck-acties')
      expect(kop.map((k) => k.id).slice(-2)).toEqual(['contact-info-knop', 'kop-meer'])
      expect(kop.every((k) => k.h >= 44)).toBe(true)
      if (breedte === 1280) await expect(page.getByTestId('stuurstrip')).not.toContainText('Account')
      await geenScroll(page)
      // 8. De metaregel noemt het contact zelf niet, wel wie het deed.
      await expect(page.getByTestId('tijdlijn').getByTestId('item-meta').first()).toBeVisible()
      await expect(page.getByTestId('tijdlijn').getByTestId('tl-contact')).toHaveCount(0)
      await expect(page.getByTestId('tijdlijn').getByTestId('tl-door').first()).toHaveText(/^door \S+/)
      await page.getByTestId('contact-info-knop').click()
      await expect(page.getByTestId('contact-info-flyout')).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByTestId('kop-meer').click()
      const meer = page.getByTestId('meer-flyout')
      for (const id of ['contact-info-knop', 'bel-knop', 'meer-ritme']) await expect(meer.getByTestId(id)).toHaveCount(0)
      await expect(meer.getByTestId('meer-campagnes')).toBeVisible()
      // 9. Accountplan onder Meer: het plan van het account (zoals op de accountkaart) en het plan waarin dit contact staat.
      await expect(meer.getByTestId('meer-accountplan').locator('.mf-regel')).toContainText(/\d+ van \d+ acties klaar/)
      await meer.getByTestId('meer-accountplan').click()
      await expect(page.getByTestId('accountplan-flyout').getByTestId('apt-lopend')).toBeVisible()
      await expect(page.getByTestId('accountplan-flyout').getByTestId('apt-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
      const plan = page.getByTestId('accountplan-flyout').getByTestId('contact-accountplan-eva-plan-01')
      await expect(plan).toContainText('contactpersoon')
      await expect(plan.getByTestId('contact-accountplan-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
      await page.getByTestId('accountplan-flyout').getByTestId('fs-terug').click()
      await expect(meer).toBeVisible()
      await geenScroll(page)
      // Een contact dat zelf in geen plan staat, heeft toch het kader Accountplan: het plan van zijn account.
      await ga(page, '/contacten/eva-a08-c1')
      await page.getByTestId('kop-meer').click()
      await expect(page.getByTestId('meer-flyout').getByTestId('meer-campagnes')).toBeVisible()
      await page.getByTestId('meer-flyout').getByTestId('meer-accountplan').click()
      await expect(page.getByTestId('accountplan-flyout').getByTestId('ak-accountplannen')).toBeVisible()
      await expect(page.getByTestId('accountplan-flyout').getByTestId('contact-accountplannen')).toHaveCount(0)
    })

    test('kwalificatie: BAND uit het belverslag als voorstel, bevestigen, bewerken en verwerpen; handmatig blijft leidend', async ({ page }) => {
      await login(page, 'u-07')
      const a = await (await page.request.post('/api/accounts', { data: { naam: `${crypto.randomUUID().slice(0, 10)} Bandtest` } })).json()
      // Behoefte met de hand: die letter krijgt geen voorstel.
      expect((await page.request.put(`/api/accounts/${a.id}/band`, { data: { letter: 'behoefte', ja: true } })).ok()).toBe(true)
      const taak = await (await page.request.post('/api/tasks', { data: { title: 'Bel over de levering', actionType: 'bellen', accountId: a.id } })).json()
      await page.request.put(`/api/tasks/${taak.id}/verslag`, { data: { tekst: 'De directeur beslist zelf over de keuze. Ze hebben budget vrijgemaakt. Ze willen starten voor de zomer.' } })
      const an = await page.request.post(`/api/tasks/${taak.id}/analyse`)
      expect(an.ok()).toBe(true)
      expect((await an.json()).ok).toBe(true)

      await ga(page, `/accounts/${a.id}?meer=kwalificatie`)
      const kw = page.getByTestId('kwalificatie-flyout')
      const blok = kw.getByTestId('band-voorstellen')
      await expect(blok).toBeVisible()
      await expect(blok.getByTestId('band-voorstel-behoefte')).toHaveCount(0)
      // Niets is vanzelf ingevuld.
      await expect(kw.getByTestId('band-draagvlak')).not.toBeChecked()
      const draagvlak = blok.getByTestId('band-voorstel-draagvlak')
      await expect(draagvlak).toContainText('budget')
      await expect(draagvlak.getByTestId('band-voorstel-bron')).toContainText(/Gebaseerd op Belverslag \d{1,2} \w+ \d{4} · Bel over de levering/)
      if (breedte === 390) for (const k of ['band-voorstel-bevestig', 'band-voorstel-bewerk-knop', 'band-voorstel-verwerp']) expect((await draagvlak.getByTestId(k).boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await geenScroll(page)
      // Bevestigen: de letter staat aan, met de herkomst.
      await draagvlak.getByTestId('band-voorstel-bevestig').click()
      await expect(kw.getByTestId('band-draagvlak')).toBeChecked()
      await expect(kw.getByTestId('band-herkomst-draagvlak')).toContainText('Gebaseerd op Belverslag')
      await expect(blok.getByTestId('band-voorstel-draagvlak')).toHaveCount(0)
      // Verwerpen: het voorstel is weg en de letter blijft leeg.
      await blok.getByTestId('band-voorstel-autoriteit').getByTestId('band-voorstel-verwerp').click()
      await expect(blok.getByTestId('band-voorstel-autoriteit')).toHaveCount(0)
      await expect(kw.getByTestId('band-autoriteit')).not.toBeChecked()
      // Bewerken: nee met een eigen toelichting.
      const noodzaak = blok.getByTestId('band-voorstel-noodzaak')
      await noodzaak.getByTestId('band-voorstel-bewerk-knop').click()
      await noodzaak.getByTestId('band-voorstel-nee').check()
      await noodzaak.getByTestId('band-voorstel-toelichting').fill('Starten pas na de zomer')
      await noodzaak.getByTestId('band-voorstel-bewaar').click()
      await expect(kw.getByTestId('band-herkomst-noodzaak')).toContainText('Starten pas na de zomer')
      await expect(kw.getByTestId('band-noodzaak')).not.toBeChecked()
      const band = (await (await page.request.get(`/api/accounts/${a.id}`)).json()).band
      expect(band.behoefte.bron).toBe('hand')
      expect(band.draagvlak).toMatchObject({ ja: true, herkomst: { soort: 'taak', id: taak.id } })
      expect(band.noodzaak).toMatchObject({ ja: false, toelichting: 'Starten pas na de zomer' })
      expect(band.autoriteit).toBeUndefined()
      expect((await (await page.request.get(`/api/accounts/${a.id}/band-voorstel`)).json()).voorstellen).toEqual([])
    })
  })
}
