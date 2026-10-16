// Contacten in de opzet van DealDrive: top deze week, alle contacten met werkbalk, filters
// met tellers, nieuw contact, contextmenu, export, en de knoppen op de hoogte van de titel.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe('contacten', () => {
  test('top deze week: hooguit zes kaarten van eigen accounts, door naar alle contacten', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/contacten')
    const kaarten = page.getByTestId('top-contacten').locator('.portret')
    expect(await kaarten.count()).toBeGreaterThan(0)
    expect(await kaarten.count()).toBeLessThanOrEqual(6)
    await page.getByTestId('alle-contacten').click()
    await expect(page).toHaveURL(/\/contacten\/alle$/)
    await expect(page.getByTestId('kruimel')).toContainText(/contacten totaal/i)
  })

  test('alle contacten: werkbalk, rijen en filter op rol met teller die overleeft herladen', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/contacten/alle')
    const werkbalk = page.getByTestId('werkbalk')
    for (const id of ['zoek-knop', 'nieuw-contact-knop', 'lijst-taak', 'lijst-afspraak', 'weergave-knop', 'sortering', 'filters-knop']) await expect(werkbalk.getByTestId(id)).toBeVisible()
    const rij = page.getByTestId('contact-rij').first()
    await expect(rij.getByTestId('rol-pil')).toBeVisible()
    await expect(rij.getByTestId('contact-account')).toHaveAttribute('href', /^\/accounts\//)
    await page.getByTestId('filters-knop').click()
    const pil = page.getByTestId('filter-rol-beslisser')
    const teller = Number(await pil.locator('.pil-teller').textContent())
    await pil.click()
    await expect(page).toHaveURL(/rol=beslisser/)
    await expect(page.getByTestId('aantal')).toHaveText(`${teller} ${teller === 1 ? 'contact' : 'contacten'}`)
    await page.reload()
    await expect(page.getByTestId('aantal')).toHaveText(`${teller} ${teller === 1 ? 'contact' : 'contacten'}`)
    await expect(page.getByTestId('contact-rij')).toHaveCount(teller)
  })

  test('knoppen staan op de hoogte van de titel (laptop) en wrappen eronder op de telefoon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-01')
    for (const pad of ['/contacten/alle', '/prospects/alle']) {
      await ga(page, pad)
      const titel = await page.locator('h1.title').boundingBox()
      const knop = await page.getByTestId('zoek-knop').boundingBox()
      expect(knop!.y).toBeLessThan(titel!.y + titel!.height)
      expect(knop!.y + knop!.height).toBeGreaterThan(titel!.y)
    }
    for (const pad of ['/contacten', '/prospects']) {
      await ga(page, pad)
      const titel = await page.locator('h1.title').boundingBox()
      const knop = await page.getByTestId(pad === '/contacten' ? 'alle-contacten' : 'alle-prospects').boundingBox()
      expect(knop!.y).toBeLessThan(titel!.y + titel!.height)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await ga(page, '/contacten/alle')
    const titel = await page.locator('h1.title').boundingBox()
    const knop = await page.getByTestId('zoek-knop').boundingBox()
    expect(knop!.y).toBeGreaterThan(titel!.y + titel!.height - 1)
    expect(knop!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('+ Contact maakt een contact bij een gekozen bedrijf en opent de contactkaart', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/contacten/alle')
    await page.getByTestId('nieuw-contact-knop').click()
    await page.getByTestId('nc-account').fill('Vonkdal')
    await page.locator('[data-test^="nc-kies-"]').first().click()
    const naam = `Testnieuw${Date.now() % 100000}`
    await page.getByTestId('nc-achternaam').fill(naam)
    await page.getByTestId('nc-rol').selectOption('champion')
    await page.getByTestId('nc-maak').click()
    await expect(page).toHaveURL(/\/contacten\/[^/]+$/)
    await expect(page.locator('h1')).toContainText(naam)
  })

  test('contextmenu zet bel me niet; de rij toont de pil en geen bellink', async ({ page, request }) => {
    await apiLogin(request, 'u-01')
    const lijst = await (await request.get('/api/contacten?q=Testvonkd')).json()
    const c = lijst.contacten[0]
    await request.put(`/api/contacten/${c.id}`, { data: { belMeNiet: false } })
    await login(page, 'u-01')
    await ga(page, '/contacten/alle?q=Testvonkd')
    const rij = page.locator(`[data-contact="${c.id}"]`)
    await rij.click({ button: 'right' })
    await page.getByTestId('menu-bel-me-niet').click()
    await expect(rij.getByTestId('bel-me-niet-pil')).toBeVisible()
    await expect(rij.locator('a[href^="tel:"]')).toHaveCount(0)
    await request.put(`/api/contacten/${c.id}`, { data: { belMeNiet: false } })
  })

  test('API: tellers, stand, inzichten en laatste activiteit per rij; export alleen voor Expert', async ({ request }) => {
    await apiLogin(request, 'u-01')
    const r = await (await request.get('/api/contacten?pagina=1&mijn=0')).json()
    expect(r.totaal).toBeGreaterThanOrEqual(r.aantal)
    expect(r.tellers.rol).toHaveProperty('beslisser')
    expect(r.stand).toHaveProperty('accounts')
    expect(r.contacten[0]).toHaveProperty('inzichten')
    expect(r.contacten[0]).toHaveProperty('laatsteActiviteitOp')
    expect(r.contacten.length).toBeLessThanOrEqual(50)
    expect((await request.get('/api/contacten/export')).status()).toBe(403)
    const top = await (await request.get('/api/contacten/top')).json()
    expect(top.contacten.length).toBeLessThanOrEqual(6)
    await apiLogin(request, 'u-06')
    const csv = await request.get('/api/contacten/export?mijn=0')
    expect(csv.status()).toBe(200)
    expect(await csv.text()).toContain('naam;functie;rol;bedrijf')
  })
})
