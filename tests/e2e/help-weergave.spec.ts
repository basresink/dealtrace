// Helpcenter-weergave (wensen opdrachtgever): tussenkoppen in de hulpflyout en het artikel staan vet in de
// koppenletter; op /helpcenter toont elk categorieblok hooguit zes artikelen met "Toon alle" als er meer zijn;
// de kaarten van Verder zoeken zijn een licht grijs vlak met donkere tekst (niet zwart), ook onder een artikel.
// Op 1280 en 390 px, zonder horizontale scroll.
import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ timeout: 120_000 })

/** Helderheid van een css-kleur (0 zwart, 255 wit). */
const helderheid = (kleur: string) => { const [r, g, b] = (kleur.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).map(Number); return 0.299 * r! + 0.587 * g! + 0.114 * b! }

async function geenHorizontaleScroll(page: Page, breedte: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
}

for (const breedte of [1280, 390]) {
  test.describe(`Helpcenter op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('categorieblokken met hooguit zes artikelen en Toon alle', async ({ page }) => {
      await login(page, 'u-01')
      await ga(page, '/helpcenter')
      const blok = page.getByTestId('categorie-blok-Dagelijks werk')
      await expect(blok).toBeVisible()
      const lijst = page.getByTestId('categorie-lijst-Dagelijks werk')
      await expect(lijst.locator('li')).toHaveCount(6)
      await expect(page.getByTestId('categorie-alle-Dagelijks werk')).toContainText(/Toon alle \d+ artikelen/)
      // Een categorie met minder dan zes artikelen toont ze allemaal, zonder Toon alle.
      const tips = page.getByTestId('groep-tips').locator('.hc-categorie').first()
      const aantal = await tips.locator('li').count()
      expect(aantal).toBeGreaterThan(0)
      expect(aantal).toBeLessThanOrEqual(6)
      await geenHorizontaleScroll(page, breedte)
      // Een artikel in het blok opent het artikel; Toon alle opent de categorie.
      await lijst.locator('a').first().click()
      await expect(page).toHaveURL(/\/helpcenter\/[a-z0-9-]+$/)
      await expect(page.getByTestId('artikel-titel')).toBeVisible()
      await ga(page, '/helpcenter')
      await page.getByTestId('categorie-alle-Dagelijks werk').click()
      await expect(page).toHaveURL(/\/helpcenter\/categorie\/dagelijks-werk$/)
    })

    test('Verder zoeken is een licht grijs vlak met donkere tekst, ook onder een artikel', async ({ page }) => {
      await login(page, 'u-01')
      for (const pad of ['/helpcenter', '/helpcenter/instructies', '/helpcenter/vandaag']) {
        await ga(page, pad)
        const kaart = page.getByTestId('help-verder').locator('.hs-kaart').first()
        await expect(kaart, pad).toBeVisible()
        const { vlak, tekst } = await kaart.evaluate((el) => ({ vlak: getComputedStyle(el).backgroundColor, tekst: getComputedStyle(el.querySelector('h3')!).color }))
        expect(helderheid(vlak), `${pad}: ${vlak}`).toBeGreaterThan(200)
        expect(helderheid(vlak), `${pad}: geen wit vlak`).toBeLessThan(252)
        expect(helderheid(tekst), `${pad}: ${tekst}`).toBeLessThan(80)
      }
      await geenHorizontaleScroll(page, breedte)
    })

    test('tussenkoppen staan vet in de hulpflyout en in het artikel', async ({ page }) => {
      await login(page, 'u-01')
      await ga(page, '/taken')
      await page.getByTestId('hulp-knop').first().click()
      const flyout = page.getByTestId('hulp-flyout')
      const kop = flyout.locator('.help-tekst h3').first()
      await expect(kop).toBeVisible()
      const stijl = await kop.evaluate((el) => ({ gewicht: Number(getComputedStyle(el).fontWeight), letter: getComputedStyle(el).fontFamily }))
      expect(stijl.gewicht).toBeGreaterThanOrEqual(700)
      expect(stijl.letter).toContain('Source Serif')
      await ga(page, '/helpcenter/vandaag-lezen-en-afronden')
      const blokKop = page.getByTestId('artikel-inhoud').locator('.ha-blok-kop').first()
      await expect(blokKop).toHaveText('Van boven naar beneden')
      expect(Number(await blokKop.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700)
      await geenHorizontaleScroll(page, breedte)
    })
  })
}
