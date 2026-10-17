// W4 wensen: Dagstart met de werkplek onder de knoppen, Analyse tussen + Afspraak en Filters op Bezoeken
// en Meetings, Eerst bellen en Inloopbezoek bij de kansen langs de route openen de bestaande flyouts,
// en op Meetings de bellijst over de hele breedte onder de dag (een klik opent altijd een taak) en de
// Meetinglijst als kaarten. Eva Ervaren (u-07) heeft volle mockdata. Bezoeken op 390 stuurt door naar
// Onderweg; daar testen we op 900.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })
const nl = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

async function voor(a: Locator, b: Locator) {
  return a.evaluate((x, y) => !!(x.compareDocumentPosition(y as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await b.elementHandle())
}
/** De eerste dag (vanaf vandaag, 14 dagen) met kansen langs de route en een kans met contact. */
async function kansDag(page: Page) {
  const van = nl(new Date())
  for (let i = 0; i < 14; i++) {
    const d = plus(van, i)
    const r: any = await (await page.request.get(`/api/bezoeken?datum=${d}`)).json()
    const k = r.kansen?.find((x: any) => x.contact?.id)
    if (k && r.kan?.kansenAlle && r.kan?.inloop) return { dag: d, kans: k }
  }
  return null
}

for (const breedte of [1280, 390]) {
  test(`Dagstart: de werkplek staat onder de knoppen in de kop (${breedte})`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
    await login(page, 'u-07')
    await ga(page, '/dagstart')
    const kop = page.getByTestId('kop-knoppen')
    const werkplek = kop.getByTestId('ds-werkplek')
    await expect(werkplek).toContainText('je werkplek')
    const agenda = (await kop.locator('a[href="/agenda"]').boundingBox())!
    const w = (await werkplek.boundingBox())!
    expect(w.y).toBeGreaterThanOrEqual(agenda.y + agenda.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
  })
}

for (const breedte of [1280, 900]) {
  test(`Bezoeken: Analyse tussen + Afspraak en Filters; Eerst bellen en Inloopbezoek openen de flyouts (${breedte})`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: 900 })
    await login(page, 'u-07')
    const gevonden = await kansDag(page)
    test.skip(!gevonden, 'Geen kansen langs de route in de komende 14 dagen')
    const { dag, kans } = gevonden!
    await ga(page, `/bezoeken?datum=${dag}`)
    const kop = page.getByTestId('kop-knoppen')
    expect(await voor(kop.getByTestId('plus-bezoek'), kop.getByTestId('bezoekanalyse-knop'))).toBe(true)
    expect(await voor(kop.getByTestId('bezoekanalyse-knop'), kop.getByTestId('bz-filters'))).toBe(true)

    // Eerst bellen: Nieuwe taak met type Bellen, de prospect en het hoofdcontact.
    await page.getByTestId(`eerst-bellen-${kans.id}`).click()
    const nt = page.getByTestId('nieuwe-taak')
    await expect(nt).toBeVisible()
    await expect(page.getByTestId('nt-type-bellen')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('nt-klant-keuze')).toContainText(kans.naam)
    await expect(page.getByTestId('nt-contact-keuze')).toContainText(kans.contact.naam)
    await expect(page.getByTestId('nt-titel')).toHaveValue(new RegExp(kans.naam))
    await page.keyboard.press('Escape')
    await expect(nt).toHaveCount(0)

    // Inloopbezoek: + Afspraak met de prospect, de dag en de vorm bezoek.
    await page.getByTestId(`inloop-${kans.id}`).click()
    const pa = page.getByTestId('plan-afspraak')
    await expect(pa).toBeVisible()
    await expect(page.getByTestId('pa-klant-gekozen')).toContainText(kans.naam)
    await expect(page.getByTestId('pa-datum')).toHaveValue(dag)
    await expect(page.getByTestId('pa-vorm-bezoek')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('pa-contact-gekozen')).toContainText(kans.contact.naam)
    await expect(page.getByTestId('pa-aanleiding')).toHaveValue(/Inloopbezoek/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
  })
}

for (const breedte of [1280, 390]) {
  test(`Meetings: Analyse in de kop, bellijst over de hele breedte onder de dag, Meetinglijst als kaarten (${breedte})`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
    await login(page, 'u-07')
    await ga(page, '/meetings')
    const kop = page.getByTestId('kop-knoppen')
    expect(await voor(kop.getByTestId('meetings-afspraak'), kop.getByTestId('meetings-analyse'))).toBe(true)
    expect(await voor(kop.getByTestId('meetings-analyse'), kop.getByTestId('meetings-filterknop'))).toBe(true)

    // De bellijst staat onder het dagoverzicht en is even breed.
    const dag = (await page.getByTestId('meetings-dag').boundingBox())!
    const bel = (await page.getByTestId('meetings-bellijst').locator('.bp').boundingBox())!
    expect(bel.y).toBeGreaterThan(dag.y + dag.height - 1)
    expect(Math.abs(bel.width - dag.width)).toBeLessThanOrEqual(2)

    // Meetinglijst als kaarten (DagKaart) met de planknop.
    const kaart = page.getByTestId('aan-de-beurt').locator('li.dp-kaart').first()
    await expect(kaart).toBeVisible()
    await expect(kaart.locator('[data-test^="beurt-plan-"]')).toBeVisible()
    if (breedte < 500) expect((await kaart.locator('[data-test^="beurt-plan-"]').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
  })
}

// Eva heeft voor elke kandidaat al een beltaak; u-01 heeft kandidaten zonder.
test('Meetings: een bellijstkaart zonder beltaak maakt eerst een beltaak en opent die', async ({ page }) => {
  await login(page, 'u-01')
  await ga(page, '/meetings')
  const lijst: any = await (await page.request.get(`/api/meetings/bellijst?datum=${nl(new Date())}`)).json()
  await page.getByTestId('bel-top-10').click()
  const zonder = lijst.bellijst.slice(0, 10).find((b: any) => !b.taskId)
  test.skip(!zonder, 'Elke kandidaat in de top 10 heeft al een beltaak')
  await page.getByTestId(`bel-open-${zonder.accountId}`).click()
  const fo = page.getByTestId('taak-flyout')
  await expect(fo).toBeVisible()
  await expect(fo.getByTestId('tf-account')).toHaveAttribute('href', `/accounts/${zonder.accountId}`)
  await page.keyboard.press('Escape')
  await expect(fo).toHaveCount(0)
  // De beltaak bestaat nu: de kaart heeft een open beltaak en een tweede klik opent dezelfde taak.
  const na: any = await (await page.request.get(`/api/meetings/bellijst?datum=${nl(new Date())}`)).json()
  const rij = na.bellijst.find((b: any) => b.accountId === zonder.accountId)
  expect(rij?.taskId, 'beltaak gemaakt').toBeTruthy()
  await page.getByTestId(`bel-open-${zonder.accountId}`).click()
  await expect(fo).toBeVisible()
  await page.keyboard.press('Escape')
  const nogEens: any = await (await page.request.get(`/api/meetings/bellijst?datum=${nl(new Date())}`)).json()
  expect(nogEens.bellijst.find((b: any) => b.accountId === zonder.accountId)?.taskId).toBe(rij.taskId)
  await page.request.post(`/api/tasks/${rij.taskId}/annuleren`, { data: { reden: 'Opruimen na e2e' } })
})
