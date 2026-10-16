import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

// De paginakop op elke pagina: links titel en uitleg in een eigen kolom, rechts op de hoogte van de
// titel de knoppenrij. Die begint met drie icoonknoppen (zoeken, AI, hulp) en dan de knoppen van de
// pagina. De weergave staat in het filterpaneel. En de ingeklapte zijbalk zonder overlap.

// Ruime tijd: de lokale server bouwt pagina's bij het eerste bezoek.
test.describe.configure({ timeout: 120_000 })

type Box = { x: number; y: number; width: number; height: number }
const overlapt = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function leesKop(page: Page) {
  const kop = page.locator('.sec-head--naast, .cb-kop').first()
  const knoppen = kop.getByTestId('kop-knoppen')
  // Volgorde van de zichtbare knoppen in de rij (de icoonknoppen staan in een display: contents-groep).
  const volgorde = await knoppen.evaluate((el) => [...el.querySelectorAll('button, a')]
    .filter((x) => (x as HTMLElement).offsetParent !== null && !x.closest('ul'))
    .map((x) => x.getAttribute('data-test') ?? x.textContent!.trim()))
  return { kop, knoppen, volgorde }
}

test.describe('paginakop', () => {
  for (const pad of ['/', '/agenda', '/meetings', '/prospects/alle', '/bezoeken', '/campagnes/cp-01']) {
    test(`${pad}: zoeken, AI en hulp vooraan, knoppen op titelhoogte en uitleg niet onder de knoppen`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await login(page, 'u-01')
      await ga(page, pad)
      const { kop, knoppen, volgorde } = await leesKop(page)
      expect(volgorde.slice(0, 3)).toEqual(['kop-zoeken', 'vraag-ai', 'hulp-knop'])
      expect(volgorde.length, 'na de iconen volgen de knoppen van de pagina').toBeGreaterThan(3)
      for (const id of ['kop-zoeken', 'vraag-ai', 'hulp-knop']) {
        const b = (await knoppen.getByTestId(id).boundingBox())!
        expect(Math.round(b.width)).toBe(44)
        expect(Math.round(b.height)).toBe(44)
        await expect(knoppen.getByTestId(id)).toHaveAttribute('aria-label', /.+/)
      }
      // Geen tekstknoppen "Vraag AI" en "Hulp" meer.
      await expect(knoppen.locator('button', { hasText: /^(Vraag AI|Hulp)$/ })).toHaveCount(0)

      const titel = (await kop.locator('h1').boundingBox())!
      const eerste = (await knoppen.getByTestId('kop-zoeken').boundingBox())!
      // De bovenste knoppenrij staat op de hoogte van de titel (eerste regel), niet erboven of eronder.
      expect(Math.abs(eerste.y + eerste.height / 2 - (titel.y + Math.min(titel.height, 52) / 2))).toBeLessThan(14)
      // Titel en uitleg blijven links van de knoppen.
      const rij = (await knoppen.boundingBox())!
      expect(overlapt(titel, rij)).toBe(false)
      const uitleg = kop.locator('.subtitle').first()
      if (await uitleg.count()) {
        const u = (await uitleg.boundingBox())!
        expect(u.x + u.width).toBeLessThanOrEqual(rij.x)
        expect(overlapt(u, rij)).toBe(false)
      }
    })
  }

  test('de icoonknoppen openen zoeken, de AI-chat en de hulp van de pagina', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/meetings')
    const { knoppen } = await leesKop(page)
    await knoppen.getByTestId('kop-zoeken').click()
    await expect(page.getByRole('dialog', { name: 'Zoeken in Dealtrace' })).toBeVisible()
    await page.getByRole('dialog', { name: 'Zoeken in Dealtrace' }).getByRole('button', { name: 'Sluiten' }).click()
    await knoppen.getByTestId('vraag-ai').click()
    await expect(page.getByTestId('ai-chat')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ai-chat')).toBeHidden()
    await knoppen.getByTestId('hulp-knop').click()
    await expect(page.getByTestId('hulp-flyout').locator('#hulp-titel')).not.toHaveText(/Laden|Geen artikel/)
  })

  test('telefoon: knoppen onder de tekst, alleen hulp als icoon', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-01')
    await ga(page, '/meetings')
    const { kop, knoppen } = await leesKop(page)
    await expect(knoppen.getByTestId('kop-zoeken')).toBeHidden()
    await expect(knoppen.getByTestId('hulp-knop')).toBeVisible()
    const u = (await kop.locator('.subtitle').first().boundingBox())!
    const rij = (await knoppen.boundingBox())!
    expect(rij.y).toBeGreaterThanOrEqual(u.y + u.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('weergave staat in het filterpaneel (alle prospects en agenda)', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/prospects/alle')
    await expect(page.getByTestId('weergave-knop')).toHaveCount(0)
    await page.getByTestId('filters-knop').click()
    const groep = page.getByTestId('filterpaneel').getByTestId('filter-weergave')
    if (await groep.count()) {
      await groep.getByTestId('weergave-kaarten').click()
      await expect(page.getByTestId('account-lijst')).toHaveClass(/acc-lijst--kaarten/)
      await groep.getByTestId('weergave-lijst').click()
      await expect(page.getByTestId('account-lijst')).toHaveClass(/acc-lijst--lijst/)
    }
    await ga(page, '/agenda')
    await expect(page.getByTestId('weergave-knop')).toHaveCount(0)
    await page.getByTestId('agenda-filters').click()
    await page.getByTestId('agenda-filterpaneel').getByTestId('weergave-week').click()
    await expect(page).toHaveURL(/weergave=week/)
  })
})

test.describe('zijbalk', () => {
  test('ingeklapt en uitgeklapt op 1280: merkteken en inklapknop overlappen niet', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-01')
    await ga(page, '/')
    const merk = page.locator('.app-sidebar .sb-merk-icoon')
    const knop = page.locator('.app-sidebar .sb-inklap')
    expect(overlapt((await merk.boundingBox())!, (await knop.boundingBox())!)).toBe(false)
    await page.getByRole('button', { name: 'Zijbalk inklappen' }).click()
    await expect(page.locator('.app-shell')).toHaveClass(/app-shell--ingeklapt/)
    await page.waitForTimeout(400)
    const m = (await merk.boundingBox())!
    const k = (await knop.boundingBox())!
    expect(overlapt(m, k)).toBe(false)
    // Beide binnen de strook van 64 px.
    expect(m.x + m.width).toBeLessThanOrEqual(64)
    expect(k.x + k.width).toBeLessThanOrEqual(64)
    await page.getByRole('button', { name: 'Zijbalk uitklappen' }).click()
    await expect(page.locator('.app-shell')).not.toHaveClass(/app-shell--ingeklapt/)
  })
})
