// /inzichten: de periode Van en Tot in het filterpaneel (heden en verleden, in de URL) en afwijzen met een
// eigen reden in de flyout. De eigen reden staat daarna in de historie en het inzicht is terug te vinden onder
// Status, Afgewezen. Het testinzicht maakt Eva zelf via "+ Inzicht" (API), zodat haar tellers niet schuiven.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

const dag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

test.describe('inzichten: periode en eigen afwijsreden', () => {
  test('Van en Tot filteren heden en verleden; eigen reden komt in de historie', async ({ page }) => {
    await login(page, 'u-07')
    const eigen = ((await (await page.request.get('/api/accounts')).json()).rijen as { id: string }[])
    expect(eigen.length).toBeGreaterThan(0)
    const titel = `Periodetest ${Date.now() % 100000}`
    const r = await page.request.post('/api/signals/handmatig', { data: { accountId: eigen[0]!.id, titel, bron: 'Gesprek op de testbeurs', citaat: 'We kijken naar volgend jaar.' } })
    expect(r.ok()).toBe(true)
    const { id } = await r.json()
    const vandaag = dag(new Date())
    const gisteren = dag(new Date(Date.now() - 864e5))

    // Van en Tot in het filterpaneel; de waarden staan in de URL.
    await ga(page, '/inzichten?gelezen=alle')
    await page.getByTestId('inzicht-filters').click()
    await page.getByTestId('filter-van').fill(vandaag)
    await expect(page).toHaveURL(new RegExp(`van=${vandaag}`))
    await page.getByTestId('filter-tot').fill(vandaag)
    await expect(page).toHaveURL(new RegExp(`tot=${vandaag}`))
    await expect(page.locator(`[data-test="inzicht-${id}"]`)).toBeVisible()
    // Een periode in het verleden laat het inzicht van vandaag weg.
    await page.getByTestId('filter-tot').fill(gisteren)
    await expect(page).toHaveURL(new RegExp(`tot=${gisteren}`))
    await page.getByTestId('filter-van').fill('2025-01-01')
    await expect(page).toHaveURL(/van=2025-01-01/)
    await expect(page.locator(`[data-test="inzicht-${id}"]`)).toHaveCount(0)
    // Een snelkeuze wist Van en Tot.
    await page.getByTestId('sinds-week').click()
    await expect(page).toHaveURL(/sinds=week/)
    await expect(page).not.toHaveURL(/van=|tot=/)
    await expect(page.locator(`[data-test="inzicht-${id}"]`)).toBeVisible()
    // De API zelf: verleden zonder dit inzicht, vandaag met.
    const verleden = await (await page.request.get(`/api/signals?gelezen=alle&van=2025-01-01&tot=${gisteren}`)).json()
    expect(verleden.inzichten.some((i: any) => i.id === id)).toBe(false)
    const nu = await (await page.request.get(`/api/signals?gelezen=alle&van=${vandaag}&tot=${vandaag}`)).json()
    expect(nu.inzichten.some((i: any) => i.id === id)).toBe(true)

    // Afwijzen met een eigen reden in de flyout.
    await page.locator(`[data-test="inzicht-${id}"] .ik-titel-knop`).click()
    const fly = page.getByTestId('inzicht-flyout')
    await expect(fly).toBeVisible()
    await expect(fly.getByTestId('inzicht-historie')).toContainText('Binnengekomen')
    await fly.getByTestId('afwijs-reden').selectOption('Eigen reden')
    await expect(fly.getByTestId('wijs-af')).toBeDisabled()
    await fly.getByTestId('afwijs-eigen').fill('Loopt al via een collega van de buitendienst')
    await expect(fly.getByTestId('wijs-af')).toBeEnabled()
    const [verzoek] = await Promise.all([page.waitForRequest(`**/api/signals/${id}/afwijzen`), fly.getByTestId('wijs-af').click()])
    expect(verzoek.postDataJSON()).toEqual({ reden: 'Eigen reden', toelichting: 'Loopt al via een collega van de buitendienst' })
    await expect(fly).toHaveCount(0)
    await expect(page.locator(`[data-test="inzicht-${id}"]`)).toHaveCount(0)

    // Terug te vinden onder Status, Afgewezen, met de eigen reden op de kaart en in de historie.
    await page.getByTestId('gelezen-afgewezen').click()
    await expect(page).toHaveURL(/gelezen=afgewezen/)
    const kaart = page.locator(`[data-test="inzicht-${id}"]`)
    await expect(kaart.getByTestId('kaart-afgewezen')).toContainText('Loopt al via een collega van de buitendienst')
    await kaart.locator('.ik-titel-knop').click()
    await expect(fly.getByTestId('historie-afgewezen')).toContainText('Afgewezen met een eigen reden: Loopt al via een collega van de buitendienst')
    await expect(fly.getByTestId('afwijs-reden')).toHaveCount(0)

    // Zonder tekst weigert de server een eigen reden.
    expect((await page.request.post(`/api/signals/${id}/afwijzen`, { data: { reden: 'Eigen reden', toelichting: ' ' } })).status()).toBe(422)
  })
})
