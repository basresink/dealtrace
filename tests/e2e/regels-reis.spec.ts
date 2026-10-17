// Regels in de opzet van DealDrive (Activity Selling), voor Dealtrace gekoppeld aan de prospectreis en met
// winpunten aan de activiteit. Op 1280: terug naar Instellingen, Filters met paneel (fase, zonder fase),
// nieuwe regel via de flyout, een overgang in de reis als trigger, een winpunt koppelen (voorbeeld en
// droogloop tonen het), uitleg per veld, de importflyout met voorbeeldbestand en preview. Op 390: lezen
// zonder horizontale scroll en met tikdoelen van minstens 44 px.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

const NAAM = 'E2E na gekwalificeerd bellen'

async function ruimOp(request: any) {
  const r = await (await request.get('/api/regels')).json()
  for (const x of r.regels.filter((y: any) => y.naam === NAAM)) await request.delete(`/api/regels/${x.id}`)
}

test.describe('regels aan de prospectreis (1280)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('nieuwe regel met een overgang in de reis en een winpunt als gespreksonderwerp', async ({ page }) => {
    await login(page, 'u-06')
    await ruimOp(page.request)
    await ga(page, '/instellingen/regels?regel=')
    await expect(page.getByTestId('terug-instellingen')).toHaveAttribute('href', '/instellingen')

    // Nieuwe regel via de flyout, met reis en fase.
    await page.getByTestId('regel-nieuw').click()
    await page.getByTestId('nr-naam').fill(NAAM)
    await page.getByTestId('nr-fase-gekwalificeerd').check()
    await page.getByTestId('nr-maak').click()
    const paneel = page.getByTestId('regel-paneel')
    await expect(paneel).toContainText(NAAM)
    await expect(page.getByTestId('regel-geldt-in')).toContainText('Gekwalificeerd')

    // Overgang in de reis als trigger: kies een overgang uit de reis.
    await page.getByTestId('veld-patroon').selectOption('reis-overgang')
    await expect(page.getByTestId('veld-overgang')).toBeVisible()
    await page.getByTestId('param-naarFase').selectOption('gekwalificeerd')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')

    // Winpunt koppelen: het voorbeeld en de droogloop tonen het.
    const winpunten = page.getByTestId('veld-winpunten')
    const eerste = winpunten.locator('input[type="checkbox"]').first()
    const titel = (await winpunten.locator('.rp-winpunt strong').first().textContent())!.trim()
    await eerste.check()
    await page.getByTestId('veld-sjabloon').fill('Bel {account} over {winpunt}')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')
    await expect(page.getByTestId('voorbeeld')).toContainText(`Bel Testinstallatie Koperwiek over ${titel}`)
    await expect(page.getByTestId('voorbeeld-winpunt')).toContainText(titel)
    await expect(page.getByTestId('droogloop')).toContainText(/raakt nu \d+ accounts?/)

    // De server bewaarde reis, fase, trigger en winpunt.
    const r = (await (await page.request.get('/api/regels')).json()).regels.find((x: any) => x.naam === NAAM)
    expect(r.data.afbakening.faseIds).toEqual(['gekwalificeerd'])
    expect(r.data.trigger).toMatchObject({ patroon: 'reis-overgang', parameters: { naarFase: 'gekwalificeerd' } })
    expect(r.data.gevolg.winpuntIds).toHaveLength(1)
    const d = await (await page.request.post(`/api/regels/${r.id}/droogloop`, { data: {} })).json()
    expect(Array.isArray(d.accounts)).toBe(true)
    for (const a of d.accounts) expect(a.winpunt).toBe(titel)

    // Uitleg per veld.
    await paneel.getByRole('button', { name: 'Uitleg over winpunten' }).click()
    await expect(winpunten).toContainText('gespreksonderwerp')

    // Filters: fase en zonder fase.
    await page.getByTestId('regel-filters-knop').click()
    await page.getByTestId('fase-filter-gekwalificeerd').click()
    await expect(page.getByTestId('regel-lijst')).toContainText(NAAM)
    await page.getByTestId('fase-filter-geen').click()
    await expect(page.getByTestId('regel-lijst')).not.toContainText(NAAM)
    await page.getByTestId('reset-filters').click()

    // Aan en uit in het paneel; verwijderen met bevestiging.
    await page.getByTestId('regel-verwijderen').click()
    await page.locator('.cd-dialog').getByRole('button', { name: 'Verwijderen', exact: true }).click()
    await expect(page.locator('.toast').last()).toContainText('Regel verwijderd')
    await ruimOp(page.request)
  })

  test('importeren: voorbeeldbestand, eerst lezen en tellen, niets bewaard voor je kiest', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/regels')
    const voor = (await (await page.request.get('/api/regels')).json()).regels.length
    const voorbeeld = await page.request.get('/api/regels/excel-voorbeeld')
    expect(voorbeeld.status()).toBe(200)
    await page.getByTestId('importeren').click()
    await expect(page.getByTestId('import-paneel')).toContainText('Regels uit Excel inlezen')
    await expect(page.getByTestId('import-samenvoegen')).toBeDisabled()
    await page.getByTestId('import-bestand').setInputFiles({ name: 'voorbeeld.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await voorbeeld.body() })
    await expect(page.getByTestId('import-bruikbaar')).toHaveText('1')
    await expect(page.getByTestId('import-samenvoegen')).toBeEnabled()
    expect((await (await page.request.get('/api/regels')).json()).regels.length).toBe(voor)
  })

  test('rechten: een accountmanager koppelt geen winpunt aan een organisatieregel (403)', async ({ request }) => {
    await apiLogin(request, 'u-07')
    const sr03 = (await (await request.get('/api/regels')).json()).regels.find((x: any) => x.code === 'SR03')
    expect((await request.put(`/api/regels/${sr03.id}`, { data: { versie: sr03.versie, data: { gevolg: { winpuntIds: ['wp-01'] } } } })).status()).toBe(403)
  })
})

test.describe('regels op de telefoon (390)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('lezen met de reis en het winpuntblok, zonder horizontale scroll, tikdoelen minstens 44 px', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/regels?regel=')
    await expect(page.locator('.alleen-groot-melding')).toContainText('Beter op een groot scherm')
    await page.getByTestId('regel-SR03').click()
    await expect(page.getByTestId('regel-reis')).toContainText('Gekwalificeerd')
    await expect(page.getByTestId('veld-winpunten')).toBeVisible()
    await expect(page.getByTestId('veld-cadans')).toBeDisabled()
    const breed = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(breed).toBeLessThanOrEqual(0)
    await page.getByTestId('regel-filters-knop').click()
    for (const el of await page.locator('[data-test="paginakop"] button:visible, [data-test="regel-knoppen"] :is(a, button):visible, [data-test="regel-filters"] button:visible, .rp-info:visible').all()) {
      const box = await el.boundingBox()
      expect(box!.height, await el.textContent() ?? '').toBeGreaterThanOrEqual(44)
    }
  })
})
