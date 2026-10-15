// P08: agents en mandaten. De beheerder zet mandaten en pauzeert; per niveau wat je ziet;
// 422 boven het maximum; de founder schrijft de platformmaxima, een beheerder niet.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

test.describe('Agents en mandaten', () => {
  test('beheerder verlaagt het mandaat van de Schrijver; opslaan na 600 ms met een auditregel', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/agents')
    await expect(page.getByTestId('vier-niveaus')).toContainText('per stuk goedkeuren')
    await expect(page.getByTestId('agent-zoeker')).toContainText('Komt later')
    await page.getByTestId('mandaat-schrijver').selectOption('C')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')
    const stand = await (await page.request.get('/api/agents')).json()
    expect(stand.agents.find((a: any) => a.sleutel === 'schrijver').mandaat).toBe('C')
    const audit = await (await page.request.get('/api/instellingen/audit')).json()
    expect(audit.slice(0, 5).some((r: any) => r.actie === 'agent.mandaat')).toBe(true)
    // De keuzelijst van de Verzender gaat niet verder dan zijn maximum B.
    await expect(page.getByTestId('mandaat-verzender').locator('option')).toHaveText([/^B/, /^C/, /^D/])
    expect((await page.request.put('/api/agents/schrijver/mandaat', { data: { mandaat: 'A' } })).status()).toBe(200)
  })

  test('boven het maximum geeft 422; de Bewaker wijzig je niet; instellingen-API weigert mandaten en maxima', async ({ request }) => {
    await apiLogin(request, 'u-06')
    expect((await request.put('/api/agents/verzender/mandaat', { data: { mandaat: 'A' } })).status()).toBe(422)
    expect((await request.put('/api/agents/bewaker/mandaat', { data: { mandaat: 'C' } })).status()).toBe(422)
    expect((await request.put('/api/settings/agentmandaten', { data: { value: { verzender: { mandaat: 'A' } } } })).status()).toBe(403)
    expect((await request.put('/api/settings/agentmaxima', { data: { value: { verzender: 'A' } } })).status()).toBe(403)
    expect((await request.get('/api/platform/agentmaxima')).status()).toBe(404)
  })

  test('Agents pauzeren: bevestiging, gele strook en Hervat', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/agents')
    await page.getByTestId('agents-pauzeren').click()
    await expect(page.getByRole('alertdialog')).toContainText('Alle agents pauzeren?')
    await expect(page.getByRole('alertdialog')).toContainText('Alle B-handelingen stoppen direct.')
    await page.getByTestId('bevestig').click()
    await expect(page.getByText('Agents gepauzeerd.')).toBeVisible()
    await expect(page.getByTestId('pauzestrook')).toContainText('Agents staan op pauze sinds')
    await expect(page.getByTestId('agents-pauzeren')).toHaveCount(0)
    const stand = await (await page.request.get('/api/agents')).json()
    expect(stand.agents.find((a: any) => a.sleutel === 'verzender').voorMij).toBe('C')
    await page.getByTestId('hervat').click()
    await expect(page.getByTestId('pauzestrook')).toHaveCount(0)
  })

  test('Beginner: "Nog niet aangezet" en 403 op de API', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/instellingen/agents')
    await expect(page.getByTestId('niet-aangezet-pagina')).toContainText('Nog niet aangezet')
    expect((await page.request.get('/api/agents')).status()).toBe(403)
  })

  test('Gevorderd leest alleen mee', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/instellingen/agents')
    await expect(page.getByTestId('meekijken')).toBeVisible()
    await expect(page.getByTestId('mandaat-schrijver')).toHaveCount(0)
    await expect(page.getByTestId('agents-pauzeren')).toHaveCount(0)
    await expect(page.getByTestId('eigen-mandaat')).toHaveCount(0)
    expect((await page.request.put('/api/agents/schrijver/mandaat', { data: { mandaat: 'C' } })).status()).toBe(403)
  })

  test('Expert zet zijn eigen mandaat binnen het maximum en ziet "Waarom niet?"', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/instellingen/agents')
    await expect(page.getByTestId('eigen-verzender').locator('option')).toHaveText([/^B/, /^C/, /^D/])
    expect((await page.request.put('/api/agents/verzender/mandaat', { data: { mandaat: 'A', eigen: true } })).status()).toBe(422)
    await page.getByTestId('eigen-verzender').selectOption('C')
    await expect(page.getByTestId('opslagstatus')).toHaveText('Opgeslagen')
    const stand = await (await page.request.get('/api/agents')).json()
    expect(stand.agents.find((a: any) => a.sleutel === 'verzender').voorMij).toBe('C')
    await page.request.put('/api/agents/verzender/mandaat', { data: { mandaat: 'B', eigen: true } })
    await ga(page, '/acties?tab=inzichten')
    await page.getByTestId('waarom-niet').locator('summary').click()
    await expect(page.getByTestId('waarom-niet')).toContainText(/Bewaker/)
  })

  test('founder in "Alleen meekijken" kan geen mandaat wijzigen; de founder zet het platformmaximum', async ({ request }) => {
    await apiLogin(request, 'u-founder')
    expect((await request.put('/api/platform/agentmaxima', { data: { agent: 'verzender', max: 'A' } })).status()).toBe(422)
    expect((await request.put('/api/platform/agentmaxima', { data: { agent: 'verzender', max: 'B' } })).status()).toBe(200)
    expect((await request.get('/api/platform/agentmaxima')).status()).toBe(200)
    await request.post('/api/platform/werk-in', { data: { organisatieId: 'org-voltvast', reden: 'Ticket 2001', modus: 'meekijken' } })
    expect((await request.put('/api/agents/schrijver/mandaat', { data: { mandaat: 'C' } })).status()).toBe(403)
    expect((await request.post('/api/agents/pauzeer', { data: { pauze: true } })).status()).toBe(403)
    await request.delete('/api/platform/werk-in')
  })
})

test.describe('Agents op de telefoon', () => {
  for (const breedte of [375, 390, 412]) {
    test(`${breedte} px: "Beter op een groot scherm", geen horizontale scroll, alleen lezen`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: 800 })
      await login(page, 'u-06')
      await ga(page, '/instellingen/agents')
      await expect(page.getByText('Beter op een groot scherm.')).toBeVisible()
      await expect(page.getByTestId('mandaat-schrijver')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
    })
  }
})
