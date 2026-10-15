// P27 op de telefoon (375, 390, 412 px): compacte kop en onderbalk, geen zijbalk; de onderbalk
// is per profiel en op elk niveau gelijk; "Meer" bevat de rest; één tab licht op; 44 px.
import { expect, test } from '@playwright/test'
import { login } from './hulp'

const labels = async (page: any) => page.getByTestId('onderbalk').locator('.ob-tab').allInnerTexts()

test('compacte kop en onderbalk, geen zijbalk; knoppen minstens 44 px; geen horizontale scroll', async ({ page }) => {
  await login(page, 'u-03')
  await expect(page.getByTestId('mobiele-kop')).toBeVisible()
  await expect(page.getByTestId('onderbalk')).toBeVisible()
  await expect(page.locator('.app-sidebar')).toBeHidden()
  for (const k of await page.locator('.mk-knop, .ob-tab').all()) {
    const b = (await k.boundingBox())!
    expect(b.height).toBeGreaterThanOrEqual(44)
    expect(b.width).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test('onderbalk per profiel, gelijk op elk niveau', async ({ page }) => {
  await login(page, 'u-03')
  expect(await labels(page)).toEqual(['Vandaag', 'Belblok', 'Acties', 'Prospects', 'Meer'])
  await login(page, 'u-07')
  expect(await labels(page)).toEqual(['Vandaag', 'Belblok', 'Acties', 'Prospects', 'Meer'])
  await login(page, 'u-01')
  expect(await labels(page)).toEqual(['Vandaag', 'Route', 'Bellen', 'Prospects', 'Meer'])
  await login(page, 'u-02')
  expect(await labels(page)).toEqual(['Vandaag', 'Route', 'Bellen', 'Prospects', 'Meer'])
  await login(page, 'u-04')
  expect(await labels(page)).toEqual(['Team', 'Coaching', 'Acties', 'Prospects', 'Meer'])
})

test('Meer: Agenda, Inzichten en "Nog niet aangezet" voor een Beginner; Agenda laat Meer oplichten', async ({ page }) => {
  await login(page, 'u-02')
  await page.getByTestId('onderbalk').locator('[data-tab="meer"]').click()
  const meer = page.getByTestId('meer-venster')
  await expect(meer).toBeVisible()
  await expect(meer.locator('[data-route="/agenda"]')).toBeVisible()
  await expect(meer.getByTestId('meer-niet-aangezet')).toBeVisible()
  await expect(meer.locator('[data-route="/prospects"]')).toHaveCount(0)
  await meer.locator('[data-route="/agenda"]').click()
  await page.waitForURL(/\/agenda/)
  await expect(page.locator('.ob-tab--aan')).toHaveCount(1)
  await expect(page.locator('.ob-tab--aan')).toHaveAttribute('data-tab', 'meer')
})

test('een accountkaart hoort bij Prospects met een terugknop; Escape sluit een schuifvenster', async ({ page }) => {
  await login(page, 'u-03')
  await page.goto('/accounts/pr-01'); await page.waitForLoadState('networkidle')
  await expect(page.locator('.ob-tab--aan')).toHaveAttribute('data-tab', 'prospects')
  await expect(page.getByTestId('mk-terug')).toBeVisible()
  await page.getByTestId('mk-inspreken').click()
  await expect(page.getByText('Inspreken komt in een volgende versie.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Inspreken komt in een volgende versie.')).toHaveCount(0)
})
