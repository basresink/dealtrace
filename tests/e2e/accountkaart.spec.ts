// Accountkaart in de opzet van DealDrive: kop met Info, Contacten en Briefing, statstrook, de tabbladen
// met het tabblad in de URL, de tijdlijnfilter, een document uploaden en verwijderen, en de kwalificatie.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('accountkaart', () => {
  test('kop, statstrook en alle tabbladen; tabblad in de URL; filter op de tijdlijn', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/accounts/pr-06')
    await expect(page.getByTestId('account-naam')).toContainText('Testtechniek Gevelpunt')
    await expect(page.getByTestId('statstrook')).toContainText('Open acties')
    for (const t of ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'deals', 'campagnes', 'documenten', 'kwalificatie', 'eigenvelden']) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
    await page.getByTestId('tl-filters').click()
    await page.locator('.filter-pil', { hasText: 'Contactmomenten' }).click()
    await expect(page.locator('.tl-soort').first()).toHaveText('Contact')
    await page.getByTestId('tab-verslagen').click()
    await expect(page).toHaveURL(/tab=verslagen/)
    await page.locator('[data-test^=ak-verslag-]').first().click()
    await expect(page.getByTestId('verslag-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
    await ga(page, '/accounts/pr-06?tab=kwalificatie')
    await expect(page.getByTestId('band')).toBeVisible()
    await page.getByTestId('briefing-knop').click()
    await expect(page.getByTestId('briefing-flyout')).toBeVisible()
  })

  test('document uploaden staat in Documenten en is te verwijderen; een vreemd bestandstype niet', async ({ page }) => {
    await login(page, 'u-01')
    const fout = await page.request.post('/api/accounts/pr-06/documenten', { data: { naam: 'virus.exe', mime: 'application/x-msdownload', data: Buffer.from('x').toString('base64') } })
    expect(fout.status()).toBe(415)
    await ga(page, '/accounts/pr-06?tab=documenten')
    await page.getByTestId('document-uploaden').click()
    await page.getByTestId('document-bestand').setInputFiles({ name: 'offerte-test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
    await expect(page.getByTestId('document-naam')).toHaveValue('offerte-test.pdf')
    await page.getByTestId('document-bewaar').click()
    const rij = page.locator('.ak-doc', { hasText: 'offerte-test.pdf' })
    await expect(rij).toBeVisible()
    page.once('dialog', (d) => d.accept())
    await rij.getByRole('button').click()
    await expect(rij).toHaveCount(0)
  })
})
