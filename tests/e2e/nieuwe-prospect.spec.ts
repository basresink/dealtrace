// Venster "+ Prospect": geen Aantal monteurs meer, wel de velden van de accountmatrix (branche,
// aantal medewerkers, postcode, klasse, huidige leverancier) met een voorbeeld van de plek.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

/** Een unieke naam van letters, zodat de dubbelcheck hem niet met een eerdere testprospect verwart. */
const uniekeNaam = () => `Testvoorbeeld ${Array.from(Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).map((c) => String.fromCharCode(97 + (parseInt(c, 36) % 26))).join('')}`

test.describe('nieuwe prospect', () => {
  // De dev-server wordt gedeeld; het aanmaken en openen van de kaart krijgt wat ruimte.
  test.describe.configure({ timeout: 90_000 })
  test('het venster toont de matrixvelden en geen Aantal monteurs; de prospect valt meteen goed', async ({ page, request }) => {
    await login(page, 'u-03')
    await ga(page, '/prospects/alle')
    await page.getByTestId('nieuwe-prospect').click()
    const venster = page.getByTestId('nieuwe-prospect-flyout')
    await expect(venster.getByTestId('np-matrix')).toBeVisible()
    await expect(venster.getByText('Aantal monteurs', { exact: true })).toHaveCount(0)
    const naam = uniekeNaam()
    await page.getByTestId('np-naam').fill(naam)
    await page.getByTestId('np-plaats').fill('Zeist')
    await page.getByTestId('np-branche').selectOption('br-01')
    await page.getByTestId('np-medewerkers').fill('30')
    await page.getByTestId('np-postcode').fill('3701 AB')
    // 30 medewerkers is klasse C; postcode 3701 ligt in Regio Midden.
    await expect(page.getByTestId('np-plek-klasse')).toContainText('C ·')
    await expect(page.getByTestId('np-plek-regio')).toHaveText('Regio Midden')
    await page.getByTestId('np-leverancier').selectOption('cc-01')
    await page.getByTestId('np-maak').click()
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    const id = page.url().split('/').pop()!
    try {
      await apiLogin(request, 'u-03')
      const a = await (await request.get(`/api/accounts/${id}`)).json()
      expect(a.naam).toBe(naam)
      expect(a.vvBranche?.id).toBe('br-01')
      expect(a.huidigeLeverancier?.id).toBe('cc-01')
      expect(a.klasse).toBe('kl-c-prospects')
    } finally {
      await apiLogin(request, 'u-06')
      await request.delete(`/api/accounts/${id}`)
    }
  })

  test('API: klasse uit medewerkers, regio uit plaats, gekozen klasse gaat voor, onbekende branche geeft 400', async ({ request }) => {
    await apiLogin(request, 'u-03')
        const ids: string[] = []
    try {
      const r1 = await request.post('/api/accounts', { data: { naam: uniekeNaam(), plaats: 'Groningen', medewerkers: 300, vvBrancheId: 'br-02' } })
      expect(r1.status()).toBe(200)
      const a1 = await r1.json(); ids.push(a1.id)
      expect(a1.klasse).toBe('kl-a-prospects')
      expect(a1.gebiedId).toBe('regio-noord')
      const r2 = await request.post('/api/accounts', { data: { naam: uniekeNaam(), medewerkers: 300, klasse: 'kl-c-prospects' } })
      const a2 = await r2.json(); ids.push(a2.id)
      expect(a2.klasse).toBe('kl-c-prospects')
      expect((await request.post('/api/accounts', { data: { naam: uniekeNaam(), vvBrancheId: 'br-bestaat-niet' } })).status()).toBe(400)
      expect((await request.post('/api/accounts', { data: { naam: uniekeNaam(), medewerkers: -3 } })).status()).toBe(400)
    } finally {
      await apiLogin(request, 'u-06')
      for (const id of ids) await request.delete(`/api/accounts/${id}`)
    }
  })

  test('Beginner ziet alleen de basisvelden', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/prospects/alle')
    await page.getByTestId('nieuwe-prospect').click()
    await expect(page.getByTestId('nieuwe-prospect-flyout')).toBeVisible()
    await expect(page.getByTestId('np-matrix')).toHaveCount(0)
  })
})
