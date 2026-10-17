// Testronde 2 (A3): een gepland belblok zonder gesprekken toont het vulvoorstel uit de eigen bellijst (dezelfde
// bron als Dagstart en Weekstart) met de knop Vul, op /belblokken en in de belmodus (GET /api/belblokken/:id).
// Alleen lezen: de test vult of opent geen blok, zodat Eva's data gelijk blijft.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

for (const breedte of [1280, 390]) {
  test(`een leeg belblok toont een vulvoorstel met de knop Vul (${breedte})`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
    await login(page, 'u-07')
    const d: any = await (await page.request.get('/api/belblokken')).json()
    const leeg = d.gepland.find((s: any) => s.status === 'gepland' && !s.gesprekken && s.voorstel?.length)
    test.skip(!leeg, 'Geen leeg gepland belblok met een voorstel')
    await ga(page, '/belblokken')
    await expect(page.getByTestId(`blok-voorstel-${leeg.id}`)).toContainText('Past erin:')
    await expect(page.getByTestId(`blok-voorstel-${leeg.id}`)).toContainText(leeg.voorstel[0].accountNaam)
    const knop = page.getByTestId(`vul-blok-${leeg.id}`)
    await expect(knop).toHaveText(`Vul met ${leeg.voorstel.length}`)
    if (breedte < 500) expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
    // Een blok met gesprekken krijgt geen voorstel.
    const vol = d.gepland.find((s: any) => s.gesprekken > 0)
    if (vol) await expect(page.getByTestId(`vul-blok-${vol.id}`)).toHaveCount(0)
    // De belmodus krijgt voor hetzelfde lege blok het voorstel mee.
    const bm: any = await (await page.request.get(`/api/belblokken/${leeg.id}`)).json()
    expect(bm.items).toHaveLength(0)
    expect(bm.vulVoorstel.voorstel.length).toBeGreaterThan(0)
  })
}
