import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// Transcript en gespreksverslag bij een beltaak (taakvenster, hetzelfde blok als in het afspraakvenster)
// en Type afspraak in twee groepen (Afspraak en Meeting) waarbij de vorm uit het type volgt.
const dagOver = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

test.describe('beltaak: transcript en gespreksverslag', () => {
  test('transcript uploaden, verslag schrijven, analyse en het verslag op de contactkaart', async ({ page }) => {
    const titel = `Bel over de levering ${Date.now().toString(36)}`
    await apiLogin(page.request, 'u-07')
    const r = await page.request.post('/api/tasks', { data: { title: titel, actionType: 'bellen', accountId: 'eva-a08', contactId: 'eva-a08-c1' } })
    expect(r.ok()).toBe(true)
    const { id } = await r.json()

    await ga(page, `/taken?taak=${id}`)
    const blok = page.getByTestId('tf-verslagblok')
    await expect(blok).toContainText('Transcript en gespreksverslag')
    await expect(page.getByTestId('tf-analyseer')).toBeDisabled()

    // Een Zoom-transcript (.srt): beurten met spreker, zonder tijdcodes.
    const srt = '1\n00:00:01,000 --> 00:00:04,000\nKlant: Volgend voorjaar bouwen we een nieuwe hal.\n\n2\n00:00:04,500 --> 00:00:07,000\nVerkoper: Dan stuur ik het leverplan voor de hal op.\n'
    await page.getByTestId('tf-transcript-bestand').setInputFiles({ name: 'zoom-gesprek.srt', mimeType: 'text/plain', buffer: Buffer.from(srt) })
    await expect(page.getByTestId('tf-transcript-tekst')).toHaveValue('Klant: Volgend voorjaar bouwen we een nieuwe hal.\nVerkoper: Dan stuur ik het leverplan voor de hal op.')
    await page.getByTestId('tf-transcript-bewaar').click()
    await expect(page.getByTestId('tf-transcript')).toContainText('zoom-gesprek.srt')

    // Het verslag schrijven en bewaren.
    await blok.getByTestId('vv-tekst').fill('Kort belgesprek over de levering op de bouwplaats. Ze hebben budget voor volgend jaar en willen een offerte.')
    await page.getByTestId('tf-verslag-bewaar').click()
    await expect(page.getByTestId('tf-verslag-bewaar')).toBeDisabled()

    // De Notulist: samenvatting, actiepunten en koopsignalen, met herkomst.
    await page.getByTestId('tf-analyseer').click()
    await expect(page.getByTestId('tf-samenvatting')).toContainText('Kort belgesprek')
    await expect(page.getByTestId('tf-actiepunten')).toBeVisible()
    await expect(page.getByTestId('tf-koopsignalen')).toBeVisible()
    await expect(page.getByTestId('tf-analyse')).toContainText('Gebaseerd op')

    // Na herladen staat alles er nog.
    await ga(page, `/taken?taak=${id}`)
    await expect(page.getByTestId('tf-transcript')).toBeVisible()
    await expect(page.getByTestId('tf-samenvatting')).toBeVisible()

    // Op de contactkaart en de accountkaart: het verslag en het transcript op het tabblad Gespreksverslagen.
    await ga(page, '/contacten/eva-a08-c1?tab=verslagen')
    await expect(page.getByRole('button', { name: titel, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Transcript: ${titel}` })).toBeVisible()
    await ga(page, '/accounts/eva-a08?tab=verslagen')
    await page.getByRole('button', { name: titel, exact: true }).click()
    await expect(page.getByTestId('verslag-flyout')).toContainText('Kort belgesprek over de levering')
  })

  test('verslag en transcript na het afronden staan bij de vastgelegde belactiviteit op account- en contactkaart', async ({ page }) => {
    const z = Date.now().toString(36)
    const titel = `Bel over de planning ${z}`
    await apiLogin(page.request, 'u-07')
    const r = await page.request.post('/api/tasks', { data: { title: titel, actionType: 'bellen', accountId: 'eva-a08', contactId: 'eva-a08-c1' } })
    const { id } = await r.json()
    // Een eerste verslag voor het afronden gaat mee naar de belactiviteit.
    expect((await page.request.put(`/api/tasks/${id}/verslag`, { data: { tekst: `Eerste verslag ${z}.` } })).ok()).toBe(true)
    const af = await page.request.post(`/api/tasks/${id}/afronden`, { data: { uitkomst: 'voicemail', idempotentieSleutel: `vs-${z}` } })
    expect(af.ok()).toBe(true)

    // Na het afronden: het verslag aanpassen en een transcript toevoegen in het taakvenster.
    await ga(page, `/taken?taak=${id}`)
    const blok = page.getByTestId('tf-verslagblok')
    await blok.getByTestId('vv-tekst').fill(`Teruggebeld na de voicemail ${z}. De planner wil in maart een demo.`)
    const bewaard = page.waitForResponse((x) => x.url().endsWith(`/api/tasks/${id}/verslag`) && x.request().method() === 'PUT')
    await page.getByTestId('tf-verslag-bewaar').click()
    const antwoord = await (await bewaard).json()
    expect(antwoord.activiteitId).toBeTruthy()
    await page.getByTestId('tf-transcript-bestand').setInputFiles({ name: 'gesprek.txt', mimeType: 'text/plain', buffer: Buffer.from(`Klant: We willen in maart een demo ${z}.`) })
    await page.getByTestId('tf-transcript-bewaar').click()
    await expect(page.getByTestId('tf-transcript')).toContainText('gesprek.txt')

    for (const kaart of ['/accounts/eva-a08', '/contacten/eva-a08-c1']) {
      // Tijdlijn: de belactiviteit toont het nieuwste verslag en opent verslag en transcript samen.
      await ga(page, `${kaart}?tab=tijdlijn`)
      const tl = page.getByTestId('tijdlijn')
      const moment = tl.locator('.tl-kaart', { hasText: `Teruggebeld na de voicemail ${z}` })
      await expect(moment).toHaveCount(1)
      await expect(moment).toContainText('Met transcript')
      await expect(tl).not.toContainText(`Eerste verslag ${z}.`)
      await moment.locator('.tl-titel').click()
      const fly = page.getByTestId('verslag-flyout')
      await expect(fly).toContainText('Belactiviteit · Gesprek met transcript')
      await expect(fly.getByTestId('vf-verslag')).toContainText(`De planner wil in maart een demo.`)
      await expect(fly.getByTestId('vf-transcript')).toContainText(`We willen in maart een demo ${z}.`)
      await fly.locator('.fo-sluit').click()

      // Gespreksverslagen: één regel bij de belactiviteit, niet meer los bij de taak.
      await ga(page, `${kaart}?tab=verslagen`)
      await expect(page.getByRole('button', { name: titel, exact: true })).toHaveCount(1)
      await expect(page.getByRole('button', { name: `Transcript: ${titel}` })).toHaveCount(0)
      await page.getByRole('button', { name: titel, exact: true }).click()
      await expect(page.getByTestId('verslag-flyout').getByTestId('vf-transcript')).toBeVisible()
      await page.getByTestId('verslag-flyout').locator('.fo-sluit').click()
    }
  })

  test('geen blok bij een taak van een ander type', async ({ page }) => {
    await apiLogin(page.request, 'u-07')
    const r = await page.request.post('/api/tasks', { data: { title: `Offerte nalopen ${Date.now().toString(36)}`, actionType: 'taak', accountId: 'eva-a08' } })
    const { id } = await r.json()
    await ga(page, `/taken?taak=${id}`)
    await expect(page.getByTestId('tf-gegevens')).toBeVisible()
    await expect(page.getByTestId('tf-verslagblok')).toHaveCount(0)
    // De API weigert een verslag bij een taak die geen beltaak is.
    const v = await page.request.put(`/api/tasks/${id}/verslag`, { data: { tekst: 'Dit hoort hier niet.' } })
    expect(v.status()).toBe(422)
  })
})

test.describe('afspraak plannen: type afspraak in groepen', () => {
  test('Afspraak en Meeting als groepen; de vorm volgt uit het type', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a06?tab=afspraken')
    await page.getByTestId('afspraken-nieuw').click()
    const soort = page.getByTestId('pa-soort')
    await expect(soort.locator('optgroup[label="Afspraak"] option')).toHaveText(['Gepland bezoek', 'Ongepland bezoek', 'Demo', 'Event', 'Beurs', 'Inventarisatie'])
    const meeting = await soort.locator('optgroup[label="Meeting"] option').allTextContents()
    expect(meeting.slice(0, 5)).toEqual(['Online meeting', 'Belafspraak', 'Online demo', 'Webinar', 'Accountoverleg'])

    // Een meeting: online of telefonisch, geen bezoek.
    await soort.selectOption({ label: 'Belafspraak' })
    await expect(page.getByTestId('pa-vorm-telefoon')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('pa-vorm-bezoek')).toHaveCount(0)
    await soort.selectOption({ label: 'Online meeting' })
    await expect(page.getByTestId('pa-vorm-online')).toHaveAttribute('aria-checked', 'true')

    // Een afspraak uit de groep Afspraak is een bezoek op locatie, met de route.
    await soort.selectOption({ label: 'Gepland bezoek' })
    await expect(page.getByTestId('pa-vorm-bezoek')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('pa-vorm-online')).toHaveCount(0)
    await expect(page.getByTestId('pa-vorm-telefoon')).toHaveCount(0)
    await expect(page.getByTestId('pa-uitleg')).toContainText('route')
    await page.getByTestId('pa-datum').fill(dagOver(74))
    await page.getByTestId('pa-start').fill('09:30')
    const antwoord = page.waitForResponse((r) => r.url().endsWith('/api/afspraken') && r.request().method() === 'POST')
    await page.getByTestId('pa-plan').click()
    const { id } = await (await antwoord).json()
    const a: any = await (await page.request.get(`/api/afspraken/${id}`)).json()
    expect(a.vorm).toBe('bezoek')
    expect(a.soort.naam).toBe('Gepland bezoek')
  })

  test('de server laat de vorm het type volgen', async ({ page }) => {
    await apiLogin(page.request, 'u-07')
    const soorten: any = await (await page.request.get('/api/meetingsoorten')).json()
    const beurs = soorten.soorten.find((s: any) => s.slug === 'beurs')
    expect(beurs.categorie).toBe('bezoek')
    const r = await page.request.post('/api/afspraken', { data: { accountId: 'eva-a08', meetingsoortId: beurs.id, vorm: 'online', start: `${dagOver(75)}T08:00:00.000Z` } })
    const { id } = await r.json()
    const a: any = await (await page.request.get(`/api/afspraken/${id}`)).json()
    expect(a.vorm).toBe('bezoek')
  })

  test('instellingen: meetingsoorten in twee groepen, de beheerder zet de categorie', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/meetingsoorten')
    await expect(page.getByTestId('ms-groep-bezoek')).toContainText('Gepland bezoek')
    await expect(page.getByTestId('ms-groep-meeting')).toContainText('Online meeting')
    await page.getByTestId('ms-bewerk-event').click()
    await expect(page.getByTestId('ms-categorie')).toHaveValue('bezoek')
    await expect(page.getByTestId('ms-vorm')).toBeDisabled()
    // Naar Meeting: de vorm wordt online of telefonisch.
    await page.getByTestId('ms-categorie').selectOption('meeting')
    await expect(page.getByTestId('ms-vorm')).toBeEnabled()
    await expect(page.getByTestId('ms-vorm')).toHaveValue('online')
    await page.getByTestId('ms-categorie').selectOption('bezoek')
    await expect(page.getByTestId('ms-vorm')).toHaveValue('bezoek')
  })
})
