// Account (/mij) in de opzet van SalesDNA en Mijn instellingen (/mijn-instellingen) in de opzet van DealDrive.
import { expect, test } from '@playwright/test'
import { totpCode } from '../../server/utils/totp'
import { ga, login } from './hulp'

// Een kleine geldige PNG (1 bij 1 pixel).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')

test('Account: profiel wijzigen, foto kiezen en weghalen, en de controle op de velden', async ({ page }) => {
  await login(page, 'u-03')
  const oud = await (await page.request.get('/api/mij/profiel')).json()
  try {
    await ga(page, '/mij')
    await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible()
    await expect(page.getByTestId('acc-email')).toHaveValue(oud.email)
    await expect(page.getByTestId('acc-inloggen')).toContainText('code van zes cijfers')
    await expect(page.getByTestId('totp')).toBeVisible()
    // Lege voornaam: rode rand en melding, niets opgeslagen.
    await page.getByTestId('acc-voornaam').fill('')
    await page.getByTestId('acc-opslaan').click()
    await expect(page.getByTestId('acc-melding')).toHaveText('Vul je voornaam en achternaam in.')
    await expect(page.getByTestId('acc-voornaam')).toHaveAttribute('aria-invalid', 'true')
    // Ongeldig nummer weigert ook de server.
    expect((await page.request.put('/api/mij/profiel', { data: { voornaam: 'A', achternaam: 'B', telefoon: 'bel me' } })).status()).toBe(422)
    await page.getByTestId('acc-voornaam').fill('Proef')
    await page.getByTestId('acc-achternaam').fill('Persoon')
    await page.getByTestId('acc-functie').fill('Accountmanager zuid')
    await page.getByTestId('acc-telefoon').fill('+31 20 123 45 67')
    await page.getByTestId('acc-opslaan').click()
    await expect(page.getByTestId('acc-melding')).toHaveText('Je gegevens zijn opgeslagen.')
    await expect(page.locator('.sb-gebruiker-naam')).toHaveText('Proef Persoon')
    await ga(page, '/mij')
    await expect(page.getByTestId('acc-functie')).toHaveValue('Accountmanager zuid')
    // Foto: kiezen, in het menu, en weer weg.
    await page.getByTestId('acc-foto-invoer').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('acc-melding')).toHaveText('Je foto is opgeslagen.')
    await expect(page.getByTestId('acc-avatar').locator('img')).toBeVisible()
    await expect(page.locator('.sb-avatar img')).toBeVisible()
    const url = (await (await page.request.get('/api/mij/profiel')).json()).fotoUrl
    expect((await page.request.get(url)).status()).toBe(200)
    await page.getByTestId('acc-foto-weg').click()
    await page.getByTestId('bevestig').click()
    await expect(page.getByTestId('acc-melding')).toHaveText('Foto verwijderd.')
    await expect(page.getByTestId('acc-avatar').locator('img')).toHaveCount(0)
    expect((await page.request.get(url)).status()).toBe(404)
    // Geen plaatje: de server kijkt naar de inhoud.
    expect((await page.request.post('/api/mij/foto', { data: { data: Buffer.from('geen foto').toString('base64') } })).status()).toBe(415)
  } finally {
    await page.request.put('/api/mij/profiel', { data: { voornaam: oud.voornaam, achternaam: oud.achternaam, functie: oud.functie, telefoon: oud.telefoon, mobiel: oud.mobiel } })
  }
})

test('Account: de beheerder stelt tweestapsverificatie in en zet hem weer uit', async ({ page }) => {
  await login(page, 'u-06')
  await page.request.post('/api/mij/totp', { data: { stap: 'uit' } })
  await ga(page, '/mij')
  const kaart = page.getByTestId('totp')
  await expect(kaart.getByTestId('totp-stand')).toHaveText('Uit')
  await kaart.getByTestId('totp-start').click()
  const geheim = (await page.getByTestId('totp-geheim').textContent())!.trim()
  await page.getByTestId('totp-code').fill('000000')
  await page.getByTestId('totp-bevestig').click()
  await expect(page.getByTestId('totp-venster')).toContainText('klopt niet')
  await page.getByTestId('totp-code').fill(totpCode(geheim))
  await page.getByTestId('totp-bevestig').click()
  await expect(kaart.getByTestId('totp-stand')).toHaveText('Aan')
  await kaart.getByTestId('totp-uit').click()
  await page.getByTestId('bevestig').click()
  await expect(kaart.getByTestId('totp-stand')).toHaveText('Uit')
})

test('Mijn instellingen: de verplaatste blokken met navigatie per sectie', async ({ page }) => {
  await login(page, 'u-07')
  await ga(page, '/mijn-instellingen')
  await expect(page.getByRole('heading', { name: 'Jouw toestellen, jouw werkwijze.' })).toBeVisible()
  for (const t of ['toestellen', 'telefoon-modi', 'mijn-ai-verbruik']) await expect(page.getByTestId(t)).toBeVisible()
  await page.getByTestId('mi-naar-telefoon').click()
  await expect(page).toHaveURL(/\/mijn-instellingen#telefoon$/)
  await expect(page.getByTestId('telefoon-modi')).toBeInViewport()
  // Op /mij staan ze niet meer.
  await ga(page, '/mij')
  for (const t of ['toestellen', 'telefoon-modi', 'mijn-ai-verbruik', 'onderweg-meldingen', 'mijn-offline', 'mijn-scripts-kaart']) await expect(page.getByTestId(t)).toHaveCount(0)
  await page.getByTestId('acc-naar-toestellen').click()
  await expect(page).toHaveURL(/\/mijn-instellingen#toestellen$/)
})
