// P07 op de telefoon: Taken zonder horizontale scroll, de taakflyout als schuifvenster,
// uitkomsttegels van minstens 44 px, en afronden offline: precies één keer na herstel.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

/** Een naam die niet op andere testnamen lijkt (de dubbelcheck kijkt naar gelijkenis). */
const naam = () => Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => 'bcdfghjklmnprstvwz'[Math.floor(Math.random() * 18)] + 'aeiou'[Math.floor(Math.random() * 5)]).join('').slice(0, 7)).join(' ')

test('offline afronden met "Ongedaan maken"-strook, en na herstel precies één keer', async ({ page, context }) => {
  await apiLogin(page.request, 'u-03')
  const { id } = await (await page.request.post('/api/accounts', { data: { naam: naam() } })).json()
  await page.request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'gekwalificeerd' } })
  const taak = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken).find((t: any) => t.account?.id === id && t.poging)
  await login(page, 'u-03')
  await ga(page, `/taken?taak=${taak.id}`)
  const breed = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(breed).toBeLessThanOrEqual(0)
  const kader = await page.getByTestId('taak-flyout').boundingBox()
  expect(kader!.y).toBeGreaterThan(50)
  for (const k of await page.locator('.uitkomst-knop').all()) expect((await k.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await context.setOffline(true)
  await page.getByTestId('uitkomst-geen_reactie').click()
  await page.getByTestId('afronden').click()
  await expect(page.getByTestId('afrond-strook')).toContainText('Ongedaan maken')
  // De strook staat boven de onderste navigatie, niet eroverheen.
  const strook = (await page.getByTestId('afrond-strook').boundingBox())!
  const nav = await page.locator('.onderbalk').boundingBox()
  if (nav) expect(strook.y + strook.height).toBeLessThanOrEqual(nav.y)
  await expect(page.locator('.toast').last()).toContainText('Bewaard op je telefoon', { timeout: 10_000 })
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(async () => {
    const kaart = await (await page.request.get(`/api/accounts/${id}`)).json()
    return kaart.tijdlijn.filter((t: any) => t.soort === 'gebeld').length
  }, { timeout: 15_000 }).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(1500)
  const kaart = await (await page.request.get(`/api/accounts/${id}`)).json()
  expect(kaart.tijdlijn.filter((t: any) => t.soort === 'gebeld')).toHaveLength(1)
})

test('Ongedaan maken: de taak blijft open', async ({ page }) => {
  await apiLogin(page.request, 'u-03')
  const { id } = await (await page.request.post('/api/accounts', { data: { naam: naam() } })).json()
  await page.request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'gekwalificeerd' } })
  const taak = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken).find((t: any) => t.account?.id === id && t.poging)
  await login(page, 'u-03')
  await ga(page, `/taken?taak=${taak.id}`)
  await page.getByTestId('uitkomst-geen_reactie').click()
  await page.getByTestId('afronden').click()
  await page.getByTestId('ongedaan').click()
  await page.waitForTimeout(5500)
  const t = await (await page.request.get(`/api/tasks/${taak.id}`)).json()
  expect(t.status).toBe('open')
})
