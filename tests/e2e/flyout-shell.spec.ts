// De flyoutstandaard (FlyoutShell): elke flyout heeft dezelfde kop met de opslaan-status (Gewijzigd, Opslaan…,
// Opgeslagen om HH:MM) in een aria-live regio, Vraag AI (de assistent met de context van de flyout, boven de
// flyout) en sluiten. Escape sluit alleen de bovenste laag, de focus gaat naar binnen en bij sluiten terug, en
// sluiten met wijzigingen die nog niet zijn opgeslagen vraagt in de flyout zelf wat je wilt. Op 390 px is de
// flyout schermvullend met tikdoelen van 44 px.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('flyoutstandaard', () => {
  test.describe.configure({ timeout: 180_000 })

  test('Info: Gewijzigd tijdens typen, daarna Opgeslagen om HH:MM in een aria-live regio', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a04')
    const voor = await (await page.request.get('/api/accounts/eva-a04')).json()
    await page.getByTestId('info-knop').click()
    const fly = page.getByTestId('info-flyout')
    await expect(fly).toBeVisible({ timeout: 30_000 })
    await expect(fly).toHaveAttribute('role', 'dialog')
    await expect(fly).toHaveAttribute('aria-labelledby', 'if-titel')
    const status = fly.getByTestId('fs-status')
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await expect(status).toHaveAttribute('data-stand', 'leeg')
    try {
      await fly.getByTestId('if-plaats-bewerk').click()
      await fly.getByTestId('if-plaats-invoer').fill(`${voor.plaats ?? 'Veenendaal'} Oost`)
      await expect(status).toHaveText('Gewijzigd')
      await fly.getByTestId('if-plaats-bewaar').click()
      await expect(status).toHaveText(/^Opgeslagen om \d{2}:\d{2}$/)
    } finally {
      await page.request.put('/api/accounts/eva-a04', { data: { plaats: voor.plaats ?? null } })
    }
  })

  test('Vraag AI opent de assistent met de context van de flyout, boven de flyout', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a04')
    await page.getByTestId('info-knop').click()
    const fly = page.getByTestId('info-flyout')
    await expect(fly).toBeVisible({ timeout: 30_000 })
    const ai = fly.getByTestId('fs-vraag-ai')
    test.skip(!(await ai.count()), 'De AI-assistent staat niet aan voor deze gebruiker.')
    await expect(ai).toHaveAttribute('aria-label', 'Vraag AI')
    expect(Math.round((await ai.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
    await ai.click()
    const chat = page.getByTestId('ai-chat')
    await expect(chat).toBeVisible()
    await expect(chat.getByTestId('ai-context')).toContainText('Testzon Veenendaal')
    await expect(chat.getByTestId('ai-voorstellen')).toContainText('Vul ontbrekende gegevens aan')
    // De flyout blijft eronder staan; Escape sluit eerst de assistent, dan de flyout.
    await expect(fly).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(chat).toHaveCount(0)
    await expect(fly).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(fly).toHaveCount(0)
  })

  test('Nieuwe taak: focus naar binnen, Tab blijft in de flyout, Escape sluit en de focus gaat terug', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/taken')
    const knop = page.getByTestId('taak-nieuw')
    await knop.focus()
    await page.keyboard.press('Enter')
    const fly = page.getByTestId('nieuwe-taak')
    await expect(fly).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Wat moet er gebeuren?' })).toBeVisible()
    await expect.poll(() => fly.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      await expect.poll(() => fly.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(fly).toHaveCount(0)
    await expect(knop).toBeFocused()
  })

  test('sluiten met wijzigingen vraagt bevestiging in de flyout', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/taken')
    await page.getByTestId('taak-nieuw').click()
    const fly = page.getByTestId('nieuwe-taak')
    await expect(fly).toBeVisible()
    await fly.getByTestId('nt-titel').fill('Bel Tamara Testzon terug over de levertijden')
    await expect(fly.getByTestId('fs-status')).toHaveText('Gewijzigd')
    // Sluiten (kruisje) vraagt het eerst; Escape laat je verder werken.
    await fly.getByRole('button', { name: 'Sluiten' }).click()
    const vraag = fly.getByTestId('fs-wijzig')
    await expect(vraag).toBeVisible()
    await expect(vraag).toContainText('Je wijzigingen zijn nog niet opgeslagen.')
    await expect(fly.getByTestId('fs-bewaar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(vraag).toHaveCount(0)
    await expect(fly.getByTestId('nt-titel')).toHaveValue('Bel Tamara Testzon terug over de levertijden')
    // Een klik naast de flyout vraagt het ook; Weggooien sluit zonder op te slaan.
    await page.mouse.click(40, 400)
    await expect(vraag).toBeVisible()
    await fly.getByTestId('fs-weggooien').click()
    await expect(fly).toHaveCount(0)
    // Opnieuw openen begint leeg en zonder status.
    await page.getByTestId('taak-nieuw').click()
    await expect(fly.getByTestId('nt-titel')).toHaveValue('')
    await expect(fly.getByTestId('fs-status')).toHaveAttribute('data-stand', 'leeg')
    await page.keyboard.press('Escape')
    await expect(fly).toHaveCount(0)
  })

  test('telefoon 390 px: schermvullend, tikdoelen van 44 px, geen horizontale scroll en één scrollbalk', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    await ga(page, '/taken')
    await page.getByTestId('taak-nieuw').click()
    const fly = page.getByTestId('nieuwe-taak')
    await expect(fly).toBeVisible()
    await page.waitForTimeout(300)
    const b = (await fly.boundingBox())!
    expect(Math.round(b.x)).toBe(0)
    expect(Math.round(b.y)).toBe(0)
    expect(Math.round(b.width)).toBe(390)
    expect(Math.round(b.height)).toBe(844)
    for (const k of await fly.locator('.fs-kop button, .fo-foot button').all()) {
      if (!(await k.isVisible())) continue
      const r = (await k.boundingBox())!
      expect(Math.round(r.height)).toBeGreaterThanOrEqual(44)
      expect(Math.round(r.width)).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await expect(page.locator('html')).toHaveClass(/scroll-slot/)
    await fly.getByRole('button', { name: 'Sluiten' }).click()
    await expect(fly).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveClass(/scroll-slot/)
  })

  test('afspraakvenster: de hoofdactie links in zwart, icoonknoppen met een label en Vraag AI in de kop', async ({ page }) => {
    await login(page, 'u-07')
    const agenda = await (await page.request.get('/api/agenda', { query: { van: '2026-10-01', tot: '2026-11-30' } })).json()
    const a = (agenda.afspraken ?? agenda.items ?? []).find((x: any) => x.status === 'gepland')
    test.skip(!a, 'Geen geplande afspraak in de mockdata.')
    await ga(page, `/agenda?afspraak=${a.id}`)
    const fly = page.getByTestId('afspraak-flyout')
    await expect(fly).toBeVisible({ timeout: 30_000 })
    const voet = fly.locator('.fo-foot')
    await expect(voet.getByTestId('af-rond-af')).toHaveClass(/dd-actie--zwart/)
    for (const naam of ['Wijzigen', 'Niet verschenen', 'Afspraak annuleren']) await expect(voet.getByRole('button', { name: naam })).toHaveAttribute('title', naam)
    if (await fly.getByTestId('fs-vraag-ai').count()) await expect(fly.getByTestId('fs-vraag-ai')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(fly).toHaveCount(0)
  })
})
