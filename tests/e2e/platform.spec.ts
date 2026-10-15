// P02: platformscheiding, werken in een organisatie, spiegel voor de beheerder.
import { existsSync } from 'node:fs'
import { expect, request as pwRequest, test } from '@playwright/test'
import { apiLogin, login } from './hulp'
import { totpCode } from '../../server/utils/totp'

if (existsSync('.env')) process.loadEnvFile('.env')
const MEEKIJK = 'Je kijkt mee in deze organisatie; schakel over naar wijzigen om iets aan te passen.'

test.describe('platform API', () => {
  test('404 voor iedereen zonder founderrol', async ({ request }) => {
    for (const id of ['u-02', 'u-04', 'u-06']) {
      await apiLogin(request, id)
      expect((await request.get('/api/platform/klanten')).status(), id).toBe(404)
      expect((await request.post('/api/platform/werk-in', { data: { organisatieId: 'org-voltvast', reden: 'Ticket 1' } })).status(), id).toBe(404)
      expect((await request.put('/api/platform/klanten/org-voltvast/pakket', { data: { pakket: 'starter', bevestigd: true } })).status(), id).toBe(404)
    }
  })

  test('founder zonder tweestapsverificatie krijgt 401', async ({ baseURL }) => {
    // Na de mailcode, zonder de TOTP-stap (P27): een halve sessie.
    const ctx = await pwRequest.newContext({ baseURL })
    await ctx.post('/api/auth/code', { data: { email: 'founder@dealtrace.test' } })
    const code = (await (await ctx.get('/api/auth/testcode?email=founder@dealtrace.test')).json()).code
    expect((await (await ctx.post('/api/auth/verifieer', { data: { email: 'founder@dealtrace.test', code } })).json()).totpNodig).toBe(true)
    expect((await ctx.get('/api/platform/klanten')).status()).toBe(401)
    await ctx.dispose()
  })

  test('werken in een organisatie: reden, meekijken, wijzigen en stoppen', async ({ request }) => {
    await apiLogin(request, 'u-founder')
    expect((await request.post('/api/platform/werk-in', { data: { organisatieId: 'org-voltvast', reden: '1042' } })).status()).toBe(400)
    const start = await request.post('/api/platform/werk-in', { data: { organisatieId: 'org-voltvast', reden: 'Ticket 1042', modus: 'meekijken' } })
    expect(start.status()).toBe(200)

    const me = await (await request.get('/api/me')).json()
    expect(me.werkIn).toMatchObject({ organisatie: 'Testbedrijf Voltvast', modus: 'meekijken' })
    expect(me.werkIn.resterendMs).toBeLessThanOrEqual(8 * 3600_000)

    const schrijf = await request.put('/api/settings/organisatie', { data: { value: { naam: 'Testbedrijf Voltvast' } } })
    expect(schrijf.status()).toBe(403)
    expect((await schrijf.json()).statusMessage).toBe(MEEKIJK)
    const sync = await request.post('/api/sync/mutations', { data: { mutaties: [{ idempotentieSleutel: crypto.randomUUID(), tabel: 'persoonlijke_instellingen', op: 'patch', recordId: 'u-founder', patch: { a: 1 } }] } })
    expect(sync.status()).toBe(403)

    expect((await request.post('/api/platform/werk-in/modus', { data: { modus: 'wijzigen', reden: 'Ticket 1042 fix' } })).status()).toBe(428)
    expect((await request.post('/api/sessie/herbevestig', { data: { code: totpCode('JBSWY3DPEHPK3PXP') } })).status()).toBe(200)
    expect((await request.post('/api/platform/werk-in/modus', { data: { modus: 'wijzigen', reden: 'Ticket 1042 fix' } })).status()).toBe(200)
    expect((await request.get('/api/settings')).status()).toBe(200)

    expect((await request.delete('/api/platform/werk-in')).status()).toBe(204)
    expect((await (await request.get('/api/me')).json()).werkIn).toBeNull()

    // Audit bij de klant en een melding voor de beheerder.
    await apiLogin(request, 'u-06')
    const audit = await (await request.get('/api/instellingen/audit?leverancier=1')).json()
    const acties = audit.slice(0, 10).map((r: any) => r.actie)
    expect(acties).toEqual(expect.arrayContaining(['leverancier.werkin.start', 'leverancier.werkin.modus', 'leverancier.werkin.einde']))
    const meldingen = await (await request.get('/api/notificaties')).json()
    expect(meldingen.some((m: any) => m.titel.includes('werkt in je organisatie') && m.tekst.includes('Ticket 1042'))).toBe(true)
  })

  test('pakket verlagen vraagt bevestiging en herbevestiging', async ({ request }) => {
    await apiLogin(request, 'u-founder')
    const voorstel = await (await request.put('/api/platform/klanten/org-voltvast/pakket', { data: { pakket: 'starter' } })).json()
    expect(voorstel).toMatchObject({ bevestigen: true, naar: 'starter' })
    expect(voorstel).toHaveProperty('verliest')
    expect((await request.put('/api/platform/klanten/org-voltvast/pakket', { data: { pakket: 'starter', bevestigd: true } })).status()).toBe(428)
  })

  test('"Alleen na toestemming": eerst een verzoek, zonder goedkeuring geen toegang', async ({ request }) => {
    await apiLogin(request, 'u-founder')
    const r = await request.post('/api/platform/werk-in', { data: { organisatieId: 'org-tweede', reden: 'Ticket 2002', modus: 'wijzigen' } })
    // "Ook wijzigen" vraagt eerst herbevestiging.
    expect(r.status()).toBe(428)
    await request.post('/api/sessie/herbevestig', { data: { code: totpCode('JBSWY3DPEHPK3PXP') } })
    const v = await request.post('/api/platform/werk-in', { data: { organisatieId: 'org-tweede', reden: 'Ticket 2002', modus: 'wijzigen' } })
    expect(v.status()).toBe(202)
    expect((await (await request.get('/api/me')).json()).werkIn).toBeNull()
    await apiLogin(request, 'u-t1')
    const toegang = await (await request.get('/api/instellingen/toegang-leverancier')).json()
    expect(toegang.verzoeken.some((x: any) => x.status === 'open' && x.reden === 'Ticket 2002')).toBe(true)
  })

  test('gebruikersaanvraag geeft de founder een melding; de rol founder is niet uit te delen', async ({ request }) => {
    await apiLogin(request, 'u-t1')
    expect((await request.post('/api/gebruikers', { data: { naam: 'Testgebruiker X', email: `x${Date.now()}@tweede.test` } })).status()).toBe(409)
    const email = `aanvraag${Date.now()}@tweede.test`
    expect((await request.post('/api/instellingen/gebruikersaanvragen', { data: { naam: 'Testgebruiker Aanvraag', email } })).status()).toBe(200)
    await apiLogin(request, 'u-founder')
    const meldingen = await (await request.get('/api/notificaties')).json()
    expect(meldingen.some((m: any) => m.titel === 'Gebruikersaanvraag van Testorganisatie Tweede' && m.tekst.includes(email))).toBe(true)
    await apiLogin(request, 'u-06')
    expect((await request.put('/api/gebruikers/u-02', { data: { rol: 'founder' } })).status()).toBe(400)
    expect((await request.put('/api/settings/pakket', { data: { value: 'compleet' } })).status()).toBe(403)
    expect((await request.put('/api/settings/aiCredits', { data: { value: 1 } })).status()).toBe(403)
  })
})

test.describe('platform schermen', () => {
  test('beheerder ziet geen platformscherm', async ({ page }) => {
    await login(page, 'u-06')
    await page.goto('/platform/klanten')
    await expect(page.getByRole('heading', { name: 'Niet gevonden' })).toBeVisible()
    await expect(page.locator('.sb-link[data-sleutel="nav.platform"]')).toHaveCount(0)
  })

  test('founder werkt in een organisatie; gele balk op 390 px zonder horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-founder')
    await expect(page).toHaveURL(/\/platform\/klanten$/)
    await page.click('[data-test="werk-in-org-voltvast"]')
    await page.fill('[data-test=werk-in-reden]', 'Ticket 1042')
    await page.click('[data-test=werk-in-start]')
    const balk = page.getByTestId('werk-in-balk')
    await expect(balk).toContainText('Je werkt in Testbedrijf Voltvast als founder')
    await expect(balk).toContainText('alleen meekijken')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    const h = await page.getByTestId('terug-naar-platform').evaluate((e) => e.getBoundingClientRect().height)
    expect(h).toBeGreaterThanOrEqual(44)
    await page.getByTestId('terug-naar-platform').click()
    await expect(page).toHaveURL(/\/platform\/klanten$/)
    await expect(page.getByTestId('werk-in-balk')).toHaveCount(0)
  })
})
