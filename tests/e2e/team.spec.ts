import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// Team (P21): de werkverdeling toont faselabels uit de reis, geen ruwe fase-id's (B21).
test.describe('team', () => {
  test('werkverdeling: chips met het faselabel', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    const team = await (await page.request.get('/api/team')).json()
    const fases = team.werkverdeling.flatMap((p: any) => p.fases)
    for (const f of fases) expect(f.label, `label voor ${f.fase}`).toBeTruthy()
    await login(page, 'u-06')
    await ga(page, '/team')
    const chips = page.getByTestId('werkverdeling').locator('.chip')
    if (fases.length) {
      await expect(chips.first()).toBeVisible()
      for (const t of await chips.allTextContents()) expect(t).not.toMatch(/^[a-z]+(-[a-z]+)+ ·/)
    }
  })
})
