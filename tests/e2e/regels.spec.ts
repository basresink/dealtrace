// P06: regels per niveau en rol, motor draaien, starterset en de accountmatrix.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe('regels', () => {
  test('Beginner: de motor is er voor iedereen (0064): regels lezen met droogloop, organisatieregels niet wijzigen', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/instellingen/regels?regel=')
    await expect(page.getByTestId('niet-aangezet-pagina')).toHaveCount(0)
    await expect(page.getByTestId('regel-lijst')).toContainText('Contact-stilte 45 dagen')
    await page.getByTestId('regel-SR06').click()
    await expect(page.getByTestId('veld-cadans')).toBeDisabled()
    await expect(page.getByTestId('droogloop')).toContainText(/raakt nu \d+ accounts/)
    await expect(page.getByTestId('draai-motor')).toHaveCount(0)
    const r = await page.request.get('/api/regels')
    expect(r.status()).toBe(200)
    const sr06 = (await r.json()).regels.find((x: any) => x.code === 'SR06')
    expect((await page.request.put(`/api/regels/${sr06.id}`, { data: { cadansDagen: 1 } })).status()).toBe(403)
  })

  test('Gevorderd: alles alleen lezen, de droogloop werkt', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/instellingen/regels?regel=')
    await expect(page.getByTestId('regel-lijst')).toContainText('Contact-stilte 45 dagen')
    await page.getByTestId('regel-SR06').click()
    await expect(page.getByTestId('regel-paneel')).toContainText('Je kunt deze regel lezen')
    await expect(page.getByTestId('veld-cadans')).toBeDisabled()
    await expect(page.getByTestId('droogloop')).toContainText(/raakt nu \d+ accounts/)
    await expect(page.getByTestId('draai-motor')).toHaveCount(0)
  })

  test('Expert: persoonlijke regel maken; een teamregel alleen voorstellen (server 403)', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/instellingen/regels')
    await page.getByTestId('regel-nieuw').click()
    await page.getByTestId('nr-naam').fill('Mijn eigen regel e2e')
    await page.getByTestId('nr-maak').click()
    await expect(page.getByTestId('regel-paneel')).toContainText('Mijn eigen regel e2e')
    await expect(page.getByTestId('veld-cadans')).toBeEnabled()
    const regels = await (await page.request.get('/api/regels')).json()
    const eigen = regels.regels.find((r: any) => r.scope === 'persoonlijk')
    expect(eigen.eigenaarId).toBe('u-07')
    const sr06 = regels.regels.find((r: any) => r.code === 'SR06')
    expect((await page.request.put(`/api/regels/${sr06.id}`, { data: { cadansDagen: 1 } })).status()).toBe(403)
    await page.getByTestId('regel-SR06').click()
    await page.getByTestId('voorstel-tekst').fill('Liever elke twee weken')
    await page.getByTestId('stel-voor').click()
    await expect(page.locator('.toast').last()).toContainText('Je voorstel staat bij je salesmanager')
    await page.request.delete(`/api/regels/${eigen.id}`)
  })

  test('Salesmanager: cadans van SR06 wijzigen geeft "Opgeslagen"; de motor draait', async ({ page }) => {
    await login(page, 'u-04')
    await ga(page, '/instellingen/regels')
    await page.getByTestId('regel-SR06').click()
    await expect(page.getByTestId('regel-paneel')).toContainText('aan of uit, cadans, drempels en klassen')
    const huidig = await page.getByTestId('veld-cadans').inputValue()
    await page.getByTestId('veld-cadans').selectOption(huidig === '14' ? '7' : '14')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')
    await page.getByTestId('draai-motor').click()
    await expect(page.locator('.toast').last()).toContainText(/Motor gedraaid\. \d+ ta(ak|ken) en \d+ inzicht/)
  })

  test('Beheerder: Starterset terugzetten laadt precies 23 regels', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/regels')
    await page.getByTestId('starterset').click()
    await page.getByRole('button', { name: 'Terugzetten', exact: true }).click()
    await expect(page.locator('.toast').last()).toContainText('starterset van 23 regels')
    const r = await (await page.request.get('/api/regels')).json()
    expect(r.regels.filter((x: any) => x.scope === 'organisatie')).toHaveLength(23)
    expect(r.regels.every((x: any) => x.data.trigger.patroon)).toBe(true)
  })

  test('Excel-export levert een werkmap; import boven 2.000 rijen of 5 MB geweigerd', async ({ request }) => {
    await apiLogin(request, 'u-06')
    const r = await request.post('/api/regels/excel-export')
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('spreadsheetml')
    const groot = await request.post('/api/regels/excel-import', { multipart: { bestand: { name: 'groot.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.alloc(5 * 1024 * 1024 + 10) }, modus: 'samenvoegen' } })
    expect(groot.status()).toBe(413)
    // Export gevolgd door een proefimport: geen fouten.
    const proef = await request.post('/api/regels/excel-import', { multipart: { bestand: { name: 'regels.xlsx', mimeType: 'application/octet-stream', buffer: await r.body() }, modus: 'samenvoegen', proef: '1' } })
    const rapport = await proef.json()
    expect(rapport.rijen.filter((x: any) => x.fouten.length)).toEqual([])
  })
})

test.describe('accountmatrix', () => {
  test('meekijken als accountmanager; beheerder zet een cel op bewust uit (0) en leeg is niet ingesteld', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/instellingen/ritme')
    await expect(page.getByTestId('meekijken')).toContainText('Alleen een beheerder wijzigt de inrichting')
    await expect(page.getByTestId('voor-mij')).toContainText('belmomenten')
    await login(page, 'u-06')
    await ga(page, '/instellingen/ritme')
    // De matrix toont alleen de klassen die de organisatie heeft (testronde B02); C bestaat altijd.
    const cel = page.getByTestId('cel-belmatrix-prospect-C')
    await cel.fill('0')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')
    await expect(page.getByTestId('label-belmatrix-prospect-C')).toHaveText('bewust uit (0)')
    await cel.fill('')
    await expect(page.getByTestId('label-belmatrix-prospect-C')).toContainText('niet ingesteld')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')
  })

  test('testronde B02 en B07: grenzen per klasse en de verwachting telt alleen prospects in reis', async ({ page, request }) => {
    await apiLogin(request, 'u-06')
    const r = await (await request.get('/api/ritme')).json()
    // Elke klasse van de prospects heeft grenzen: eigen, of de standaard voor zijn code.
    for (const k of r.klassen.filter((x: any) => x.tabblad !== 'Klanten')) expect(k.minMedewerkers ?? k.standaardGrenzen?.min, k.naam).not.toBeUndefined()
    // De matrix toont geen kolom voor een klasse die de organisatie niet heeft.
    const codes = new Set(r.klassen.map((k: any) => k.code))
    expect(r.codes.every((c: string) => codes.has(c))).toBe(true)
    // Een ongeldige grens wordt geweigerd.
    expect((await request.put('/api/settings/klassen', { data: { value: [{ id: 'kl-x', naam: 'X · Fout', minMedewerkers: 50, maxMedewerkers: 10 }] } })).status()).toBe(422)
    await login(page, 'u-06')
    await ga(page, '/instellingen/ritme')
    const rij = page.getByTestId('klasse-kl-a-prospects')
    await expect(rij.getByTestId('klasse-vanaf')).toBeVisible()
    const vanaf = rij.getByTestId('klasse-vanaf')
    expect(`${await vanaf.inputValue()}${await vanaf.getAttribute('placeholder')}`).toContain('250')
    await expect(page.getByTestId('klasse-uitleg')).toContainText('laagste klasse')
    await expect(page.getByTestId('voor-mij')).toContainText('prospects in reis')
  })
})
