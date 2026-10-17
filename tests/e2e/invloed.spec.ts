import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

// Invloedskaart (F8): knop Invloed op de accountkaart en de contactkaart, het organigram met dekking, grootste
// risico (één draad) en één stap met Maak taak; details per persoon met houding, rol bevestigen en rapporteert-aan;
// het voorstel van de Notulist dat je bevestigt; de waarschuwing in de overdrachtsvoorbereiding; op de telefoon
// een lijst. Elke test maakt zijn eigen fictieve account, zodat andere tests er niet aan komen.
test.describe.configure({ timeout: 120_000 })

async function maakAccount(page: Page) {
  const nr = Math.floor(Math.random() * 1e6)
  const a = await (await page.request.post('/api/accounts', { data: { naam: `Testzorg Lindehof ${nr}`, plaats: 'Utrecht' } })).json()
  const contact = async (voornaam: string, achternaam: string, functie: string, rol: string) =>
    (await (await page.request.post('/api/contacten', { data: { accountId: a.id, voornaam, achternaam: `${achternaam}${nr}`, functie, rol } })).json()).id as string
  const karin = await contact('Karin', 'Testlinde', 'Facilitair manager', 'champion')
  const hans = await contact('Hans', 'Testhof', 'Directeur', 'beslisser')
  const erik = await contact('Erik', 'Testdienst', 'Hoofd technische dienst', 'beinvloeder')
  // Eén gesprek met Karin, met een verslag: alles loopt via haar.
  const taak = await (await page.request.post('/api/tasks', { data: { title: 'Bel Karin', accountId: a.id, contactId: karin, actionType: 'bellen' } })).json()
  await page.request.put(`/api/tasks/${taak.id}/verslag`, { data: { tekst: 'Gesprek met Karin. Karin zei: "Die nachtelijke storingen kosten ons elke maand een weekend." De directeur hakt de knoop door.' } })
  const af = await page.request.post(`/api/tasks/${taak.id}/afronden`, { data: { uitkomst: 'later', laterOp: '2026-12-01', idempotentieSleutel: `inv-${nr}` } })
  expect(af.ok()).toBe(true)
  return { id: a.id as string, naam: a.naam as string, karin, hans, erik }
}

test('accountkaart: knop Invloed, dekking, één draad en Maak taak', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  await ga(page, `/accounts/${a.id}`)
  // Invloed is een kader onder Meer, direct na Volgen.
  await page.getByTestId('kop-meer').click()
  const testIds = await page.locator('[data-test=meer-flyout] .mf-kader').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
  if (testIds.includes('knop-volgen')) expect(testIds.indexOf('knop-invloed')).toBe(testIds.indexOf('knop-volgen') + 1)
  const knop = page.getByTestId('knop-invloed')
  await expect(knop).toBeVisible()
  await expect(knop).toHaveText(/Invloed/)
  await knop.click()
  const f = page.getByTestId('invloed-flyout')
  await expect(f).toBeVisible()
  await expect(f.getByTestId('inv-titel')).toHaveText('1 van 3 rollen gesproken.')
  await expect(f.getByTestId('inv-svg')).toBeVisible()
  await expect(f.getByTestId('inv-risico-label')).toHaveText(/Eén draad/i)
  await expect(f.getByTestId('inv-risico')).toContainText('Alles loopt via Karin')
  await expect(f.getByTestId('inv-dekking-regel')).toContainText('nog niet')
  await expect(f.getByTestId('inv-stap-tekst')).toHaveText('Vraag Karin om de directeur bij de volgende afspraak te betrekken.')
  // Kleur op contact: de legenda wisselt.
  await f.getByTestId('inv-modus-contact').click()
  await expect(f.getByTestId('inv-legenda')).toContainText('Nooit')
  await f.getByTestId('inv-maak-taak').click()
  await expect(page.getByText('Taak gemaakt: Vraag Karin om de directeur te betrekken')).toBeVisible()
  const taken = await (await page.request.get(`/api/accounts/${a.id}/tabbladen`)).json()
  expect(taken.taken.some((t: any) => t.title === 'Vraag Karin om de directeur te betrekken' && t.contactId === a.karin)).toBe(true)
  // De overdrachtsvoorbereiding neemt de dekking mee als waarschuwing.
  const ov = await (await page.request.get(`/api/accounts/${a.id}/overdracht`)).json()
  expect(ov.dekking.gehaald).toBe(false)
  expect(ov.dekking.waarschuwing).toContain('beslisser')
})

test('details: houding, rol bevestigen, rapporteert-aan en het voorstel van de Notulist', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  await ga(page, `/accounts/${a.id}`)
  await page.getByTestId('kop-meer').click()
  await page.getByTestId('knop-invloed').click()
  const f = page.getByTestId('invloed-flyout')
  await expect(f.getByTestId('inv-titel')).toBeVisible()
  await f.getByTestId(`inv-knoop-${a.hans}`).click()
  const d = page.getByTestId('invloed-persoon')
  await expect(d).toContainText('Directeur')
  // Het bewijs: de zin uit het verslag die over de directeur gaat staat niet bij Hans (zijn naam valt niet).
  await expect(d.getByTestId('ivp-bewijs')).toContainText('Nog geen verslag noemt Hans')
  await d.getByTestId('ivp-houding-voor').click()
  await expect(d.getByTestId('ivp-houding')).toContainText('Voor')
  await d.getByTestId('ivp-bevestig-rol').click()
  await expect(d.getByTestId('ivp-kicker')).toContainText('Bevestigd door jou')
  await expect(d.getByTestId('ivp-bevestig-rol')).toHaveCount(0)
  await d.getByTestId('ivp-sluit').click()
  // Karin rapporteert aan Hans: er komt een lijn in het organigram.
  await f.getByTestId(`inv-knoop-${a.karin}`).click()
  await expect(d.getByTestId('ivp-bewijs')).toContainText('nachtelijke storingen')
  await d.getByTestId('ivp-rapporteert').selectOption(a.hans)
  await expect(f.locator('.inv-lijn')).toHaveCount(1)
  // Een kring kan niet: Hans kan niet aan Karin rapporteren.
  const kring = await page.request.put(`/api/contacten/${a.hans}/invloed`, { data: { rapporteertAan: a.karin } })
  expect(kring.status()).toBe(422)
  await d.getByTestId('ivp-sluit').click()
  // De Notulist stelt een houding voor met een citaat; pas na bevestigen telt die.
  await f.getByTestId('inv-houding-ai').click()
  await expect(page.getByText(/De Notulist stelt \d+ houding/)).toBeVisible()
  await f.getByTestId(`inv-knoop-${a.karin}`).click()
  await expect(d.getByTestId('ivp-voorstel')).toContainText('nachtelijke storingen')
  await expect(d.getByTestId('ivp-houding')).toContainText('Onbekend')
  await d.getByTestId('ivp-voorstel-bevestig').click()
  await expect(d.getByTestId('ivp-houding')).toContainText('Voor')
  await expect(d.getByTestId('ivp-voorstel')).toHaveCount(0)
})

test('contactkaart: Invloed opent de kaart met dit contact geselecteerd', async ({ page }) => {
  await login(page, 'u-01')
  const a = await maakAccount(page)
  await ga(page, `/contacten/${a.erik}`)
  await page.getByTestId('kop-meer').click()
  await page.getByTestId('knop-invloed').click()
  await expect(page.getByTestId('invloed-flyout')).toBeVisible()
  const d = page.getByTestId('invloed-persoon')
  await expect(d).toBeVisible()
  await expect(d).toContainText('Hoofd technische dienst')
  await expect(d.getByTestId('ivp-contactmomenten')).toContainText('nooit')
})

test('telefoon: de kaart als lijst, zonder horizontale scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'u-01')
  const a = await maakAccount(page)
  await ga(page, `/accounts/${a.id}`)
  await page.getByTestId('kop-meer').click()
  await page.getByTestId('knop-invloed').click()
  const f = page.getByTestId('invloed-flyout')
  await expect(f.getByTestId('inv-lijst')).toBeVisible()
  await expect(f.getByTestId('inv-svg')).toBeHidden()
  const hoogte = await f.getByTestId(`inv-rij-${a.hans}`).evaluate((e) => e.getBoundingClientRect().height)
  expect(hoogte).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await f.getByTestId(`inv-rij-${a.hans}`).click()
  await expect(page.getByTestId('invloed-persoon')).toContainText('Directeur')
})
