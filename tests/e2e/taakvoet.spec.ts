// De voet van het taakvenster (opzet van DealDrive): links Afronden (zwart met gele tekst), rechts icoonknoppen van
// 44 px met aria-label en title: Vraag AI, Uitstellen (keuzemenu met een werkdag, een week, Plan een afspraak en
// Annuleer met reden), Bewerken, Verwijderen (met bevestiging) en Volgende (de volgende taak in de lijst).
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

const uniek = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const ICONEN = ['Uitstellen', 'Bewerken', 'Verwijderen', 'Volgende taak']

async function tweeTaken(page: Page) {
  await apiLogin(page.request, 'u-03')
  const maak = async (titel: string) => (await (await page.request.post('/api/tasks', { data: { title: titel, actionType: 'taak', priority: 'middel' } })).json()) as { id: string; title: string }
  return [await maak(`Voet een ${uniek()}`), await maak(`Voet twee ${uniek()}`)] as const
}

test.describe('taakvenster: voetbalk', () => {
  test('Afronden links, icoonknoppen van 44 px rechts; uitstelmenu, Volgende en verwijderen met bevestiging', async ({ page }) => {
    test.setTimeout(120_000)
    const [een] = await tweeTaken(page)
    await login(page, 'u-03')
    await ga(page, `/taken?weergave=lijst&taak=${een.id}`)
    const voet = page.getByTestId('tf-voet')
    await expect(voet).toBeVisible()
    await expect(page.locator('#tf-titel')).toHaveText(een.title)

    // Afronden: zwart met gele tekst en een vinkje, links in de voet.
    const afronden = voet.getByTestId('afronden')
    await expect(afronden).toHaveText('Afronden')
    await expect(afronden.locator('svg')).toHaveCount(1)
    const kleur = await afronden.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color])
    expect(kleur[0]).toBe('rgb(10, 10, 10)')
    expect(kleur[1]).toBe('rgb(254, 216, 0)')
    const links = (await afronden.boundingBox())!.x
    for (const naam of ICONEN) {
      const knop = voet.getByRole('button', { name: naam, exact: true })
      await expect(knop).toHaveAttribute('title', naam)
      const b = (await knop.boundingBox())!
      expect(Math.round(b.width)).toBe(44)
      expect(Math.round(b.height)).toBe(44)
      expect(b.x).toBeGreaterThan(links)
    }
    // De prullenbak is rood.
    const rood = await page.evaluate(() => { const x = document.createElement('span'); x.style.color = 'var(--red)'; document.body.append(x); const c = getComputedStyle(x).color; x.remove(); return c })
    expect(await voet.getByRole('button', { name: 'Verwijderen' }).evaluate((e) => getComputedStyle(e).color)).toBe(rood)

    // Uitstellen: een keuzemenu; een werkdag later schuift de vervaldatum op.
    const voor = (await (await page.request.get(`/api/tasks/${een.id}`)).json()).dueDate
    await voet.getByTestId('uitstellen').click()
    const menu = page.getByTestId('tf-uitstel-menu')
    await expect(menu.getByRole('menuitem')).toContainText(['Een werkdag later', 'Een week later'])
    await expect(menu.getByTestId('tf-annuleren')).toBeVisible()
    // Escape sluit eerst het menu, niet het venster.
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('taak-flyout')).toBeVisible()
    // Annuleer met reden blijft bereikbaar via het menu.
    await voet.getByTestId('uitstellen').click()
    await menu.getByTestId('tf-annuleren').click()
    await expect(page.getByTestId('annuleer-reden')).toBeFocused()
    await page.getByTestId('tf-annuleer-blok').getByRole('button', { name: 'Terug' }).click()
    await voet.getByTestId('uitstellen').click()
    await menu.getByTestId('uitstellen-werkdag').click()
    await expect(page.locator('.toast').last()).toContainText('Uitgesteld met een werkdag.')
    const na = (await (await page.request.get(`/api/tasks/${een.id}`)).json()).dueDate
    expect(Date.parse(na)).toBeGreaterThan(Date.parse(voor ?? '1970-01-01'))

    // Volgende: opent de volgende taak uit de lijst in hetzelfde venster.
    await ga(page, `/taken?weergave=lijst&taak=${een.id}`)
    await expect(page.locator('#tf-titel')).toHaveText(een.title)
    await page.getByTestId('tf-volgende').click()
    await expect(page.locator('#tf-titel')).not.toHaveText(een.title)
    await expect(page.locator('#tf-titel')).not.toHaveText('Laden…')
  })

  test('verwijderen vraagt om bevestiging; de eigenaar mag zijn taak verwijderen', async ({ page }) => {
    test.setTimeout(90_000)
    const [, twee] = await tweeTaken(page)
    await login(page, 'u-03')
    await ga(page, `/taken?weergave=lijst&taak=${twee.id}`)
    await page.getByTestId('tf-voet').getByRole('button', { name: 'Verwijderen' }).click()
    const vraag = page.getByRole('alertdialog')
    await expect(vraag).toContainText('Taak verwijderen?')
    await vraag.getByRole('button', { name: 'Annuleren' }).click()
    await expect(page.getByTestId('taak-flyout')).toBeVisible()
    expect((await page.request.get(`/api/tasks/${twee.id}`)).status()).toBe(200)
    await page.getByTestId('tf-voet').getByRole('button', { name: 'Verwijderen' }).click()
    await vraag.getByTestId('bevestig').click()
    await expect(page.locator('.toast').last()).toContainText('Taak verwijderd.')
    await expect(page.getByTestId('taak-flyout')).toHaveCount(0)
    expect((await page.request.get(`/api/tasks/${twee.id}`)).status()).toBe(404)
  })

  test('Vraag AI opent de assistent met de taak als context', async ({ page }) => {
    const [een] = await tweeTaken(page)
    await login(page, 'u-03')
    await ga(page, `/taken?weergave=lijst&taak=${een.id}`)
    const ai = page.getByTestId('tf-voet').getByRole('button', { name: 'Vraag AI' })
    test.skip(!(await ai.count()), 'De AI-assistent staat niet aan voor deze gebruiker.')
    await expect(ai).toHaveAttribute('title', 'Vraag AI')
    await ai.click()
    await expect(page.getByTestId('ai-chat')).toBeVisible()
    await expect(page.getByTestId('ai-context')).toBeVisible()
    await expect(page.getByTestId('ai-chat').locator('textarea, input[type="text"]').first()).toHaveValue(new RegExp(een.title))
  })

  test('telefoon: de voet past op 390 px en elk tikdoel is 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const [een] = await tweeTaken(page)
    await login(page, 'u-03')
    await ga(page, `/taken?weergave=lijst&taak=${een.id}`)
    const voet = page.getByTestId('tf-voet')
    await expect(voet).toBeVisible()
    for (const knop of await voet.locator('button').all()) {
      const b = (await knop.boundingBox())!
      expect(Math.round(b.height)).toBeGreaterThanOrEqual(44)
      expect(b.x + b.width).toBeLessThanOrEqual(390)
    }
    expect(await voet.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
