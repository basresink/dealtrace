// Instellingen, Terugkomen: een regel aanpassen toont de voorbeeldberekening, de waarschuwing en wat er verschuift;
// bewaren wordt een nieuwe versie. Rechten per rol (beheerder, salesmanager, accountmanager), de lege staat, de
// doorverwijzing van nee-redenen en de telefoon (390 px) zonder horizontale scroll.
import { expect, test } from '@playwright/test'
import { apiLogin, ga } from './hulp'

test.describe.configure({ mode: 'serial' })

async function als(page: import('@playwright/test').Page, id: string, pad: string) {
  await apiLogin(page.request, id)
  await ga(page, pad)
}

test.describe('Terugkomen op 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('beheerder: regel aanpassen toont som, waarschuwing en verschuiving; bewaren geeft een nieuwe versie', async ({ page }) => {
    await als(page, 'u-06', '/instellingen/terugkomen')
    await expect(page.getByRole('heading', { name: 'Terugkomregels en ritme' })).toBeVisible()
    await page.getByTestId('tk-regel-hc-02').click()
    const form = page.getByTestId('tk-regelform')
    await expect(form.getByTestId('tk-naam')).toHaveValue('Beslissing uitgesteld')
    await expect(form.getByTestId('tk-uitkomst')).toContainText('wordt terug op')
    // Korter dan de afkoeling van mail (60): waarschuwing en droogloop.
    await form.getByTestId('tk-dagen').fill('30')
    await expect(form.getByTestId('tk-let-op')).toContainText('korter dan de afkoeling van 60 dagen')
    await expect(form.getByTestId('tk-verschuif')).toContainText(/Wat verschuift bij bewaren|Er verschuift niets/)
    await form.getByTestId('tk-annuleer').click()
    await expect(form.getByTestId('tk-dagen')).toHaveValue('61')

    // Alleen de aanpak wijzigen: er verschuift niets, wel een nieuwe versie. Daarna terugzetten.
    const aanpak = (await form.getByTestId('tk-aanpak').inputValue()).replace(/( Test\.)+$/, '')
    await form.getByTestId('tk-aanpak').fill(`${aanpak} Test.`)
    await form.getByTestId('tk-bewaar').click()
    await expect(page.locator('.toast-tekst').last()).toContainText(/Regel bewaard als versie \d+\. Er verschoof niets\./)
    await expect(form.getByTestId('tk-bewaar')).toBeDisabled()
    await form.getByTestId('tk-aanpak').fill(aanpak)
    await form.getByTestId('tk-bewaar').click()
    await expect(form.getByTestId('tk-aanpak')).toHaveValue(aanpak)
    await expect(form.getByTestId('tk-bewaar')).toBeDisabled()
  })

  test('beheerder: verliesreden naar een andere regel toont eerst wat verschuift; Annuleer laat alles staan', async ({ page }) => {
    await als(page, 'u-06', '/instellingen/terugkomen?tab=redenen')
    await expect(page.getByTestId('tk-map-Niet geschikt')).toContainText('Nooit vanzelf eerder terug')
    await page.getByTestId('tk-map-kies-Geen budget').first().selectOption('hc-01')
    const wacht = page.getByTestId('tk-map-wacht')
    await expect(wacht).toContainText('Geen budget')
    await expect(wacht.getByTestId('tk-verschuif')).toContainText(/Wat verschuift bij bewaren|Er verschuift niets/)
    await wacht.getByRole('button', { name: 'Annuleer' }).click()
    await expect(wacht).toBeHidden()
  })

  test('beheerder: afkoeling en ritme met tijdlijn en wat de accountmanager ziet', async ({ page }) => {
    await als(page, 'u-06', '/instellingen/terugkomen?tab=afkoeling')
    await page.getByTestId('tk-afk-bellen').fill('120')
    await expect(page.getByTestId('tk-verschuif')).toContainText(/Wat verschuift bij bewaren|Er verschuift niets/)
    await expect(page.getByTestId('tk-afk-bewaar')).toBeEnabled()
    await page.getByTestId('tk-tab-ritme').click()
    await expect(page.getByTestId('tk-tijdlijn')).toContainText('Geen reactie: parkeren')
    await expect(page.getByTestId('tk-am-voorbeeld')).toContainText('Poging 1 van')
    const stappen = page.locator('.trm-stap')
    const n = await stappen.count()
    await page.getByTestId('tk-stap-erbij').click()
    await expect(stappen).toHaveCount(n + 1)
    // Elke stap plus de regel voor parkeren.
    await expect(page.getByTestId('tk-tijdlijn').locator('li')).toHaveCount(n + 2)
    await expect(page.getByTestId('tk-ritme-bewaar')).toBeEnabled()
  })

  test('salesmanager: regels en ritme wel, redenen en afkoeling alleen lezen; de server weigert ook', async ({ page }) => {
    await als(page, 'u-04', '/instellingen/terugkomen')
    await expect(page.getByTestId('tk-regelform').getByTestId('tk-dagen')).toBeEnabled()
    await expect(page.getByTestId('tk-regelform').locator('[data-test^="tk-reden-"]').first()).toBeDisabled()
    await page.getByTestId('tk-tab-redenen').click()
    await expect(page.getByTestId('tk-redenen-lezen')).toBeVisible()
    await expect(page.getByTestId('tk-map-kies-Geen budget').first()).toBeDisabled()
    await page.getByTestId('tk-tab-afkoeling').click()
    await expect(page.getByTestId('tk-afk-bellen')).toBeDisabled()
    await expect(page.getByTestId('tk-afk-bewaar')).toHaveCount(0)
    const r1 = await page.request.put('/api/instellingen/terugkomen/redenen', { data: { bronSoort: 'nee', reden: 'Geen budget', terugkomregelId: 'hc-01' } })
    expect(r1.status()).toBe(403)
    const r2 = await page.request.put('/api/instellingen/terugkomen/afkoeling', { data: { afkoeling: { bellen: 90, mail: 60, linkedin: 90, whatsapp: 180, bezoek: 180, kaart: 365 } } })
    expect(r2.status()).toBe(403)
  })

  test('accountmanager: geen toegang, ook niet via de API', async ({ page }) => {
    await apiLogin(page.request, 'u-01')
    expect((await page.request.get('/api/instellingen/terugkomen')).status()).toBe(403)
    expect((await page.request.post('/api/instellingen/terugkomen/proef', { data: {} })).status()).toBe(403)
    expect((await page.request.put('/api/instellingen/terugkomen/regels/hc-02', { data: {} })).status()).toBe(403)
    expect((await page.request.post('/api/ritmes', { data: { naam: 'Test', stappen: [{ dagOffset: 0, kanaal: 'bellen' }], parkeerDagen: 30 } })).status()).toBe(403)
  })

  test('lege staat zonder regels; nee-redenen verwijst door', async ({ page }) => {
    await als(page, 'u-t1', '/instellingen/terugkomen')
    await expect(page.getByTestId('tk-leeg')).toContainText('Nog geen terugkomregels')
    await expect(page.getByTestId('tk-eerste')).toBeVisible()
    await apiLogin(page.request, 'u-06')
    await ga(page, '/instellingen/nee-redenen')
    await expect(page).toHaveURL(/\/instellingen\/terugkomen\?tab=redenen/)
  })
})

test.describe('Terugkomen op de telefoon', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('elk tabblad zonder horizontale scroll', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    for (const tab of ['regels', 'redenen', 'afkoeling', 'ritme']) {
      await ga(page, `/instellingen/terugkomen?tab=${tab}`)
      await expect(page.getByTestId(`tk-tab-${tab}`)).toHaveClass(/tab--actief/)
      const breed = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(breed, tab).toBeLessThanOrEqual(0)
    }
  })
})
