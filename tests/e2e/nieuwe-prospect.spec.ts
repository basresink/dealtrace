// Venster "+ Prospect": geen Aantal monteurs meer, wel de datavelden (naam, plaats, postcode, telefoon,
// website, e-mail, KvK-nummer) en de velden van de accountmatrix (branche, aantal medewerkers, klasse,
// huidige leverancier) voor iedereen; Gevorderd ziet daarbij live de plek, een Beginner de eenvoudige versie.
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
      expect((await request.post('/api/accounts', { data: { naam: uniekeNaam(), email: 'geen-adres' } })).status()).toBe(400)
      expect((await request.post('/api/accounts', { data: { naam: uniekeNaam(), kvk: '1234567' } })).status()).toBe(400)
    } finally {
      await apiLogin(request, 'u-06')
      for (const id of ids) await request.delete(`/api/accounts/${id}`)
    }
  })

  test('Beginner ziet alle datavelden in de eenvoudige versie en kan ze invullen', async ({ page, request }) => {
    await login(page, 'u-02')
    await ga(page, '/prospects/alle')
    await page.getByTestId('nieuwe-prospect').click()
    const venster = page.getByTestId('nieuwe-prospect-flyout')
    await expect(venster).toBeVisible()
    for (const id of ['np-plaats', 'np-postcode', 'np-telefoon', 'np-website', 'np-email', 'np-kvk', 'np-matrix', 'np-medewerkers', 'np-klasse', 'np-leverancier']) await expect(venster.getByTestId(id)).toBeVisible()
    // Geen live matrixuitleg voor een Beginner.
    await expect(venster.getByTestId('np-plek')).toHaveCount(0)
    await expect(venster.getByTestId('np-matrix-kort')).toBeVisible()
    const naam = uniekeNaam()
    const kvk = String(10_000_000 + Math.floor(Math.random() * 89_999_999))
    await page.getByTestId('np-naam').fill(naam)
    await page.getByTestId('np-plaats').fill('Zeist')
    await page.getByTestId('np-postcode').fill('3701 AB')
    await page.getByTestId('np-telefoon').fill('030 000 0000')
    await page.getByTestId('np-email').fill('info@testvoorbeeld.test')
    await page.getByTestId('np-kvk').fill(kvk)
    await page.getByTestId('np-medewerkers').fill('30')
    await page.getByTestId('np-leverancier').selectOption('cc-01')
    await page.getByTestId('np-maak').click()
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    const id = page.url().split('/').pop()!
    try {
      await apiLogin(request, 'u-02')
      const a = await (await request.get(`/api/accounts/${id}`)).json()
      expect(a).toMatchObject({ naam, plaats: 'Zeist', postcode: '3701 AB', kvk, email: 'info@testvoorbeeld.test', telefoon: '+31300000000' })
      expect(a.huidigeLeverancier?.id).toBe('cc-01')
      // Leeg gelaten klasse volgt uit het aantal medewerkers.
      expect(a.klasse).toBe('kl-c-prospects')
    } finally {
      await apiLogin(request, 'u-06')
      await request.delete(`/api/accounts/${id}`)
    }
  })

  test('testronde: klasse schuift mee met medewerkers, een kleine prospect krijgt een klasse en de dubbelcheck kijkt naar getal en plaats', async ({ request }) => {
    await apiLogin(request, 'u-03')
    const ids: string[] = []
    const basis = uniekeNaam()
    try {
      // B01: 12 medewerkers is klasse C; naar 300 wordt het A. Een met de hand gekozen klasse blijft staan.
      const r1 = await (await request.post('/api/accounts', { data: { naam: `${basis} Omvang12`, plaats: 'Utrecht', medewerkers: 12 } })).json(); ids.push(r1.id)
      expect(r1.klasse).toBe('kl-c-prospects')
      expect((await request.put(`/api/accounts/${r1.id}`, { data: { medewerkers: 300 } })).status()).toBe(200)
      expect((await (await request.get(`/api/accounts/${r1.id}`)).json()).klasse).toBe('kl-a-prospects')
      const r2 = await (await request.post('/api/accounts', { data: { naam: `${uniekeNaam()} Hand`, medewerkers: 12, klasse: 'kl-b-prospects' } })).json(); ids.push(r2.id)
      await request.put(`/api/accounts/${r2.id}`, { data: { medewerkers: 300 } })
      expect((await (await request.get(`/api/accounts/${r2.id}`)).json()).klasse).toBe('kl-b-prospects')
      // B02: 5 medewerkers geeft de laagste klasse, niet "geen klasse".
      const r3 = await (await request.post('/api/accounts', { data: { naam: `${uniekeNaam()} Klein`, medewerkers: 5 } })).json(); ids.push(r3.id)
      expect(r3.klasse).toBeTruthy()
      // B12: zelfde naam met een ander getal in een andere plaats is hooguit mogelijk dubbel (geen 409).
      const r4 = await request.post('/api/accounts', { data: { naam: `${basis} Omvang60`, plaats: 'Amersfoort', medewerkers: 60 } })
      expect(r4.status()).toBe(200)
      const a4 = await r4.json(); ids.push(a4.id)
      expect(a4.mogelijkDuplicaat?.id).toBe(r1.id)
      // Exact dezelfde naam in dezelfde plaats blijft zeker dubbel.
      expect((await request.post('/api/accounts', { data: { naam: `${basis} Omvang12`, plaats: 'Utrecht' } })).status()).toBe(409)
    } finally {
      await apiLogin(request, 'u-06')
      for (const id of ids) await request.delete(`/api/accounts/${id}`)
    }
  })
})
