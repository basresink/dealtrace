// Kennisbank in de opzet van DealDrive: uploaden met koppeling, zoeken en filteren op type, het venster met
// datavelden, preview en "Vraag de AI" (mock-provider, met en zonder gelezen inhoud), verwijderen met bevestiging,
// en het tabblad Documenten op de accountkaart en de contactkaart (upload koppelt, klik opent hetzelfde venster).
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'
import { maakPdf } from '../fixtures/documenten'

const uniek = () => Date.now().toString(36)

test.describe('kennisbank', () => {
  test('uploaden met koppeling, zoeken, filteren, venster, AI-vraag en verwijderen', async ({ page }) => {
    const z = uniek()
    await login(page, 'u-01')
    await ga(page, '/kennisbank')
    await expect(page.getByTestId('paginakop')).toContainText('Wat heb je nodig?')
    await page.getByTestId('kb-nieuw').click()
    await expect(page.getByTestId('kennisbank-upload')).toBeVisible()
    await page.getByTestId('document-bestand').setInputFiles({ name: `Case Testzon ${z}.md`, mimeType: 'text/markdown', buffer: Buffer.from(`# Case\n\nDe storingen daalden met veertig procent.\n\nDe planner bespaarde vier uur per week.`) })
    await expect(page.getByTestId('document-naam')).toHaveValue(`Case Testzon ${z}.md`)
    await page.getByTestId('document-versie').fill('2')
    await page.getByTestId('kbu-account').fill('Gevelpunt')
    await page.getByTestId('kbu-account-optie').filter({ hasText: 'Gevelpunt' }).first().click()
    await expect(page.getByTestId('kbu-account-chip')).toContainText('Gevelpunt')
    await page.getByTestId('document-bewaar').click()

    // Na het uploaden opent het venster van het nieuwe document.
    const fly = page.getByTestId('document-flyout')
    await expect(fly).toBeVisible()
    await expect(page.getByTestId('ddf-kicker')).toHaveText(/Kennisbank · Case/i)
    await expect(page.getByTestId('ddf-velden')).toContainText('v2')
    await expect(page.getByTestId('ddf-velden')).toContainText('Markdown')
    await expect(page.getByTestId('ddf-klant')).toContainText('Gevelpunt')
    // Gekoppelde bedrijven zijn gewone tekstlinks naar de accountkaart, geen knoppen.
    await expect(page.getByTestId('ddf-klant')).toHaveAttribute('href', /^\/accounts\//)
    await expect(page.getByTestId('ddf-klant')).not.toHaveClass(/chip/)
    await expect(page.getByTestId('ddf-ai-inhoud')).toBeVisible()
    await expect(page.getByTestId('ddf-vraag')).toHaveCount(3)
    await page.getByTestId('ddf-eigen').click()
    await page.getByTestId('ddf-eigen-invoer').fill('Hoeveel daalden de storingen?')
    await page.getByTestId('ddf-eigen-stuur').click()
    await expect(page.getByTestId('ddf-antwoord')).toContainText('veertig procent')
    await page.keyboard.press('Escape')
    await expect(fly).toHaveCount(0)

    // Geen zoekbalk op de pagina: Filters staat rechts van "+ Document" en het zoekveld zit in het paneel.
    await expect(page.getByTestId('kb-zoek')).toHaveCount(0)
    expect((await page.getByTestId('kb-filters').boundingBox())!.x).toBeGreaterThan((await page.getByTestId('kb-nieuw').boundingBox())!.x)
    await page.getByTestId('kb-filters').click()
    // Zoeken op inhoud en filteren op type.
    await page.getByTestId('kb-zoek').fill(z)
    await expect(page).toHaveURL(new RegExp(`zoek=${z}`))
    await expect(page.getByTestId('kb-aantal')).toHaveText('1 document')
    await page.getByTestId('kb-type-case').click()
    await expect(page).toHaveURL(/type=case/)
    await expect(page.locator('[data-test^=kb-kaart-]')).toHaveCount(1)
    await page.getByTestId('kb-zoek').fill('')
    await expect(page).not.toHaveURL(/zoek=/)
    await page.getByTestId('kb-koppeling-zonder').click()
    await expect(page.locator('[data-test^=kb-kaart-]', { hasText: `Case Testzon ${z}` })).toHaveCount(0)
    await page.getByTestId('kb-reset').click()

    // Een zoekterm in de URL opent het paneel met het zoekveld gevuld.
    await ga(page, `/kennisbank?zoek=${z}`)
    await expect(page.getByTestId('kb-zoek')).toHaveValue(z)
    // Verwijderen met bevestiging.
    await expect(page.getByTestId('kb-aantal')).toHaveText('1 document')
    await page.locator('[data-test^=kb-kaart-]', { hasText: `Case Testzon ${z}` }).click()
    await page.getByTestId('ddf-verwijder').click()
    await page.getByTestId('bevestig').click()
    await expect(page.getByTestId('kb-leeg-filter')).toBeVisible()
  })

  test('een PDF met tekst wordt gelezen: de AI antwoordt uit de inhoud', async ({ page }) => {
    const z = uniek()
    await login(page, 'u-01')
    await ga(page, '/kennisbank')
    await page.getByTestId('kb-nieuw').click()
    const pdf = maakPdf([['Prijslijst onderhoud (fictief)', 'Het basispakket kost 4.800 euro per jaar.'], ['De looptijd is 36 maanden.']])
    await page.getByTestId('document-bestand').setInputFiles({ name: `Prijslijst ${z}.pdf`, mimeType: 'application/pdf', buffer: pdf })
    await page.getByTestId('document-bewaar').click()
    await expect(page.getByTestId('document-flyout')).toBeVisible()
    await expect(page.getByTestId('ddf-ai-inhoud')).toBeVisible()
    await expect(page.getByTestId('ddf-ai-zonder')).toHaveCount(0)
    await page.getByTestId('ddf-eigen').click()
    await page.getByTestId('ddf-eigen-invoer').fill('Wat is de looptijd in maanden?')
    await page.getByTestId('ddf-eigen-stuur').click()
    await expect(page.getByTestId('ddf-antwoord')).toContainText('36 maanden')
    await expect(page.getByTestId('document-flyout')).toContainText('inhoud en datavelden')
    // Zoeken vindt de PDF op zijn inhoud; daarna opruimen.
    await expect(page).toHaveURL(/document=/)
    const id = new URL(page.url()).searchParams.get('document')
    const lijst = await (await page.request.get(`/api/documenten?zoek=${encodeURIComponent('basispakket kost')}`)).json()
    expect(JSON.stringify(lijst)).toContain(`Prijslijst ${z}.pdf`)
    if (id) expect((await page.request.delete(`/api/documenten/${id}`)).ok()).toBe(true)
  })

  test('zonder gelezen inhoud zegt het venster dat de AI alleen de velden kent', async ({ page }) => {
    const z = uniek()
    await login(page, 'u-01')
    const r = await page.request.post('/api/documenten', { data: { naam: `Scan contract ${z}.pdf`, mime: 'application/pdf', data: Buffer.from('%PDF-1.4 test').toString('base64') } })
    expect(r.ok()).toBe(true)
    const { id, type, tekstStatus } = await r.json()
    expect([type, tekstStatus]).toEqual(['contract', 'niet-gelezen'])
    await ga(page, `/kennisbank?document=${id}`)
    await expect(page.getByTestId('ddf-preview-pdf')).toBeVisible()
    await expect(page.getByTestId('ddf-ai-zonder')).toContainText('Het lezen van dit bestand is mislukt')
    await expect(page.getByTestId('ddf-ai-zonder')).toContainText('alleen titel, type en koppelingen')
    // De PDF-preview laadt tegelijk; klik opnieuw als de eerste klik daardoor verloren ging.
    await expect(async () => {
      await page.getByTestId('ddf-vraag').first().click()
      await expect(page.getByTestId('ddf-antwoord').first()).toContainText('niet de inhoud', { timeout: 3000 })
    }).toPass({ timeout: 20000 })
    await expect(page.getByTestId('ddf-open')).toHaveAttribute('href', `/api/documenten/${id}/bestand`)
    expect((await page.request.get(`/api/documenten/${id}/bestand`)).headers()['content-type']).toBe('application/pdf')
    expect((await page.request.post('/api/documenten', { data: { naam: 'virus.exe', mime: 'application/x-msdownload', data: 'eA==' } })).status()).toBe(415)
    // Een collega mag het niet verwijderen.
    await apiLogin(page.request, 'u-02')
    expect((await page.request.delete(`/api/documenten/${id}`)).status()).toBe(403)
    await apiLogin(page.request, 'u-01')
    expect((await page.request.delete(`/api/documenten/${id}`)).ok()).toBe(true)
  })

  test('tabblad Documenten op de accountkaart en de contactkaart', async ({ page }) => {
    const z = uniek()
    await login(page, 'u-01')
    await ga(page, '/accounts/pr-06?tab=documenten')
    await expect(page.getByTestId('documenten-tab')).toContainText('Documenten zijn gedeeld met de kennisbank')
    await expect(page.getByTestId('naar-kennisbank')).toHaveAttribute('href', '/kennisbank')
    await page.getByTestId('document-uploaden').click()
    await expect(page.getByTestId('kbu-vast')).toContainText('Gevelpunt')
    await page.getByTestId('document-bestand').setInputFiles({ name: `Notitie ${z}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Beslissing in maart.') })
    await page.getByTestId('document-bewaar').click()
    const rij = page.locator('.ak-doc', { hasText: `Notitie ${z}.txt` })
    await expect(rij).toBeVisible()
    await expect(rij).toContainText('v1')
    await rij.locator('[data-test^=ak-document-]').click()
    await expect(page.getByTestId('ddf-klant')).toContainText('Gevelpunt')
    await page.keyboard.press('Escape')

    // Contactkaart: een upload hier koppelt het contact (en zijn account).
    const contactId = await page.evaluate(async () => (await (await fetch('/api/contacten/kies?accountId=pr-06')).json())[0].id as string)
    await ga(page, `/contacten/${contactId}?tab=documenten`)
    await expect(page.locator('.ak-doc', { hasText: `Notitie ${z}.txt` })).toHaveCount(0)
    await page.getByTestId('document-uploaden').click()
    await page.getByTestId('document-bestand').setInputFiles({ name: `Contactnotitie ${z}.md`, mimeType: 'text/markdown', buffer: Buffer.from('Wil een proef.') })
    await page.getByTestId('document-bewaar').click()
    const crij = page.locator('.ak-doc', { hasText: `Contactnotitie ${z}.md` })
    await expect(crij).toBeVisible()
    await crij.locator('[data-test^=ak-document-]').click()
    await expect(page.getByTestId('ddf-contact')).toHaveCount(1)
    await expect(page.getByTestId('ddf-klant')).toContainText('Gevelpunt')
    await page.getByTestId('ddf-verwijder').click()
    await page.getByTestId('bevestig').click()
    await expect(crij).toHaveCount(0)

    // Op de accountkaart staat het contactdocument niet meer, de accountnotitie wel; opruimen.
    await ga(page, '/accounts/pr-06?tab=documenten')
    await rij.getByTestId('document-verwijder').click()
    await page.getByTestId('bevestig').click()
    await expect(rij).toHaveCount(0)
  })
})
