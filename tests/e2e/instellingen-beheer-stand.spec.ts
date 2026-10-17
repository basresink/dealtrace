// Testronde 2, beheerder: de geldende prompt per slot is te lezen (alleen lezen, met de eigen aanvulling
// ernaast), Verbruik heeft een maandkeuze en de regel Agents en automatisch, en de hub telt hetzelfde als
// de titel van de pagina (ook bij een salesmanager: zonder zichzelf, alleen de teams die hij leidt).
import { expect, test } from '@playwright/test'
import { apiLogin, ga } from './hulp'

test.describe('beheerder: prompts, verbruik en de stand op de hub', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('prompts: per slot de geldende tekst, alleen lezen', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    const api = await (await page.request.get('/api/instellingen/prompts')).json()
    const belscript = api.slots.find((s: any) => s.slot === 'belscript')
    expect(belscript.code.length).toBeGreaterThan(0)
    await ga(page, '/instellingen/prompts')
    const geldt = page.getByTestId('prompt-geldt-belscript')
    await expect(geldt).toContainText('Geldt nu')
    const verwacht = belscript.geldt === 'code' ? belscript.code[0].tekst : belscript.geldt === 'platform' ? belscript.platform : belscript.versies[0].tekst
    await expect(geldt.getByTestId('prompt-geldt-tekst').first()).toHaveText(verwacht)
    await expect(geldt.locator('textarea, input')).toHaveCount(0)
    await expect(page.getByTestId('prompt-belscript').locator('textarea')).toBeVisible()
    await expect(page.getByTestId('prompt-geldt-beoordelingsvraag')).toBeVisible()
  })

  test('verbruik: maandkeuze in de URL en de regel Agents en automatisch', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    await ga(page, '/instellingen/verbruik')
    await expect(page.getByTestId('verbruik-automatisch')).toHaveText(/^Agents en automatisch: [\d.]+ credits\./)
    const keuze = page.getByTestId('verbruik-maand')
    await expect(keuze).toBeVisible()
    await ga(page, '/instellingen/verbruik?maand=2001-01')
    await expect(keuze).toHaveValue('2001-01')
    await expect(page.getByTestId('paginakop').locator('h1')).toHaveText('0 credits gebruikt in januari 2001')
    await expect(page.getByTestId('pot')).toHaveCount(0)
    await keuze.selectOption({ index: 0 })
    await expect(page).not.toHaveURL(/maand=/)
    await expect(page.getByTestId('pot')).toBeVisible()
  })

  for (const [wie, paden] of [
    ['u-06', ['/instellingen/agents', '/instellingen/ritme', '/instellingen/belscripts', '/instellingen/regels']],
    ['u-04', ['/instellingen/gebruikers']],
  ] as const) {
    test(`hub en paginatitel tellen hetzelfde (${wie})`, async ({ page }) => {
      await apiLogin(page.request, wie)
      const stand = (await (await page.request.get('/api/instellingen/overzicht')).json()).stand
      for (const pad of paden) {
        await ga(page, pad)
        await expect(page.getByTestId('paginakop').locator('h1'), pad).toHaveText(stand[pad])
      }
      if (wie === 'u-04') {
        await ga(page, '/instellingen')
        await expect(page.getByTestId('kaart-Gebruikers en teams')).not.toContainText('Toevoegen')
      }
    })
  }
})
