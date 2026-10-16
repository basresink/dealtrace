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

  test('elke regel heeft naam, wat er ontbreekt en een link naar de accountkaart of het contact', async ({ request }) => {
    await apiLogin(request, 'u-06')
    const d = await (await request.get('/api/data-kwaliteit')).json()
    expect(d.bereik).toBe('alles')
    expect(d.categorieen.some((x: any) => x.sleutel === 'zonderEigenaar')).toBe(true)
    for (const c of d.categorieen) {
      expect(c.ontbreekt).toBeTruthy()
      for (const r of c.voorbeelden) {
        expect(r.naam).toBeTruthy()
        expect(r.ontbreekt).toBeTruthy()
        if (c.groep === 'Contacten') { expect(r.link).toMatch(/^\/contacten\//); expect(r.account).toBeTruthy() }
        if (c.groep === 'Prospects') expect(r.link).toMatch(/^\/accounts\//)
      }
    }
    // De flyout vraagt een categorie met alle regels (hooguit 500).
    const c = d.categorieen.find((x: any) => x.aantal)
    const een = await (await request.get(`/api/data-kwaliteit?categorie=${c.sleutel}`)).json()
    expect(een.aantal).toBe(c.aantal)
    expect(een.regels.length).toBe(Math.min(c.aantal, 500))
    expect((await request.get('/api/data-kwaliteit?categorie=bestaatNiet')).status()).toBe(404)
  })

  test('Bekijk opent de flyout; een regel klikt door naar de prospect', async ({ page, request }) => {
    await apiLogin(request, 'u-06')
    const d = await (await request.get('/api/data-kwaliteit')).json()
    const c = d.categorieen.find((x: any) => x.aantal && x.groep === 'Prospects')
    test.skip(!c, 'geen prospectcategorie met gaten in de testdata')
    await login(page, 'u-06')
    await ga(page, '/data-kwaliteit')
    const kaart = page.locator(`[data-test="dk-categorie"][data-categorie="${c.sleutel}"]`)
    await expect(kaart.getByTestId('dk-aantal')).toHaveText(c.aantal.toLocaleString('nl-NL'))
    await kaart.getByTestId('dk-open').click()
    await expect(page).toHaveURL(new RegExp(`categorie=${c.sleutel}`))
    const flyout = page.getByTestId('dk-flyout')
    await expect(flyout).toBeVisible()
    await expect(flyout.locator('.fo-titel')).toHaveText(c.titel)
    const rijen = flyout.getByTestId('dk-flyout-rij')
    await expect(rijen).toHaveCount(Math.min(c.aantal, 500))
    await expect(rijen.first()).toHaveAttribute('href', c.voorbeelden[0].link)
    await expect(rijen.first().getByTestId('dk-ontbreekt')).toContainText(c.voorbeelden[0].ontbreekt)
    // Sluiten haalt de categorie uit de URL; herladen met ?categorie= opent de flyout weer.
    await flyout.getByTestId('dk-flyout-sluit').click()
    await expect(page.getByTestId('dk-flyout')).toHaveCount(0)
    await expect(page).not.toHaveURL(/categorie=/)
    await ga(page, `/data-kwaliteit?categorie=${c.sleutel}`)
    await expect(page.getByTestId('dk-flyout')).toBeVisible()
    await page.getByTestId('dk-flyout-rij').first().click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${c.voorbeelden[0].id}`))
  })

  test('een contactregel in de flyout klikt door naar het contact', async ({ page, request }) => {
    await apiLogin(request, 'u-06')
    const d = await (await request.get('/api/data-kwaliteit')).json()
    const c = d.categorieen.find((x: any) => x.aantal && x.groep === 'Contacten')
    test.skip(!c, 'geen contactcategorie met gaten in de testdata')
    await login(page, 'u-06')
    await ga(page, `/data-kwaliteit?categorie=${c.sleutel}`)
    const rij = page.getByTestId('dk-flyout-rij').first()
    await expect(rij).toContainText(c.voorbeelden[0].account)
    await rij.click()
    await expect(page).toHaveURL(new RegExp(`/contacten/${c.voorbeelden[0].id}`))
  })

  test('Toon in lijst in de flyout opent de gefilterde prospectlijst met hetzelfde aantal', async ({ page, request }) => {
    await apiLogin(request, 'u-01')
    const d = await (await request.get('/api/data-kwaliteit')).json()
    const c = d.categorieen.find((x: any) => x.link)
    test.skip(!c, 'geen categorie met een filter in de testdata')
    await login(page, 'u-01')
    await ga(page, '/data-kwaliteit')
    await page.locator(`[data-categorie="${c.sleutel}"]`).getByTestId('dk-open').click()
    await page.getByTestId('dk-flyout').getByTestId('dk-filter').click()
    await expect(page).toHaveURL(/\/prospects\/alle\?/)
    await expect(page.getByTestId('aantal')).toHaveText(`${c.aantal} ${c.aantal === 1 ? 'resultaat' : 'resultaten'}`)
  })

  test('een eigen veld met "Meenemen in Datakwaliteit" wordt de controle "Zonder <veldnaam>"', async ({ page, request }) => {
    await apiLogin(request, 'u-06')
    const naam = `Testkwaliteit ${Date.now() % 100000}`
    const v = await (await request.post('/api/eigen-velden', { data: { object: 'account', naam, type: 'tekst', data: { datakwaliteit: true } } })).json()
    expect(v.data.datakwaliteit).toBe(true)
    try {
      const sleutel = `cf.account.${v.sleutel}`
      const d = await (await request.get('/api/data-kwaliteit')).json()
      const c = d.categorieen.find((x: any) => x.sleutel === sleutel)
      expect(c.titel).toBe(`Zonder ${naam}`)
      expect(c.groep).toBe('Prospects')
      expect(c.aantal).toBe(c.noemer)
      // Invullen haalt de prospect uit de controle.
      const eerste = c.voorbeelden[0]
      expect((await request.put(`/api/accounts/${eerste.id}`, { data: { customFields: { [v.sleutel]: 'Ingevuld' } } })).status()).toBe(200)
      const na = (await (await request.get(`/api/data-kwaliteit?categorie=${sleutel}`)).json())
      expect(na.aantal).toBe(c.aantal - 1)
      expect(na.regels.some((r: any) => r.id === eerste.id)).toBe(false)

      await login(page, 'u-06')
      await ga(page, '/data-kwaliteit')
      const kaart = page.locator(`[data-test="dk-categorie"][data-categorie="${sleutel}"]`)
      await expect(kaart.locator('.dk-titel')).toHaveText(`Zonder ${naam}`)
      await kaart.getByTestId('dk-open').click()
      await expect(page.getByTestId('dk-flyout').getByTestId('dk-ontbreekt').first()).toContainText(naam)

      // Uitzetten haalt de controle weg.
      expect((await request.put(`/api/eigen-velden/${v.id}`, { data: { ...v, data: { ...v.data, datakwaliteit: false } } })).status()).toBe(200)
      const uit = await (await request.get('/api/data-kwaliteit')).json()
      expect(uit.categorieen.some((x: any) => x.sleutel === sleutel)).toBe(false)
    } finally {
      await request.post(`/api/eigen-velden/${v.id}/archiveer`, { data: { gearchiveerd: true } })
    }
  })

  test('een contactveld telt mee bij de contacten; een campagneveld nooit', async ({ request }) => {
    await apiLogin(request, 'u-06')
    const stamp = Date.now() % 100000
    const contact = await (await request.post('/api/eigen-velden', { data: { object: 'contact', naam: `Testcontactkwaliteit ${stamp}`, type: 'tekst', data: { datakwaliteit: true } } })).json()
    const campagne = await (await request.post('/api/eigen-velden', { data: { object: 'campagne', naam: `Testcampagnekwaliteit ${stamp}`, type: 'tekst', data: { datakwaliteit: true } } })).json()
    try {
      expect(campagne.data.datakwaliteit).toBe(false)
      const d = await (await request.get('/api/data-kwaliteit')).json()
      const c = d.categorieen.find((x: any) => x.sleutel === `cf.contact.${contact.sleutel}`)
      expect(c.groep).toBe('Contacten')
      expect(c.aantal).toBe(c.noemer)
      if (c.voorbeelden.length) expect(c.voorbeelden[0].link).toMatch(/^\/contacten\//)
    } finally {
      await request.post(`/api/eigen-velden/${contact.id}/archiveer`, { data: { gearchiveerd: true } })
      await request.post(`/api/eigen-velden/${campagne.id}/archiveer`, { data: { gearchiveerd: true } })
    }
  })

  test('de schakelaar "Meenemen in Datakwaliteit" in Eigen velden', async ({ page, request }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/eigen-velden')
    await page.getByTestId('veld-nieuw').click()
    const naam = `Testschakel ${Date.now() % 100000}`
    await page.getByTestId('ev-naam').fill(naam)
    await page.getByTestId('ev-datakwaliteit').click()
    await page.getByTestId('ev-bewaar').click()
    const rij = page.locator('tr', { hasText: naam })
    await expect(rij.getByTestId('ev-dk-kolom')).toHaveText('Telt mee')
    await apiLogin(request, 'u-06')
    const velden = (await (await request.get('/api/eigen-velden?object=account')).json()).velden
    const v = velden.find((x: any) => x.naam === naam)
    expect(v.data.datakwaliteit).toBe(true)
    await request.post(`/api/eigen-velden/${v.id}/archiveer`, { data: { gearchiveerd: true } })
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
