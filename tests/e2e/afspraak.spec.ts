import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// Afspraakvenster en plannen in de opzet van DealDrive: plannen met contact (zoekveld gefilterd op de
// klant), de koppeling zichtbaar op account- en contactkaart en in het venster, en het blok Transcript
// en gespreksverslag (transcript uploaden, verslag schrijven, AI-analyse van de Notulist).
const dagOver = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

test.describe('afspraakvenster', () => {
  test('plannen met contact: zichtbaar op de accountkaart, de contactkaart en in het venster', async ({ page }) => {
    const titel = `Leverplan bespreken ${Date.now().toString(36)}`
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a06?tab=afspraken')
    await page.getByTestId('afspraken-nieuw').click()
    const venster = page.getByTestId('plan-afspraak')
    await expect(venster).toContainText('Plan een afspraak in')
    await expect(venster).toContainText('Voeg een briefing toe vanuit de klantkaart.')
    await expect(page.getByTestId('pa-klant-gekozen')).toContainText('Testtechniek Vathorst')
    // De beslisser staat voorgekozen; wissen en een ander contact van deze klant kiezen.
    await expect(page.getByTestId('pa-contact-gekozen')).toContainText('Martijn Testvathorst')
    await page.getByTestId('pa-contact-wis').click()
    await page.getByTestId('pa-contact').click()
    await page.getByTestId('pa-contact').fill('Pet')
    await page.getByTestId('pa-contact-eva-a06-c2').click()
    await expect(page.getByTestId('pa-contact-gekozen')).toContainText('Petra Testvathorst')
    await page.getByTestId('pa-vorm-telefoon').click()
    await page.getByTestId('pa-titel').fill(titel)
    await page.getByTestId('pa-datum').fill(dagOver(70))
    await page.getByTestId('pa-start').fill('16:30')
    await page.getByTestId('pa-plan').click()
    await expect(venster).toHaveCount(0)

    const rij = page.locator('[data-test^="ak-afspraak-"]', { hasText: titel })
    await expect(rij).toBeVisible()
    await rij.click()
    const af = page.getByTestId('afspraak-flyout')
    await expect(page.getByTestId('af-titel')).toHaveText(titel)
    await expect(page.getByTestId('af-account')).toHaveAttribute('href', '/accounts/eva-a06')
    await expect(page.getByTestId('af-contact')).toHaveAttribute('href', '/contacten/eva-a06-c2')
    await page.getByTestId('af-contact').click()
    await expect(af).toHaveCount(0)
    await expect(page).toHaveURL(/\/contacten\/eva-a06-c2/)

    // Op de contactkaart: dezelfde afspraak op het tabblad Afspraken.
    await ga(page, '/contacten/eva-a06-c2?tab=afspraken')
    await expect(page.locator('[data-test^="ak-afspraak-"]', { hasText: titel })).toBeVisible()
    // Niet bij het andere contact van deze klant.
    await ga(page, '/contacten/eva-a06-c1?tab=afspraken')
    await expect(page.locator('[data-test^="ak-afspraak-"]', { hasText: titel })).toHaveCount(0)
  })

  test('transcript uploaden, verslag schrijven en de AI-analyse', async ({ page }) => {
    const titel = `Kennismaking met verslag ${Date.now().toString(36)}`
    await apiLogin(page.request, 'u-07')
    const soorten: any = await (await page.request.get('/api/meetingsoorten')).json()
    const kennis = soorten.soorten.find((s: any) => s.slug === 'kennismaking')
    const r = await page.request.post('/api/afspraken', { data: { accountId: 'eva-a08', contactId: 'eva-a08-c1', meetingsoortId: kennis.id, vorm: 'online', start: `${dagOver(71)}T08:00:00.000Z`, titel } })
    expect(r.ok()).toBe(true)
    const { id } = await r.json()

    await ga(page, `/agenda?afspraak=${id}`)
    const blok = page.getByTestId('af-verslagblok')
    await expect(blok).toContainText('Transcript en gespreksverslag')
    await expect(page.getByTestId('af-analyseer')).toBeDisabled()

    // Een Teams-transcript (.vtt): beurten met spreker, zonder tijdcodes.
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Klant>In maart starten we met nieuwbouw van twee scholen.</v>\n\n00:00:04.500 --> 00:00:07.000\n<v Verkoper>Dan sturen we het leverplan per bouwfase op.</v>\n'
    await page.getByTestId('af-transcript-bestand').setInputFiles({ name: 'teams-gesprek.vtt', mimeType: 'text/vtt', buffer: Buffer.from(vtt) })
    await expect(page.getByTestId('af-transcript-tekst')).toHaveValue('Klant: In maart starten we met nieuwbouw van twee scholen.\nVerkoper: Dan sturen we het leverplan per bouwfase op.')
    await page.getByTestId('af-transcript-bewaar').click()
    await expect(page.getByTestId('af-transcript')).toContainText('teams-gesprek.vtt')
    await expect(page.getByTestId('af-transcript')).toContainText('woorden')

    // Het gespreksverslag schrijven en bewaren.
    await blok.getByTestId('vv-tekst').fill('Goed gesprek over levering op de bouwplaats. Ze hebben budget voor volgend jaar. We plannen een demo.')
    await page.getByTestId('af-verslag-bewaar').click()
    await expect(page.getByTestId('af-verslag-bewaar')).toBeDisabled()

    // De Notulist: samenvatting, actiepunten en koopsignalen, met herkomst.
    await page.getByTestId('af-analyseer').click()
    await expect(page.getByTestId('af-samenvatting')).toContainText('Goed gesprek over levering')
    await expect(page.getByTestId('af-koopsignalen')).toContainText('nieuwbouw')
    await expect(page.getByTestId('af-actiepunten')).toContainText('leverplan')
    await expect(page.getByTestId('af-analyse')).toContainText('Gebaseerd op')

    // Na herladen staat alles er nog; het verslag staat op het tabblad Gespreksverslagen van het contact.
    await ga(page, `/agenda?afspraak=${id}`)
    await expect(page.getByTestId('af-transcript')).toBeVisible()
    await expect(page.getByTestId('af-samenvatting')).toBeVisible()
    await ga(page, '/contacten/eva-a08-c1?tab=verslagen')
    await expect(page.getByRole('button', { name: titel })).toBeVisible()
  })

  test('verplaatsen naar een ander moment', async ({ page }) => {
    await apiLogin(page.request, 'u-07')
    const soorten: any = await (await page.request.get('/api/meetingsoorten')).json()
    const bel = soorten.soorten.find((s: any) => s.slug === 'belafspraak')
    // Zonder contactId koppelt de server de beslisser van de klant.
    const { id } = await (await page.request.post('/api/afspraken', { data: { accountId: 'eva-a08', meetingsoortId: bel.id, start: `${dagOver(72)}T08:00:00.000Z` } })).json()
    await ga(page, `/agenda?afspraak=${id}`)
    await expect(page.getByTestId('af-contact')).toContainText('Hanneke Testbilt')
    await page.getByTestId('af-verplaats').click()
    await page.getByTestId('af-vp-datum').fill(dagOver(73))
    await page.getByTestId('af-vp-start').fill('14:15')
    await page.getByTestId('af-verplaats-bewaar').click()
    await expect(page.getByTestId('af-verplaats-blok')).toHaveCount(0)
    await expect(page.getByTestId('af-defs')).toContainText('14:15 tot 14:30')
  })
})
