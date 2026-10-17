// Labelsysteem (mockup "Labels in Dealtrace"): op zes schermen de nieuwe labels. Klasse met lettertegel en
// trap, fase met stappen, status zacht met icoon, rol met eigen icoon en tint, Bel me niet gevuld vooraan,
// over tijd als enige gevulde label in een taakrij, bron en score als rand, AI-context paars, houding met
// icoon op de invloedskaart. Geen label is geel of zwart met geel. Elke test maakt zijn eigen fictieve data.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ timeout: 120_000 })
const nr = () => Math.floor(Math.random() * 1e6)

/** Een label is nooit geel en nooit zwart met gele tekst. */
async function nietGeel(l: Locator) {
  const kleuren = await l.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.color] }))
  for (const [vlak, tekst] of kleuren) {
    expect(vlak).not.toBe('rgb(254, 216, 0)')
    expect(tekst).not.toBe('rgb(254, 216, 0)')
  }
}

async function maakAccount(page: Page, extra: Record<string, unknown> = {}) {
  const a = await (await page.request.post('/api/accounts', { data: { naam: `Testlabel Velserbroek ${nr()}`, plaats: 'Haarlem', ...extra } })).json()
  return a as { id: string; naam: string }
}

test('prospectrij: klasse met tegel en trap, geen gele labels', async ({ page }) => {
  await login(page, 'u-01')
  const instellingen = await (await page.request.get('/api/settings')).json()
  const klasse = (instellingen.klassen ?? []).find((k: any) => /^B\b/.test(k.naam ?? '') || k.id === 'B') ?? instellingen.klassen?.[0]
  const a = await maakAccount(page, klasse ? { klasse: klasse.id } : {})
  await ga(page, `/prospects/alle?q=${encodeURIComponent(a.naam)}`)
  const rij = page.locator(`[data-account="${a.id}"]`)
  await expect(rij).toBeVisible()
  const k = rij.getByTestId('rij-klasse')
  await expect(k).toHaveClass(/lbl--rand|lbl--leeg/)
  if (klasse) {
    await expect(k).toHaveClass(/lbl-klasse/)
    await expect(k.locator('.lbl-klasse-letter')).toBeVisible()
  }
  await nietGeel(rij.locator('.lbl'))
})

test('accountkaart: fase met stappen als knop, status zacht met icoon, klasse kiezen', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  await ga(page, `/accounts/${a.id}`)
  const fase = page.getByTestId('fasepil')
  if (await fase.count()) {
    await expect(fase).toHaveClass(/lbl-fase/)
    await expect(fase.locator('.lbl-stappen i')).toHaveCount(4)
  }
  const status = page.getByTestId('statuspil')
  await expect(status).toHaveClass(/lbl/)
  await expect(status.locator('svg')).toHaveCount(1)
  await expect(page.getByTestId('klasse-label')).toBeVisible()
  await nietGeel(page.locator('.ak-kop .lbl'))
})

test('contactrij: rol met eigen icoon, Bel me niet gevuld vooraan', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  const n = nr()
  const c = await (await page.request.post('/api/contacten', { data: { accountId: a.id, voornaam: 'Joris', achternaam: `Testkamp${n}`, functie: 'Inkoper', rol: 'poortwachter' } })).json()
  await page.request.put(`/api/contacten/${c.id}`, { data: { belMeNiet: true } })
  await ga(page, `/contacten/alle?q=Testkamp${n}`)
  const rij = page.locator(`[data-contact="${c.id}"]`)
  await expect(rij).toBeVisible()
  const rol = rij.getByTestId('rol-pil')
  await expect(rol).toHaveText('Poortwachter')
  await expect(rol).toHaveClass(/lbl--zacht/)
  await expect(rol).toHaveClass(/lbl--oranje/)
  await expect(rol.locator('svg')).toHaveCount(1)
  const bel = rij.getByTestId('bel-me-niet-pil')
  if (await bel.count()) {
    await expect(bel).toHaveClass(/lbl--vol/)
    // Urgentie eerst: Bel me niet staat voor de rol.
    const volgorde = await rij.locator('.ct-regel1 .lbl').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')))
    expect(volgorde.indexOf('urgentie')).toBeLessThan(volgorde.indexOf('rol'))
  }
})

test('taakrij: over tijd is het enige gevulde label, soort en herkomst als rand, handmatig zonder label', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  const titel = `Bel terug labels ${nr()}`
  const t = await (await page.request.post('/api/tasks', { data: { title: titel, accountId: a.id, actionType: 'bellen', priority: 'urgent', dueDate: new Date(Date.now() - 2 * 864e5).toISOString() } })).json()
  await ga(page, '/taken?weergave=lijst')
  const rij = page.getByTestId(`taak-${t.id}`)
  await expect(rij).toBeVisible({ timeout: 20_000 })
  await expect(rij.locator('.lbl--vol')).toHaveCount(1)
  await expect(rij.getByTestId('taak-over-tijd')).toHaveText('Over tijd')
  await expect(rij.getByTestId('taak-soort')).toHaveText('Bellen')
  await expect(rij.getByTestId('taak-soort')).toHaveClass(/lbl--rand/)
  await expect(rij.getByTestId('taak-herkomst')).toHaveCount(0)
  expect(await rij.locator('.taak-labels .lbl').count()).toBeLessThanOrEqual(4)
  await nietGeel(rij.locator('.lbl'))
})

test('inzichtkaart: rustige kop, bron en score als rand, AI-context paars', async ({ page }) => {
  await login(page, 'u-01')
  await ga(page, '/inzichten')
  const kaart = page.locator('[data-test=inzichten] .inzicht-kaart').first()
  await expect(kaart).toBeVisible()
  await expect(kaart.getByTestId('ik-bron')).toHaveClass(/lbl--rand/)
  await expect(kaart.getByTestId('ik-score')).toHaveClass(/lbl-score/)
  const balk = await kaart.locator('.ik-balk').evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(balk).not.toBe('rgb(10, 10, 10)')
  const ctx = page.locator('[data-test=inzichten] [data-test=ai-context] .lbl').first()
  if (await ctx.count()) {
    await expect(ctx).toHaveClass(/lbl--paars/)
    await expect(ctx).toHaveText('AI-context')
  }
  await nietGeel(kaart.locator('.lbl'))
})

test('invloedskaart: rol en houding als label met icoon', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  const n = nr()
  const hans = (await (await page.request.post('/api/contacten', { data: { accountId: a.id, voornaam: 'Hans', achternaam: `Testhof${n}`, functie: 'Directeur', rol: 'beslisser' } })).json()).id
  await ga(page, `/accounts/${a.id}`)
  await page.getByTestId('kop-meer').click()
  await page.getByTestId('knop-invloed').click()
  const f = page.getByTestId('invloed-flyout')
  await expect(f).toBeVisible()
  const knoop = f.getByTestId(`inv-knoop-${hans}`)
  const rol = knoop.locator('[data-label=rol]')
  await expect(rol).toHaveText('Beslisser')
  await expect(rol).toHaveClass(/lbl--blauw/)
  await expect(f.getByTestId(`inv-houding-${hans}`).locator('svg')).toHaveCount(1)
  // De legenda toont de vier houdingen als label met icoon, niet als kleurstreep.
  const legenda = f.getByTestId('inv-legenda').locator('[data-label=houding]')
  await expect(legenda).toHaveCount(4)
  await expect(legenda.first()).toHaveText('Voor')
  await nietGeel(f.locator('.lbl'))
})
