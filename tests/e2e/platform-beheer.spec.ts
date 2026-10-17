// Pakket C: Platformbeheer aanvullen. Agentmaxima op /platform/ai, in de klantflyout Data en AVG, AI per
// klant en opzeggen met herbevestiging in de flyout zelf; /api/platform/** geeft 404 voor iedereen behalve
// de founder. Op 1280 en 390 px zonder horizontale scroll.
import { existsSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'
import { totpCode } from '../../server/utils/totp'

if (existsSync('.env')) process.loadEnvFile('.env')
const SHOTS = process.env.PW_SHOTS ?? ''
const geenHorizontaleScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
async function herbevestig(page: Page) {
  const venster = page.locator('[data-test=herbevestig]')
  await expect(venster).toBeVisible()
  await venster.locator('[data-test=herbevestig-code]').fill(totpCode('JBSWY3DPEHPK3PXP'))
  await venster.getByRole('button', { name: 'Bevestigen' }).click()
}

test.describe('rechten', () => {
  test('accountmanager en beheerder krijgen 404 op elke nieuwe platformroute', async ({ request }) => {
    for (const id of ['u-01', 'u-06']) {
      await apiLogin(request, id)
      const k = '/api/platform/klanten/org-voltvast'
      const pogingen = [
        await request.get('/api/platform/agentmaxima'),
        await request.put('/api/platform/agentmaxima', { data: { agent: 'verzender', max: 'D' } }),
        await request.get(k),
        await request.put(`${k}/avg`, { data: { verwerkersovereenkomst: { versie: '1', getekendOp: '2026-10-01' } } }),
        await request.post(`${k}/avg/verzoeken`, { data: { soort: 'betrokkene-inzage', kenmerk: 'T-1', ontvangenOp: '2026-10-01' } }),
        await request.put(`${k}/avg/verzoeken/x`, { data: { status: 'afgehandeld' } }),
        await request.post(`${k}/avg/export`, { data: { reden: 'Proef' } }),
        await request.put(`${k}/status`, { data: { status: 'opgezegd', einddatum: '2027-01-01', reden: 'Proef', naam: 'Testbedrijf Voltvast' } }),
        await request.delete(`${k}/ai`),
        await request.put('/api/platform/ai', { data: { organisatieId: 'org-voltvast', provider: 'mock' } }),
      ]
      for (const r of pogingen) expect(r.status(), `${id} ${r.url()}`).toBe(404)
    }
  })

  test('de beheerder ziet de platformschermen niet', async ({ page }) => {
    await login(page, 'u-06')
    await page.goto('/platform/ai')
    await expect(page.getByText('Agentmaxima')).toHaveCount(0)
  })
})

test.describe('agentmaxima', () => {
  test.afterEach(async ({ request }) => {
    await apiLogin(request, 'u-founder')
    await request.put('/api/platform/agentmaxima', { data: { agent: 'verzender', max: 'B' } })
  })

  test('maximum verlagen en terugzien; ruimer dan de standaard kan niet', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-founder')
    await ga(page, '/platform/ai')
    const blok = page.locator('[data-test=agentmaxima]')
    await expect(blok.locator('[data-test=max-verzender-A]')).toBeDisabled()
    await blok.locator('[data-test=max-verzender-C]').click()
    await expect(page.locator('.toast').filter({ hasText: 'Verzender: hooguit C' })).toBeVisible()
    await page.reload(); await page.waitForLoadState('networkidle')
    await expect(blok.locator('[data-test=max-verzender-C]')).toHaveAttribute('aria-pressed', 'true')
    await expect(blok).toContainText('1 van 13 verlaagd')
    await geenHorizontaleScroll(page)
    // De server weigert ruimer dan de standaard en schrijft een auditregel.
    await apiLogin(request, 'u-founder')
    expect((await request.put('/api/platform/agentmaxima', { data: { agent: 'verzender', max: 'A' } })).status()).toBe(422)
    const audit = await (await request.get('/api/platform/audit')).json()
    expect(JSON.stringify(audit)).toContain('agentmaximum.zetten')
  })

  test('op 390 px zonder horizontale scroll, knoppen van 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-founder')
    await ga(page, '/platform/ai')
    const knop = page.locator('[data-test=max-zoeker-B]')
    await knop.scrollIntoViewIfNeeded()
    expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await geenHorizontaleScroll(page)
  })
})

test.describe('klantflyout', () => {
  test('Data en AVG: aantallen, verwerkersovereenkomst, verzoek met termijn, export vragen', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-founder')
    await ga(page, '/platform/klanten?klant=org-voltvast')
    const avg = page.locator('[data-test=klant-avg]')
    await avg.scrollIntoViewIfNeeded()
    // Alleen aantallen, uit dealtrace_platform_avg.
    expect(Number(await avg.locator('[data-test=avg-accounts]').textContent())).toBeGreaterThan(0)
    await expect(avg.locator('[data-test=avg-bronnen]')).toContainText('Import')
    await expect(avg.locator('[data-test=avg-termijnen]')).toContainText('Activiteiten')

    await avg.locator('[data-test=avg-vo-open]').click()
    await avg.locator('[data-test=avg-vo-versie]').fill('2026.1')
    await avg.locator('[data-test=avg-vo-datum]').fill('2026-10-01')
    await avg.locator('[data-test=avg-vo-bewaar]').click()
    await expect(avg.locator('[data-test=avg-vo]')).toContainText('versie 2026.1')

    const kenmerk = `T-${Date.now() % 100000}`
    await avg.locator('[data-test=avg-verzoek-nieuw]').click()
    await avg.locator('[data-test=avg-verzoek-kenmerk]').fill('jan@voorbeeld.test')
    await expect(avg.locator('.fo-fout')).toContainText('Geen e-mailadres')
    await expect(avg.locator('[data-test=avg-verzoek-bewaar]')).toBeDisabled()
    await avg.locator('[data-test=avg-verzoek-kenmerk]').fill(kenmerk)
    await avg.locator('[data-test=avg-verzoek-bewaar]').click()
    const rij = avg.locator(`[data-verzoek="${kenmerk}"]`)
    await expect(rij).toContainText('nog 30 dagen')
    await expect(rij).toContainText('Open')
    if (SHOTS) await avg.screenshot({ path: `${SHOTS}/avg-1280.png` })
    await rij.locator('[data-test=avg-verzoek-af]').click()
    await expect(rij).toContainText('Afgehandeld')

    await avg.locator('[data-test=avg-export-open]').click()
    await avg.locator('[data-test=avg-export-reden]').fill('Controle voor de jaarlijkse audit')
    await avg.locator('[data-test=avg-export-verstuur]').click()
    await expect(avg.locator('[data-test=avg-export]')).toContainText('Gevraagd op')
    await geenHorizontaleScroll(page)

    // De beheerder kreeg meldingen; de audit van de klant toont de leverancier.
    await apiLogin(request, 'u-06')
    const meldingen = await (await request.get('/api/notificaties')).json()
    expect(meldingen.some((m: any) => m.titel === 'AVG-verzoek ontvangen' && m.tekst.includes(kenmerk))).toBe(true)
    expect(meldingen.some((m: any) => m.titel === 'Maak een export van je organisatie')).toBe(true)
    const audit = (await (await request.get('/api/instellingen/audit?leverancier=1')).json()).regels.map((r: any) => r.actie)
    expect(audit).toEqual(expect.arrayContaining(['leverancier.avg.verzoek', 'leverancier.avg.verzoek.afgehandeld', 'leverancier.avg.exportverzoek', 'leverancier.avg.verwerkersovereenkomst']))
  })

  test('AI per klant: mock instellen, eigen Claude zonder sleutel geweigerd, terug naar platform met herbevestiging', async ({ page, request }) => {
    await apiLogin(request, 'u-founder')
    expect((await request.put('/api/platform/ai', { data: { organisatieId: 'org-tweede', provider: 'claude' } })).status()).toBe(422)
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-founder')
    await ga(page, '/platform/klanten?klant=org-tweede')
    const ai = page.locator('[data-test=klant-ai]')
    await ai.scrollIntoViewIfNeeded()
    await expect(ai.locator('[data-test=klant-prompts] li')).toHaveCount(8)
    await ai.locator('[data-test=klant-ai-mock]').click()
    await ai.locator('[data-test=klant-ai-bewaar]').click()
    await expect(ai.locator('[data-test=klant-ai-zin]')).toContainText('altijd de mock')
    if (SHOTS) await ai.screenshot({ path: `${SHOTS}/ai-klant-1280.png` })
    await ai.locator('[data-test=klant-ai-terug]').click()
    await herbevestig(page)
    await expect(ai.locator('[data-test=klant-ai-zin]')).not.toContainText('altijd de mock')
    await expect(ai.locator('[data-test=klant-ai-terug]')).toHaveCount(0)
  })

  test('opzeggen in de flyout: naam overtypen, herbevestigen, intrekken; het contractformulier kan niet opzeggen', async ({ page, request }) => {
    await apiLogin(request, 'u-founder')
    expect((await request.put('/api/platform/klanten/org-tweede/contract', { data: { status: 'opgezegd' } })).status()).toBe(409)
    // Zonder herbevestiging weigert de server (428), ook met alles goed ingevuld.
    expect((await request.put('/api/platform/klanten/org-tweede/status', { data: { status: 'opgezegd', einddatum: '2030-01-01', reden: 'Proef', naam: 'Testorganisatie Tweede' } })).status()).toBe(428)

    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-founder')
    await ga(page, '/platform/klanten?klant=org-tweede')
    page.on('dialog', () => { throw new Error('Geen browservenster verwacht') })
    const blok = page.locator('[data-test=klant-opzeggen]')
    await blok.scrollIntoViewIfNeeded()
    await blok.locator('[data-test=opzeg-begin]').click()
    await expect(blok).toContainText('Wat er gebeurt')
    await blok.locator('[data-test=opzeg-reden]').fill('Stopt met de buitendienst')
    await blok.locator('[data-test=opzeg-naam]').fill('Testorganisatie')
    await expect(blok.locator('[data-test=opzeg-bevestig]')).toBeDisabled()
    await blok.locator('[data-test=opzeg-naam]').fill('Testorganisatie Tweede')
    if (SHOTS) await blok.screenshot({ path: `${SHOTS}/opzeggen-390.png` })
    await geenHorizontaleScroll(page)
    expect((await blok.locator('[data-test=opzeg-bevestig]').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await blok.locator('[data-test=opzeg-bevestig]').click()
    await herbevestig(page)
    await expect(blok.locator('[data-test=opzeg-stand]')).toContainText('Stopt met de buitendienst')
    await expect(page.locator('[data-test=contract-status]')).toBeDisabled()

    await blok.locator('[data-test=opzeg-intrekken]').click()
    await blok.locator('[data-test=opzeg-intrekken-ja]').click()
    await expect(blok.locator('[data-test=opzeg-begin]')).toBeVisible()
    // Een proef blijft na intrekken een proef.
    await expect(blok).toContainText('Proef')
    await geenHorizontaleScroll(page)

    const audit = await (await request.get('/api/platform/audit')).json()
    expect(JSON.stringify(audit)).toContain('organisatie.opzeggen')
    expect(JSON.stringify(audit)).toContain('organisatie.opzeggingIntrekken')
  })
})
