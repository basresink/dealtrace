// De knop Meer op de accountkaart en de contactkaart: een venster met korte kaders (titel, één regel, pijl)
// die elk hun eigen venster openen: Briefing, Volgen, Invloed, Belscript, Dossier, Kwalificatie, Reis,
// Campagnes en Accountplan. Info staat als knop in de kop. ?meer=<id> opent een venster direct.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('Meer op de accountkaart', () => {
  test.describe.configure({ timeout: 180_000 })

  test('1280: kaders onder elkaar, elk opent zijn eigen venster', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a04')
    await page.getByTestId('kop-meer').click()
    const meer = page.getByTestId('meer-flyout')
    await expect(meer).toBeVisible()
    const ids = await meer.locator('.mf-kader').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    for (const id of ['briefing-knop', 'knop-volgen', 'knop-invloed', 'meer-belscript', 'meer-dossier', 'meer-kwalificatie', 'meer-reis', 'meer-campagnes', 'meer-accountplan']) expect(ids).toContain(id)
    for (const id of ['info-knop', 'meer-ritme']) expect(ids).not.toContain(id)
    // Elk kader heeft een titel, een regel uitleg of stand en een pijl.
    const kwalificatie = meer.getByTestId('meer-kwalificatie')
    await expect(kwalificatie.locator('.mf-titel')).toHaveText('Kwalificatie')
    await expect(kwalificatie.locator('.mf-regel')).toContainText(/BAND \d van 4/)
    await expect(kwalificatie.locator('.mf-pijl')).toBeVisible()
    // Geen telefoonkaders op de laptop.
    await expect(meer.getByTestId('scan-visitekaartje')).toHaveCount(0)

    const vensters: [string, string, string][] = [
      ['meer-dossier', 'dossier-flyout', 'dossier'],
      ['meer-kwalificatie', 'kwalificatie-flyout', 'band'],
      ['meer-reis', 'reis-flyout', 'reis-blok'],
      ['meer-campagnes', 'campagnes-flyout', 'kaart-campagnes'],
      ['meer-accountplan', 'accountplan-flyout', 'ak-accountplannen'],
    ]
    for (const [kader, venster, inhoud] of vensters) {
      if (!(await page.getByTestId('meer-flyout').count())) await page.getByTestId('kop-meer').click()
      await page.getByTestId('meer-flyout').getByTestId(kader).click()
      // Kiezen sluit Meer en opent het venster van het kader.
      await expect(page.getByTestId('meer-flyout')).toHaveCount(0)
      await expect(page.getByTestId(venster).getByTestId(inhoud)).toBeVisible()
      // Escape brengt je terug naar Meer.
      await page.keyboard.press('Escape')
      await expect(page.getByTestId(venster)).toHaveCount(0)
      await expect(page.getByTestId('meer-flyout')).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('meer-flyout')).toHaveCount(0)

    // Belscript: de bewaarde versie of het standaardscript, met een link naar de Belscript Studio.
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('meer-belscript').click()
    const bs = page.getByTestId('belscript-flyout')
    await expect(bs.getByTestId('bsf-stand')).toBeVisible({ timeout: 60_000 })
    await expect(bs.getByTestId('bsf-studio')).toHaveAttribute('href', '/belscripts?tab=prospect&prospect=eva-a04')
    // Terug met de knop Meer in de kop: Meer staat weer open.
    await bs.getByTestId('fs-terug').click()
    await expect(bs).toHaveCount(0)

    // Volgen en Invloed openen hun bestaande vensters.
    await page.getByTestId('meer-flyout').getByTestId('knop-invloed').click()
    await expect(page.getByTestId('invloed-flyout')).toBeVisible()
  })

  test('?meer=dossier opent het venster direct; Info heeft de huidige leverancier', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a04?meer=dossier')
    await expect(page.getByTestId('dossier-flyout').getByTestId('dossier')).toBeVisible()
    await page.keyboard.press('Escape')
    const a = await (await page.request.get('/api/accounts/eva-a04')).json()
    await page.getByTestId('info-knop').click()
    const leverancier = page.getByTestId('info-flyout').getByTestId('if-leverancier')
    if (a.soort === 'prospect' && (a.concurrenten?.length || a.huidigeLeverancier)) await expect(leverancier).toBeVisible()
    else await expect(leverancier).toHaveCount(0)
  })

  test('390: kaders van minstens 44 px en geen horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a04')
    await page.getByTestId('kop-meer').click()
    const meer = page.getByTestId('meer-flyout')
    await expect(meer).toBeVisible()
    for (const h of await meer.locator('.mf-kader').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44)
    expect((await page.getByTestId('meer-flyout-sluit').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await meer.getByTestId('meer-reis').click()
    await expect(page.getByTestId('reis-flyout')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
