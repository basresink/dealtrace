// Taaktypes WhatsApp en SMS (wens W6): de taakkiezer biedt WhatsApp (waarde bericht) en SMS in plaats van
// Bericht en Bezoek; een bestaande bezoektaak blijft Bezoek. Een afgeronde SMS- of WhatsApp-taak telt op
// Mijn dashboard bij Activiteiten per dag in het eigen kanaal; de funnel blijft werken. Op 1280 en 390 px.
import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

const uniek = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

async function geenHorizontaleScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

async function maakTaak(page: Page, type: 'bericht' | 'sms', titel: string) {
  await ga(page, '/taken')
  await page.getByTestId('taak-nieuw').click()
  const venster = page.getByTestId('nieuwe-taak')
  await expect(venster.getByTestId('nt-type-bericht')).toHaveText('WhatsApp')
  await expect(venster.getByTestId('nt-type-sms')).toHaveText('SMS')
  await expect(venster.getByTestId('nt-type-bezoek')).toHaveCount(0)
  await expect(venster.getByTestId('nt-type-uitleg')).toContainText('+ Afspraak')
  await venster.getByTestId('nt-titel').fill(titel)
  await venster.getByTestId(`nt-type-${type}`).click()
  await expect(venster.getByTestId(`nt-type-${type}`)).toHaveAttribute('aria-pressed', 'true')
  await venster.getByTestId('nt-maak').click()
  await expect(page.locator('.toast').last()).toContainText('Taak gemaakt.')
  const taak = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken).find((t: any) => t.title === titel)
  expect(taak).toMatchObject({ actionType: type })
  return taak
}

for (const breedte of [1280, 390]) {
  test.describe(`taaktypes WhatsApp en SMS op ${breedte} px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: breedte, height: breedte === 390 ? 844 : 900 }) })

    test('een WhatsApp- en een SMS-taak maken, afronden en terugzien op Mijn dashboard en de funnel', async ({ page }) => {
      await login(page, 'u-07')
      const wa = await maakTaak(page, 'bericht', `WhatsApp ${uniek()}`)
      const sms = await maakTaak(page, 'sms', `SMS ${uniek()}`)
      // Het taakvenster toont het type met het juiste label.
      await ga(page, `/taken?taak=${sms.id}`)
      await expect(page.getByTestId('tf-gegevens')).toContainText('SMS')
      await geenHorizontaleScroll(page)
      await ga(page, `/taken?taak=${wa.id}`)
      await expect(page.getByTestId('tf-gegevens')).toContainText('WhatsApp')
      // Het filter op /taken kent WhatsApp en SMS.
      await ga(page, '/taken?weergave=lijst&actiesoort=sms')
      await expect(page.getByTestId(`taak-${sms.id}`)).toBeVisible()
      await expect(page.getByTestId(`taak-${wa.id}`)).toHaveCount(0)
      await expect(page.getByRole('combobox', { name: 'Actiesoort' }).locator('option')).toContainText(['WhatsApp', 'SMS'])

      // Afronden: elke taak is een contactpoging in haar eigen kanaal.
      const voor = (await (await page.request.get('/api/resultaten/dashboard')).json()).activiteit.punten.find((p: any) => p.sleutel === vandaag())
      for (const t of [wa, sms]) expect((await page.request.post(`/api/tasks/${t.id}/afronden`, { data: { uitkomst: 'verstuurd', idempotentieSleutel: uniek() } })).ok()).toBe(true)
      const na = (await (await page.request.get('/api/resultaten/dashboard')).json()).activiteit.punten.find((p: any) => p.sleutel === vandaag())
      expect(na.delen.whatsapp).toBe((voor?.delen.whatsapp ?? 0) + 1)
      expect(na.delen.sms).toBe((voor?.delen.sms ?? 0) + 1)
      expect(na.delen).not.toHaveProperty('bericht')

      await ga(page, '/mijn-dashboard')
      const grafiek = page.getByTestId('grafiek-activiteit')
      await expect(grafiek.locator('.sg-legenda')).toContainText('WhatsApp')
      await expect(grafiek.locator('.sg-legenda')).toContainText('SMS')
      await expect(grafiek.locator('.sg-legenda')).not.toContainText('Bericht')
      await expect(grafiek.locator('caption')).toHaveText(/Activiteiten per/)
      await geenHorizontaleScroll(page)

      const funnel = await page.request.get('/api/funnel')
      expect(funnel.ok()).toBe(true)
      await ga(page, '/funnel')
      await expect(page.getByTestId('funnel-tegels').or(page.getByText('Nog geen accounts in deze periode.'))).toBeVisible()
      await geenHorizontaleScroll(page)
    })

    test('een bestaande bezoektaak toont als Bezoek en houdt dat type in de bewerkstand', async ({ page }) => {
      await login(page, 'u-07')
      const titel = `Bezoek ${uniek()}`
      const r = await page.request.post('/api/tasks', { data: { title: titel, actionType: 'bezoek', dueDate: new Date().toISOString() } })
      expect(r.ok()).toBe(true)
      const taak = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken).find((t: any) => t.title === titel)
      expect(taak.actionType).toBe('bezoek')
      await ga(page, `/taken?taak=${taak.id}`)
      await expect(page.getByTestId('tf-gegevens')).toContainText('Bezoek')
      await page.getByTestId('tf-bewerk').click()
      await expect(page.getByTestId('tf-type-bezoek')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('tf-type-sms')).toBeVisible()
      await expect(page.getByTestId('tf-type-bericht')).toHaveText('WhatsApp')
      await geenHorizontaleScroll(page)
    })
  })
}
