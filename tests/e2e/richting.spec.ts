import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

// Richting (mockup "Richting verbeterd"): kop "Waar we voor staan", zeven tabbladen met teller die
// plakken en met de pijltjes werken, per tabblad "Waarom dit ertoe doet", concurrenten met filter en
// wat er per niveau kan. Op 1280 en 390 px.

async function open(page: Page, gebruiker: string, pad = '/richting') {
  await login(page, gebruiker)
  await ga(page, pad)
}

for (const breedte of [1280, 390]) {
  test.describe(`Richting op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('kop, tabbladen met teller en pijltjes, waarom-blok en geen horizontale scroll', async ({ page }) => {
      await open(page, 'u-07')
      await expect(page.getByTestId('paginakop')).toContainText('Richting · SalesDNA')
      const held = page.getByTestId('ri-held')
      await expect(held).toContainText('Waar we voor staan')
      await expect(page.getByTestId('ri-held-kernzin')).not.toBeEmpty()
      await expect(page.getByTestId('ri-kerncijfers').locator('[data-cijfer]')).toHaveCount(4)
      await expect(page.getByTestId('ri-held-voet')).toContainText(/\d+ van \d+ onderdelen bevestigd/)
      // Het label "Eigen inrichting" staat niet meer in de kop.
      await expect(page.getByTestId('paginakop')).not.toContainText(/eigen (in)?richting/i)
      await expect(page.getByText(/eigen (in)?richting/i)).toHaveCount(0)

      const tabs = page.getByRole('tab')
      await expect(tabs).toHaveText([/^Verhaal$/, /^Richting$/, /^Belofte$/, /^Branches\s*\d+$/, /^Concurrenten\s*\d+$/, /^Winpunten\s*\d+$/, /^Terugkomen\s*\d+$/])
      await expect(page.getByTestId('tab-verhaal')).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByTestId('ri-waarom')).toContainText('Waarom dit ertoe doet')
      await expect(page.getByTestId('vv-verhaal').getByTestId('kernzin')).toBeVisible()

      await page.getByTestId('tab-verhaal').focus()
      await page.keyboard.press('ArrowRight')
      await expect(page).toHaveURL(/tab=richting/)
      await expect(page.getByTestId('tab-richting')).toBeFocused()
      await expect(page.getByTestId('vv-richting')).toBeVisible()
      await expect(page.getByTestId('ambitiedoel').first()).toBeVisible()
      await page.keyboard.press('ArrowLeft')
      await expect(page.getByTestId('tab-verhaal')).toBeFocused()
      await page.keyboard.press('ArrowLeft')
      await expect(page).toHaveURL(/tab=terugkomen/)
      await expect(page.getByTestId('ri-tijdlijn')).toBeVisible()
      await expect(page.locator('[data-regel]').first()).toBeVisible()

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      // De tabbalk plakt bovenaan (op de telefoon onder de mobiele kop).
      await page.mouse.wheel(0, 3000)
      const top = () => page.getByTestId('ri-tabs').evaluate((el) => el.getBoundingClientRect().top)
      await expect.poll(top).toBeLessThanOrEqual(breedte < 768 ? 60 : 4)
      expect(await top()).toBeGreaterThanOrEqual(0)
    })

    test('concurrenten: filter per soort, gesprek en Stel voor bij Expert', async ({ page }) => {
      await open(page, 'u-07', '/richting?tab=concurrenten')
      const lijst = page.getByTestId('vv-concurrenten')
      const alle = await lijst.locator('[data-concurrent]').count()
      expect(alle).toBeGreaterThan(1)
      await expect(lijst.getByTestId('ri-gesprek').first()).toContainText('Prospect')
      await expect(lijst.getByTestId('hier-verliezen-we').first()).toBeVisible()
      await page.getByTestId('ri-soort-direct').click()
      await expect(page.getByTestId('ri-soort-direct')).toHaveAttribute('aria-pressed', 'true')
      const direct = await lijst.locator('[data-concurrent]').count()
      expect(direct).toBeLessThan(alle)
      await expect(lijst.locator('[data-concurrent]:not([data-soort="direct"])')).toHaveCount(0)
      await page.getByTestId('ri-soort-alle').click()
      await expect(lijst.locator('[data-concurrent]')).toHaveCount(alle)

      await expect(page.getByTestId('concurrentiekaart')).toBeVisible()
      await lijst.getByTestId('stel-voor').first().click()
      await expect(page.getByTestId('voorstel-flyout')).toBeVisible()
      await page.getByTestId('voorstel-tekst').fill('Testvoorstel: noem ook de levering op zaterdag.')
      await page.getByTestId('voorstel-stuur').click()
      await expect(page.getByText('Je voorstel staat bij je salesmanager.')).toBeVisible()
    })
  })
}

test.describe('Richting per niveau', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  test('Gevorderd downloadt de concurrentiekaart maar stelt niets voor; winpunten als reis met gaten', async ({ page }) => {
    await open(page, 'u-01', '/richting?tab=concurrenten')
    await expect(page.getByTestId('concurrentiekaart')).toBeVisible()
    await expect(page.getByTestId('stel-voor')).toHaveCount(0)
    await page.getByTestId('tab-winpunten').click()
    await expect(page.locator('[data-fase]')).not.toHaveCount(0)
    await expect(page.locator('[data-winpunt]').first()).toBeVisible()
    await expect(page.getByTestId('vv-winpunten').getByTestId('gat').first()).toContainText('Geen winpunt in')
  })
  test('Beginner leest alleen: geen concurrentiekaart en geen Stel voor', async ({ page }) => {
    await open(page, 'u-02', '/richting?tab=concurrenten')
    await expect(page.locator('[data-concurrent]').first()).toBeVisible()
    await expect(page.getByTestId('concurrentiekaart')).toHaveCount(0)
    await expect(page.getByTestId('stel-voor')).toHaveCount(0)
  })
})

// Een leeg onderdeel staat niet op Richting: geen tabblad, geen kerncijfer, geen lege kop. Het
// leesmodel wordt in de browser aangepast (client-navigatie), zodat de gedeelde database gelijk blijft.
test.describe('Richting toont alleen ingevulde onderdelen', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  async function metStand(page: Page, gebruiker: string, pas: (d: any) => void) {
    await login(page, gebruiker)
    await ga(page, '/taken')
    await page.route('**/api/richting', async (route) => {
      const res = await route.fetch()
      const d = await res.json()
      pas(d)
      await route.fulfill({ response: res, json: d })
    })
    await page.locator('a[href="/richting"]').first().click()
    await page.waitForURL(/\/richting/)
  }

  test('lege tabbladen ontbreken, de rest blijft', async ({ page }) => {
    await metStand(page, 'u-07', (d) => {
      d.stand.terugkomregels = []
      d.stand.concurrenten = []
      d.stand.teksten = d.stand.teksten.filter((t: any) => !['ambitie', 'visie', 'missie'].includes(t.sleutel))
      d.stand.ambitiedoelen = []
    })
    await expect(page.getByTestId('ri-held')).toBeVisible()
    await expect(page.getByRole('tab')).toHaveText([/^Verhaal$/, /^Belofte$/, /^Branches\s*\d+$/, /^Winpunten\s*\d+$/])
    await expect(page.getByTestId('tab-terugkomen')).toHaveCount(0)
    await expect(page.getByTestId('tab-concurrenten')).toHaveCount(0)
    await expect(page.getByTestId('tab-richting')).toHaveCount(0)
    await expect(page.locator('[data-cijfer="terugkomregels"]')).toHaveCount(0)
    await expect(page.locator('[data-cijfer="concurrenten"]')).toHaveCount(0)
    await expect(page.locator('[data-cijfer="branches"]')).toBeVisible()
  })

  test('alles leeg: ontworpen lege staat met de weg naar de inrichting voor wie mag inrichten', async ({ page }) => {
    const leeg = (d: any) => { d.stand = { teksten: [], branches: [], concurrenten: [], winpunten: [], fasen: [], terugkomregels: [], ambitiedoelen: [] }; d.branches = []; d.golden = {} }
    await metStand(page, 'u-06', leeg)
    await expect(page.getByTestId('vv-leeg')).toBeVisible()
    await expect(page.getByTestId('ri-tabs')).toHaveCount(0)
    await expect(page.getByTestId('ri-held')).toHaveCount(0)
    await expect(page.getByTestId('leeg-inrichten')).toHaveAttribute('href', '/instellingen/verkoopverhaal')
  })

  test('alles leeg voor wie alleen leest: geen knop naar de inrichting', async ({ page }) => {
    await metStand(page, 'u-02', (d) => { d.stand = { teksten: [], branches: [], concurrenten: [], winpunten: [], fasen: [], terugkomregels: [], ambitiedoelen: [] }; d.branches = []; d.golden = {} })
    await expect(page.getByTestId('vv-leeg')).toBeVisible()
    await expect(page.getByTestId('leeg-inrichten')).toHaveCount(0)
  })
})
