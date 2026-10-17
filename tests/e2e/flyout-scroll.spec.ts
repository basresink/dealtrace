// Scrollslot: zolang een flyout open staat scrollt de pagina erachter niet en heeft ze geen eigen
// scrollbalk (maar één scrollbalk op de laptop). Na sluiten, ook na een geneste flyout, is de
// pagina weer scrollbaar en staat de layout op dezelfde plek.
import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

const scrollbaar = (page: Page) => page.evaluate(() => {
  const r = document.documentElement
  return getComputedStyle(r).overflowY !== 'hidden' && r.scrollHeight > r.clientHeight
})
const inhoudBreedte = (page: Page) => page.evaluate(() => { const r = document.querySelector('main')!.getBoundingClientRect(); return `${r.left}/${r.width}` })

test.describe('flyout en paginascroll', () => {
  test.use({ viewport: { width: 1280, height: 700 } })

  test('Info en Volgen op de accountpagina zetten de pagina vast en geven hem daarna terug', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a04')
    expect(await scrollbaar(page)).toBe(true)
    const breedte = await inhoudBreedte(page)

    await page.getByTestId('info-knop').click()
    await expect(page.getByTestId('info-flyout')).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => scrollbaar(page)).toBe(false)
    expect(await inhoudBreedte(page)).toBe(breedte)
    // Wieldraaien boven de overlay verschuift de pagina niet.
    const y = await page.evaluate(() => scrollY)
    await page.mouse.move(200, 400)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => scrollY)).toBe(y)

    await page.getByTestId('info-flyout').getByRole('button', { name: 'Sluiten' }).click()
    await expect(page.getByTestId('info-flyout')).toHaveCount(0)
    await expect.poll(() => scrollbaar(page)).toBe(true)
    expect(await inhoudBreedte(page)).toBe(breedte)

    await page.getByTestId('kop-meer').click()
    await page.getByTestId('knop-volgen').click()
    await expect(page.getByTestId('volgen-flyout')).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => scrollbaar(page)).toBe(false)
    await page.getByTestId('volgen-sluit').click()
    await expect(page.getByTestId('volgen-flyout')).toHaveCount(0)
    await expect.poll(() => scrollbaar(page)).toBe(true)
  })

  test('Taakvenster op Taken en navigeren met een open flyout', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/taken?weergave=lijst')
    await page.getByTestId('taak-titel').first().click()
    await expect(page.getByTestId('taak-flyout')).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => scrollbaar(page)).toBe(false)
    // Navigeren in de app (zonder herladen) terwijl de flyout open is: de nieuwe pagina is gewoon scrollbaar.
    await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/accounts/eva-a04'))
    await page.waitForURL('**/accounts/eva-a04')
    await expect(page.getByTestId('taak-flyout')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('scroll-slot'))).toBe(false)
    await expect.poll(() => scrollbaar(page)).toBe(true)
  })
})
