// Automatische dagplanning (F3 Dagplanner) in de tweede testorganisatie, zodat andere tests er geen last
// van hebben. De beheerder zet tijdelijk alle dagen als werkdag (de test draait ook in het weekend), zet
// "Plan mijn dag automatisch" aan in Mijn instellingen, laat de Dagplanner plannen, annuleert een afspraak
// (herplannen met "Wat schoof" en een melding), laat een afspraak uitlopen en maakt een blok en de hele
// dag ongedaan. Na afloop gaat alles terug. Fictieve data.
import { expect as basis, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ timeout: 180_000 })
// De machine is soms zwaar belast: ruimer wachten op het scherm.
const expect = basis.configure({ timeout: 20_000 })

const nlUur = () => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(new Date()))
/** Over twee uur, op een heel kwartier, maar altijd vandaag (Nederlandse tijd). */
function straks(): string {
  const d = new Date(Date.now() + 2 * 3600_000)
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0)
  return d.toISOString()
}

test('Plan mijn dag automatisch: plannen, herplannen bij een wijziging en ongedaan maken', async ({ page }) => {
  await login(page, 'u-t1')
  const instellingen = await (await page.request.get('/api/settings')).json()
  const oudeWerkdagen = instellingen.werkdagen ?? null
  expect((await page.request.put('/api/settings/werkdagen', { data: { value: { ...(oudeWerkdagen ?? {}), werkdagen: [1, 2, 3, 4, 5, 6, 7] } } })).ok()).toBe(true)
  const taken: string[] = []
  const afspraken: string[] = []
  try {
    // Ongeldige invoer en de standaard.
    expect((await page.request.put('/api/mij/dagplanning', { data: { tijd: '05:00' } })).status()).toBe(422)
    expect((await page.request.put('/api/mij/dagplanning', { data: { automatisch: 'ja' } })).status()).toBe(400)
    await page.request.put('/api/mij/dagplanning', { data: { automatisch: false, tijd: '07:00' } })

    for (const n of [1, 2, 3]) {
      const t = await (await page.request.post('/api/tasks', { data: { title: `Dagplanner e2e bel ${n}`, actionType: 'bellen', dueDate: new Date().toISOString() } })).json()
      taken.push(t.id)
    }
    const soorten = await (await page.request.get('/api/meetingsoorten')).json()
    const overleg = soorten.soorten.find((m: any) => m.slug === 'weekoverleg')
    const laat = nlUur() >= 21
    if (!laat) {
      const a = await (await page.request.post('/api/afspraken', { data: { meetingsoortId: overleg.id, start: straks(), duurMin: 30, titel: 'Dagplanner e2e overleg' } })).json()
      afspraken.push(a.id)
    }

    // Aanzetten in Mijn instellingen, met een tijdstip.
    await ga(page, '/mijn-instellingen#dagplanning')
    const blok = page.locator('#dagplanning')
    const schakel = blok.getByTestId('dagplanning-aan')
    await expect(schakel).toHaveAttribute('aria-checked', 'false')
    const bewaard = () => page.waitForResponse((r) => r.url().includes('/api/mij/dagplanning') && r.request().method() === 'PUT')
    await Promise.all([bewaard(), schakel.click()])
    await expect(schakel).toHaveAttribute('aria-checked', 'true')
    await Promise.all([bewaard(), blok.getByTestId('dagplanning-tijd').selectOption('07:15')])
    await expect(page.getByText('Tijdstip bewaard: 07:15.')).toBeVisible()
    expect(await (await page.request.get('/api/mij/dagplanning')).json()).toEqual({ automatisch: true, tijd: '07:15' })

    // De Dagplanner deelt de dag in (meteen, of met Plan mijn dag nu als het tijdstip in de stille uren viel of de dag al eerder ongedaan was).
    await ga(page, '/dagstart')
    const kaart = page.getByTestId('ds-dagplanner')
    await expect(kaart).toBeVisible()
    if (await page.getByTestId('ds-plan-nu').isVisible()) {
      await page.getByTestId('ds-plan-nu').click()
      await expect(page.getByText('Je dag is ingedeeld en staat in je agenda.')).toBeVisible()
    }
    await expect(kaart).toContainText('Gepland door de Dagplanner')
    await expect(page.getByTestId('ds-werkplek')).toContainText('je werkplek')
    await expect(page.getByTestId('ds-modus-buiten')).toHaveCount(0)
    await expect(page.getByTestId('ds-voorstel')).toHaveCount(0)
    const d1 = await (await page.request.get('/api/dagstart')).json()
    expect(d1.dagplanning.status).toBe('gepland')
    expect(d1.titel).toMatch(/^Je dag (staat klaar|is opnieuw ingedeeld)\.$/)
    const melding = await (await page.request.get('/api/notificaties')).json()
    expect(JSON.stringify(melding)).toContain('Je dag staat klaar')

    if (!laat) {
      // Uitlopen en annuleren: de dag wordt opnieuw ingedeeld en "Wat schoof" zegt wat er veranderde.
      const u = await page.request.post(`/api/afspraken/${afspraken[0]}/uitloop`, { data: { minuten: 30 } })
      expect(u.ok()).toBe(true)
      expect((await page.request.post(`/api/afspraken/${afspraken[0]}/uitloop`, { data: { minuten: 500 } })).status()).toBe(422)
      expect((await page.request.post(`/api/afspraken/${afspraken[0]}/status`, { data: { status: 'geannuleerd' } })).ok()).toBe(true)
      await ga(page, '/dagstart')
      await expect(page.getByTestId('ds-titel')).toHaveText('Je dag is opnieuw ingedeeld.')
      await expect(page.getByTestId('ds-lede')).toContainText('Herpland om')
      await expect(page.getByTestId('ds-schoof')).toContainText('Dagplanner e2e overleg loopt uit tot')
      await expect(page.getByTestId('ds-schoof')).toContainText('is geannuleerd.')
      await expect(page.getByTestId('ds-wijziging-laatste')).toContainText('Afspraak geannuleerd')
      await expect(page.getByTestId('ds-wijziging-laatste')).toContainText('Dagplanner e2e overleg is geannuleerd.')
      await expect(page.getByTestId('ds-neem-over')).toHaveCount(0)
      const m2 = await (await page.request.get('/api/notificaties')).json()
      expect(JSON.stringify(m2)).toContain('Je dag is opnieuw ingedeeld')
    }

    // Eén blok ongedaan maken (als er nog een blok in de toekomst staat), daarna de hele dag.
    const eerste = page.locator('[data-test^="ds-ongedaan-"]:not([data-test="ds-ongedaan-dag"])').first()
    if (await eerste.count()) {
      const sleutel = (await eerste.getAttribute('data-test'))!.replace('ds-ongedaan-', '')
      await eerste.click()
      await expect(page.getByTestId(`ds-item-${sleutel}`)).toHaveCount(0)
    }
    await page.getByTestId('ds-ongedaan-dag').click()
    await expect(page.getByTestId('ds-dagplanner-stand')).toContainText('ongedaan')
    await expect(page.getByTestId('ds-plan-nu')).toBeVisible()
    const d2 = await (await page.request.get('/api/dagstart')).json()
    expect(d2.dagplanning.status).toBe('ongedaan')
    // Niets van de Dagplanner staat nog in de toekomst; de belacties staan weer op je lijst.
    expect(d2.dagplanning.items.filter((i: any) => Date.parse(i.start) > Date.now())).toEqual([])
    for (const id of taken) expect((await (await page.request.get(`/api/tasks/${id}`)).json()).status).toBe('open')
    expect((await page.request.post('/api/dagplanning/ongedaan', { data: {} })).status()).toBe(404)
  } finally {
    await page.request.put('/api/mij/dagplanning', { data: { automatisch: false, tijd: '07:00' } })
    for (const id of afspraken) await page.request.post(`/api/afspraken/${id}/status`, { data: { status: 'geannuleerd' } }).catch(() => undefined)
    for (const id of taken) await page.request.post(`/api/tasks/${id}/annuleren`, { data: { reden: 'Opruimen na de e2e-test' } }).catch(() => undefined)
    await page.request.put('/api/settings/werkdagen', { data: { value: oudeWerkdagen ?? {} } })
  }
})

test('de geplande taak en de agendamelding vragen een geheim of een geldig token', async ({ request }) => {
  expect((await request.post('/api/motor/dagplanning')).status()).toBe(401)
  expect((await request.post('/api/koppelingen/agenda/melding', { data: { value: [{ clientState: 'vervalst.token' }] } })).status()).toBe(401)
  const v = await request.post('/api/koppelingen/agenda/melding?validationToken=abc123')
  expect(v.status()).toBe(200)
  expect(await v.text()).toBe('abc123')
})

test('Mijn instellingen toont de dagplanning standaard uit, ook op de telefoon', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'u-t2')
  await ga(page, '/mijn-instellingen#dagplanning')
  await expect(page.locator('#dagplanning').getByTestId('dagplanning-aan')).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('#dagplanning').getByTestId('dagplanning-tijd')).toBeDisabled()
  const breed = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(breed).toBe(false)
})
