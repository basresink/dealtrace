// Concepten: raster van kaarten in de opzet van de inzichtkaarten, filters met tellers in de URL en de
// conceptflyout met account, contact en de besluitroute.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('Concepten', () => {
  test('raster van drie kaarten per rij, met dezelfde marges als Inzichten', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/inzichten')
    const inzichtenX = (await page.getByTestId('inzichten-aantal').boundingBox())!.x
    await ga(page, '/concepten?status=alle')
    const kop = (await page.getByTestId('concepten-aantal').boundingBox())!
    expect(Math.abs(kop.x - inzichtenX)).toBeLessThan(2)
    const kaarten = page.getByTestId('concepten').locator('> article')
    expect(await kaarten.count()).toBeGreaterThanOrEqual(3)
    const box = await Promise.all([0, 1, 2].map(async (i) => (await kaarten.nth(i).boundingBox())!))
    expect(Math.abs(box[0]!.y - box[2]!.y)).toBeLessThan(2)
    expect(box[1]!.x).toBeGreaterThan(box[0]!.x + box[0]!.width - 1)
    // Elke kaart heeft een soort, een status en een kopbalk met Klant of Prospect.
    await expect(kaarten.first().getByTestId('concept-soort')).not.toBeEmpty()
    await expect(kaarten.first().getByTestId('concept-status')).not.toBeEmpty()
    await expect(kaarten.first()).toContainText(/Prospect|Klant/)
  })

  test('filters op status, soort, agent, account en periode staan in de URL en tellen mee', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/concepten')
    const open = Number(await page.getByTestId('status-open').locator('.pil-teller').textContent())
    await expect(page.getByTestId('concepten-aantal')).toContainText(`${open} `)
    await page.getByTestId('status-alle').click()
    await expect(page).toHaveURL(/status=alle/)
    await page.getByTestId('soort-mail').click()
    await expect(page).toHaveURL(/type=mail/)
    const mails = Number(await page.getByTestId('soort-mail').locator('.pil-teller').textContent())
    await expect(page.getByTestId('concepten').locator('> article')).toHaveCount(mails)
    for (const s of await page.getByTestId('concept-soort').allTextContents()) expect(s.trim()).toBe('Mail')
    await page.getByTestId('status-verstuurd').click()
    await expect(page).toHaveURL(/status=verstuurd/)
    for (const s of await page.getByTestId('concept-status').allTextContents()) expect(s.trim()).toBe('Verstuurd')
    await page.getByTestId('concepten-filters').click()
    await page.getByTestId('agent-schrijver').click()
    await expect(page).toHaveURL(/agent=schrijver/)
    await page.getByTestId('sinds-kwartaal').click()
    await expect(page).toHaveURL(/sinds=kwartaal/)
    await page.getByTestId('concepten-zoek').fill('bestaat-niet-xyz')
    await expect(page).toHaveURL(/zoek=bestaat-niet-xyz/)
    await expect(page.getByTestId('concepten-aantal')).toContainText('0 concepten')
    await page.getByTestId('concepten-reset').click()
    await expect(page).not.toHaveURL(/zoek=|type=|agent=|sinds=|status=/)
  })

  test('een klik op een kaart opent de flyout met account, contact en goedkeuren', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/concepten?status=klaar&type=mail')
    const kaart = page.getByTestId('concepten').locator('> article').first()
    const id = (await kaart.getAttribute('data-test'))!.replace(/^concept-/, '')
    await kaart.click()
    const f = page.getByTestId('concept-flyout')
    await expect(f).toBeVisible()
    await expect(f.getByTestId('concept-volledig')).not.toBeEmpty()
    await expect(f.getByTestId('concept-account')).toHaveAttribute('href', /^\/accounts\//)
    await expect(f.getByTestId('concept-contact')).toHaveAttribute('href', /^\/contacten\//)
    // Aanpassen en goedkeuren; het besluit onderscheppen we zodat de seed van Eva blijft.
    let body: any = null
    await page.route(`**/api/concepten/${id}/besluit`, async (r) => { body = r.request().postDataJSON(); await r.fulfill({ status: 200, json: { id, status: 'goedgekeurd' } }) })
    await f.getByTestId('concept-aanpassen').click()
    await f.getByTestId('concept-tekst').fill('Aangepaste tekst voor de test.')
    await f.getByTestId('concept-bewaar-goedkeur').click()
    await expect.poll(() => body).toMatchObject({ besluit: 'goedkeuren', tekst: 'Aangepaste tekst voor de test.' })
    await page.getByTestId('concept-flyout-sluit').click()
    await expect(f).toHaveCount(0)
    // Deep link opent het concept meteen.
    await ga(page, `/concepten?concept=${id}`)
    await expect(page.getByTestId('concept-flyout')).toBeVisible()
  })
})
