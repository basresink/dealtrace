// Helpcenter-weergave (wensen opdrachtgever): tussenkoppen in de hulpflyout en het artikel staan vet in de
// koppenletter; op /helpcenter tonen de drie secties elk zes artikelen als kaarten met "Alle artikelen in";
// de categorieën staan als filter-pillen onder de kop (met Meer categorieën); terug gaat via het kruimelpad;
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

    test('de start: drie secties met zes kaarten en Alle artikelen in, geen Voor jou of Nieuw en bijgewerkt', async ({ page }) => {
      await login(page, 'u-01')
      await ga(page, '/helpcenter')
      await expect(page.getByTestId('voor-jou')).toHaveCount(0)
      await expect(page.getByTestId('bijgewerkt')).toHaveCount(0)
      await expect(page.getByText('Nieuw en bijgewerkt')).toHaveCount(0)
      for (const [groep, naam, pad] of [['groep-instructies', 'Hoe werkt Dealtrace', '/helpcenter/instructies'], ['groep-academie', 'New business', '/helpcenter/academie'], ['groep-tips', 'Tips & Tricks', '/helpcenter/tips']] as const) {
        const g = page.getByTestId(groep)
        await expect(g.locator('[data-test^="help-kaart-"]'), groep).toHaveCount(6)
        await expect(g.locator('li'), `${groep}: geen lijst`).toHaveCount(0)
        await expect(g.locator('.hg-link'), groep).toHaveText(`Alle artikelen in ${naam}`)
        await expect(g.locator('.hg-link'), groep).toHaveAttribute('href', pad)
      }
      await geenHorizontaleScroll(page, breedte)
      await page.getByTestId('groep-instructies').locator('.hg-link').click()
      await expect(page).toHaveURL(/\/helpcenter\/instructies$/)
    })

    test('de categorieën als filter-pillen onder de kop, met Meer categorieën', async ({ page }) => {
      await login(page, 'u-01')
      await ga(page, '/helpcenter')
      const nav = page.getByTestId('help-categorieen')
      await expect(nav).toBeVisible()
      const pillen = nav.locator('[data-test^="hc-cat-"]:not([data-test="hc-cat-meer"])')
      const alle = await pillen.count()
      expect(alle).toBeGreaterThan(6)
      const zichtbaar = async () => (await pillen.evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length))
      expect(await zichtbaar()).toBe(breedte < 720 ? 3 : 6)
      const meer = nav.getByTestId('hc-cat-meer')
      await expect(meer).toHaveAttribute('aria-expanded', 'false')
      // De zichtbare pillen staan op een regel.
      const tops = await pillen.evaluateAll((els) => [...new Set(els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().top)))])
      expect(tops.length).toBe(1)
      await meer.click()
      await expect(meer).toHaveAttribute('aria-expanded', 'true')
      expect(await zichtbaar()).toBe(alle)
      await geenHorizontaleScroll(page, breedte)
      if (breedte < 720) {
        for (const h of await pillen.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44)
        expect((await meer.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      await nav.getByTestId('hc-cat-Bezwaren').click()
      await expect(page).toHaveURL(/\/helpcenter\/categorie\/bezwaren$/)
      await expect(page.getByTestId('hc-cat-Bezwaren')).toHaveClass(/filter-pil--aan/)
      await expect(page.getByTestId('hc-cat-Bezwaren')).toHaveAttribute('aria-current', 'page')
      await expect(page.getByTestId('hc-cat-Bezwaren')).toBeVisible()
    })

    test('terug via het kruimelpad, geen terugknop rechtsboven', async ({ page }) => {
      await login(page, 'u-01')
      const paden: [string, string[]][] = [
        ['/helpcenter/instructies', ['Helpcenter', 'Hoe werkt Dealtrace']],
        ['/helpcenter/academie', ['Helpcenter', 'New business']],
        ['/helpcenter/tips', ['Helpcenter', 'Tips & Tricks']],
        ['/helpcenter/categorie/dagelijks-werk', ['Helpcenter', 'Hoe werkt Dealtrace', 'Dagelijks werk']],
        ['/helpcenter/vandaag-lezen-en-afronden', ['Helpcenter', 'Hoe werkt Dealtrace', 'Aan de slag', 'Vandaag lezen en afronden']],
        ['/helpcenter?zoek=poging', ['Helpcenter', 'Zoekresultaten']],
      ]
      for (const [pad, niveaus] of paden) {
        await ga(page, pad)
        const kp = page.getByRole('navigation', { name: 'Kruimelpad' })
        await expect(kp, pad).toBeVisible()
        await expect(kp.locator('li'), pad).toHaveText(niveaus.map((n, i) => new RegExp(`${i ? '›\\s*' : ''}${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)))
        // Elk niveau behalve de pagina zelf is een link; de pagina zelf is aria-current.
        await expect(kp.locator('a[href]'), pad).toHaveCount(niveaus.length - 1)
        await expect(kp.locator('[aria-current="page"]'), pad).toHaveText(niveaus.at(-1)!)
        if (breedte < 720) for (const h of await kp.locator('a').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h, pad).toBeGreaterThanOrEqual(44)
        await expect(page.getByTestId('terug-helpcenter'), pad).toHaveCount(0)
        await expect(page.getByTestId('terug-overzicht'), pad).toHaveCount(0)
        await expect(page.getByTestId('kop-knoppen').locator('a[href^="/helpcenter"]'), pad).toHaveCount(0)
        await expect(page.getByTestId('help-categorieen'), pad).toBeVisible()
        await geenHorizontaleScroll(page, breedte)
      }
      // Het artikel: de categorie staat aan, het kruimelpad gaat per niveau terug.
      await ga(page, '/helpcenter/vandaag-lezen-en-afronden')
      await expect(page.getByTestId('hc-cat-Aan de slag')).toHaveClass(/filter-pil--aan/)
      await page.getByTestId('kruimel-overzicht').click()
      await expect(page).toHaveURL(/\/helpcenter\/instructies$/)
      await page.getByRole('navigation', { name: 'Kruimelpad' }).getByRole('link', { name: 'Helpcenter' }).click()
      await expect(page).toHaveURL(/\/helpcenter$/)
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
