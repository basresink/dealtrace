// P04: import met ontdubbelen, DealDrive-mock, onderdrukking, terugdraaien en de wizard.
import { expect, test, type APIRequestContext } from '@playwright/test'
import { schrijfCsv } from '../../shared/csv'
import { KOP, maakImportCsv } from '../../tools/testdata/importBestand'
import { apiLogin, ga, login } from './hulp'

async function importeer(request: APIRequestContext, csv: string, label: string, keuzes: Record<string, string> = {}) {
  const vb = await (await request.post('/api/import/voorbeeld', { multipart: { bestand: { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }, soort: 'bedrijven_contacten', label } })).json()
  const controle = await (await request.post('/api/import/controle', { data: { batchId: vb.batchId, koppeling: vb.koppeling } })).json()
  const res = await request.post('/api/import/verwerk', { data: { batchId: vb.batchId, keuzes, eigenaar: { soort: 'vast' } } })
  return { vb, controle, res, uitkomst: res.ok() ? await res.json() : null }
}

test.describe('import', () => {
  test('1.000 rijen: rapport, geen contactmoment, herkomst, terugdraaien en 409', async ({ request }) => {
    await apiLogin(request, 'u-07')
    const lijst = await (await request.get('/api/accounts?eigenaar=iedereen&pagina=10')).json()
    const domeinen = lijst.rijen.map((r: any) => r.domein).filter(Boolean).slice(0, 50)
    expect(domeinen.length).toBe(50)
    const csv = maakImportCsv(1000, { bestaandeDomeinen: domeinen }).replaceAll('Testimport', `Testimp${Date.now() % 100000}`).replaceAll(/9950(\d{4})/g, (_, n) => `9${String(Date.now() % 1000).padStart(3, '0')}${n}`)
    const { controle, uitkomst } = await importeer(request, csv, 'Beurs Vakdagen 2026')
    expect(controle).toMatchObject({ nieuw: 900, alInBestand: 50, dubbelInBestand: 30, fouten: 20 })
    expect(uitkomst).toMatchObject({ nieuw: 900, samengevoegd: 50 })
    const batches = await (await request.get('/api/import')).json()
    const batch = batches.find((b: any) => b.id === uitkomst.batchId)
    expect(batch.status).toBe('verwerkt')
    const nieuw = (await (await request.get('/api/accounts?eigenaar=mij&sort=naam')).json()).rijen.find((r: any) => r.name.startsWith('Testimp'))
    const kaart = await (await request.get(`/api/accounts/${nieuw.id}`)).json()
    expect(kaart.laatsteContactOp).toBeNull()
    expect(kaart.herkomst.kvk).toMatchObject({ bron: 'import', batchId: uitkomst.batchId })
    const terug = await request.post(`/api/import/${uitkomst.batchId}/terugdraaien`)
    expect(await terug.json()).toMatchObject({ verwijderd: 900, bleven: 0, hersteld: 50 })
    expect((await request.post(`/api/import/${uitkomst.batchId}/terugdraaien`)).status()).toBe(409)
  })

  test('DealDrive-mock, onderdrukking en bel-me-niet', async ({ request }) => {
    await apiLogin(request, 'u-03')
    const n = Date.now() % 100000
    const csv = schrijfCsv([KOP,
      [`Testbrontsma Installatietechniek`, '99123456', '', '8011 TB', 'Zwolle', '', '', '', '', '', '', ''],
      [`Testklant Kabelwerk`, '99777777', '', '3511 KK', 'Utrecht', '', '', '', '', '', '', ''],
      [`Testafmeld ${n}`, '', '', '3811 AA', 'Amersfoort', '', 'Ada', `Testafmeld${n}`, '', 'afgemeld@testafmelding.test', '', ''],
    ].concat([[`Testbelniet ${n}`, '', '', '3811 AB', 'Amersfoort', '', 'Bo', `Testbelniet${n}`, '', '', '', '06 1200 0999']]))
    const vb = await (await request.post('/api/import/voorbeeld', { multipart: { bestand: { name: 't.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }, soort: 'bedrijven_contacten', label: 'Test DealDrive' } })).json()
    const koppeling = [...vb.koppeling]; koppeling[11] = 'contactMobiel'
    const controle = await (await request.post('/api/import/controle', { data: { batchId: vb.batchId, koppeling } })).json()
    const r = Object.fromEntries(controle.regels.map((x: any) => [x.naam, x]))
    expect(r['Testbrontsma Installatietechniek']).toMatchObject({ categorie: 'dealdriveProspect', keuze: 'nieuw' })
    expect(r['Testbrontsma Installatietechniek'].dealdrive.eigenaar).toBe('eva.dijkstra@voltvast.test')
    expect(r['Testklant Kabelwerk']).toMatchObject({ categorie: 'dealdriveKlant', keuze: 'overslaan' })
    const res = await (await request.post('/api/import/verwerk', { data: { batchId: vb.batchId, keuzes: { [r['Testbrontsma Installatietechniek'].rij]: 'overslaan' }, eigenaar: { soort: 'vast' } } })).json()
    expect(res.nieuw).toBe(2)
    const contacten = await (await request.get(`/api/contacten?q=Testafmeld${n}`)).json()
    expect(contacten.contacten[0].consent.email).toMatchObject({ status: 'nee', bron: 'afgemeld' })
    const belniet = await (await request.get(`/api/contacten?q=Testbelniet${n}`)).json()
    expect(belniet.contacten[0].belMeNiet).toBe(true)
    await request.post(`/api/import/${res.batchId}/terugdraaien`)
  })

  test('een Beginner krijgt 403 met reden niveau', async ({ request }) => {
    await apiLogin(request, 'u-02')
    const r = await request.get('/api/import')
    expect(r.status()).toBe(403)
    expect((await r.json()).data?.reden).toBe('niveau')
  })

  test('de wizard van bestand tot samenvatting', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/leadgenerator?tab=importeren')
    const n = Date.now() % 100000
    const csv = schrijfCsv([KOP, ...Array.from({ length: 5 }, (_, i) => [`Testwizard ${n} ${i}`, '', '', `${1000 + ((n * 7 + i) % 8999)} AA`, 'Amersfoort', '', 'Ed', `Testwizard${n}${i}`, '', '', String(i + 3), ''])])
    await page.getByTestId('bestand').setInputFiles({ name: 'wizard.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByTestId('label').fill('Test wizard')
    await page.getByTestId('volgende-1').click()
    await expect(page.locator('[data-kolom="Bedrijfsnaam"]')).toHaveValue('naam')
    await page.getByTestId('volgende-2').click()
    await expect(page.getByTestId('rapport')).toContainText('5 nieuw')
    await page.getByTestId('volgende-3').click()
    await page.getByTestId('importeren').click()
    await expect(page.getByTestId('samenvatting')).toContainText('5 nieuw')
    await expect(page.locator('[data-test="batches"]')).toContainText('Test wizard')
  })
})
