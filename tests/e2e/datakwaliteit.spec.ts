import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe('datakwaliteit', () => {
  test('knop Data op Mijn dashboard opent de score en de categorieen', async ({ page }) => {
    await login(page, 'u-01')
    await page.goto('/mijn-dashboard')
    await page.getByTestId('knop-data').click()
    await expect(page).toHaveURL(/\/data-kwaliteit$/)
    await expect(page.getByTestId('dk-score-getal')).toHaveText(/^\d{1,3}%$/)
    await expect(page.getByTestId('dk-bereik')).toHaveText('Je eigen accounts')
    await expect(page.locator('[data-categorie="zonderBeslisser"]')).toBeVisible()
    await expect(page.locator('[data-categorie="afsprakenZonderVerslag"]')).toBeVisible()
    // Zonder eigenaar is alleen voor managers.
    await expect(page.locator('[data-categorie="zonderEigenaar"]')).toHaveCount(0)
  })

  test('de filterknop opent de gefilterde prospectlijst met hetzelfde aantal', async ({ page, request }) => {
    await apiLogin(request, 'u-01')
    const d = await (await request.get('/api/data-kwaliteit')).json()
    const c = d.categorieen.find((x: any) => x.link)
    test.skip(!c, 'geen categorie met een filter in de testdata')
    await login(page, 'u-01')
    await page.goto('/data-kwaliteit')
    await page.locator(`[data-categorie="${c.sleutel}"]`).getByTestId('dk-filter').click()
    await expect(page).toHaveURL(new RegExp(`/prospects/alle\\?`))
    await expect(page.getByTestId('aantal')).toHaveText(`${c.aantal} ${c.aantal === 1 ? 'resultaat' : 'resultaten'}`)
  })

  test('zonder filter klapt de kaart een lijst met links uit', async ({ page, request }) => {
    await apiLogin(request, 'u-06')
    const d = await (await request.get('/api/data-kwaliteit')).json()
    expect(d.bereik).toBe('alles')
    expect(d.categorieen.some((x: any) => x.sleutel === 'zonderEigenaar')).toBe(true)
    const c = d.categorieen.find((x: any) => x.aantal && !x.link)
    test.skip(!c, 'geen categorie met een lijst in de testdata')
    await login(page, 'u-06')
    await ga(page, '/data-kwaliteit')
    const kaart = page.locator(`[data-categorie="${c.sleutel}"]`)
    await kaart.getByTestId('dk-uitklap').click()
    const lijst = kaart.getByTestId('dk-lijst')
    await expect(lijst.locator('a')).toHaveCount(c.voorbeelden.length)
    await expect(lijst.locator('a').first()).toHaveAttribute('href', c.voorbeelden[0].link)
  })

  test('Beginner krijgt de uitleg en de API weigert met reden niveau', async ({ page, request }) => {
    await apiLogin(request, 'u-02')
    const r = await request.get('/api/data-kwaliteit')
    expect(r.status()).toBe(403)
    expect((await r.json()).data.reden).toBe('niveau')
    await login(page, 'u-02')
    await page.goto('/data-kwaliteit')
    await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
  })
})
