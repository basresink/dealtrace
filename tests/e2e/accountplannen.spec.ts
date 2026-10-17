import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// Accountplannen (Expert) in de opzet van DealDrive: overzicht met Actueel en Verlopen en afgerond, de flyout
// van een plan, de detailpagina waar een actie een echte taak op het account wordt, de ingang op de
// accountkaart, en Beginner en Gevorderd zien de functie niet.
test.describe('accountplannen', () => {
  // De dev-server wordt gedeeld; het laden van een plan krijgt wat ruimte.
  test.describe.configure({ timeout: 90_000 })
  test('overzicht: kop, kaart in Actueel en een lege groep Verlopen en afgerond', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await expect(page.getByText(/Accountplannen · \d+ actueel/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Eén plan per topprospect, elke stap aanwijsbaar.' })).toBeVisible()
    await expect(page.getByTestId('kop-zoeken')).toBeVisible()
    const kaart = page.getByTestId('ap-groep-actueel').getByTestId('ap-kaart-eva-plan-01')
    await expect(kaart).toContainText('PROSPECT')
    await expect(kaart).toContainText('ACTUEEL')
    await expect(kaart).toContainText('Testtechniek Leusden')
    await expect(kaart).toContainText('Geldig:')
    await expect(kaart).toContainText('acties')
    await expect(kaart.getByTestId('ap-open-eva-plan-01')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    await expect(page.getByTestId('ap-groep-historie')).toBeVisible()
    // De zijbalk: Accountplannen in Planning.
    await expect(page.locator('.sb-groep[data-groep="Planning"] .sb-link[data-sleutel="nav.accountplannen"]')).toHaveAttribute('href', '/accountplannen')
  })

  test('flyout: status, account, blokken, actieplan en de voet', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await page.getByTestId('ap-kaart-eva-plan-01').getByRole('button').click()
    const f = page.getByTestId('ap-flyout')
    await expect(f).toBeVisible()
    await expect(f).toContainText('Accountplan')
    await expect(f.getByTestId('apf-status')).toHaveText('ACTUEEL', { timeout: 15_000 })
    await expect(f.getByTestId('apf-account')).toHaveAttribute('href', '/accounts/eva-a07')
    for (const t of ['Doelen (SMART)', 'Kansen', 'Bedreigingen', 'Strategieën', 'Evaluatie', 'Actieplan']) await expect(f).toContainText(t)
    await expect(f.locator('[data-test^="apf-actie-"]')).toHaveCount(3)
    await expect(f.getByTestId('apf-verwijder')).toBeVisible()
    await expect(f.getByTestId('apf-wijzig')).toBeVisible()
    await expect(f.getByTestId('apf-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    await f.getByTestId('apf-sluit').click()
    await expect(f).toBeHidden()
  })

  test('nieuw plan, blok invullen en een actie die een taak op het account wordt', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accountplannen')
    await page.getByTestId('ap-nieuw').click()
    const n = page.getByTestId('ap-nieuw-flyout')
    await n.getByTestId('apn-zoek').fill('Testvloer Houten')
    await n.getByTestId('apn-kies-eva-a09').click()
    await n.getByTestId('apn-titel').fill('E2E accountplan Houten')
    await n.getByTestId('apn-maak').click()
    await page.waitForURL(/\/accountplannen\/[^/?]+$/)
    await expect(page.getByTestId('apd-titel')).toHaveText('E2E accountplan Houten')
    const planId = page.url().split('/').pop()!

    await page.getByTestId('apd-bewerk-kansen').click()
    await page.getByTestId('apd-tekst-kansen').fill('Twee nieuwbouwprojecten in de regio.')
    await page.getByTestId('apd-bewaar-kansen').click()
    await expect(page.getByTestId('apd-blok-kansen')).toContainText('Twee nieuwbouwprojecten in de regio.')

    await page.getByTestId('apd-actie-titel').fill('Projectschouw plannen met de directeur')
    await page.getByTestId('apd-actie-datum').fill('2026-11-12')
    await page.getByTestId('apd-actie-contact').selectOption('eva-a09-c1')
    await page.getByTestId('apd-actie-toevoegen').click()
    const rij = page.getByTestId('apd-actieplan').locator('[data-test^="apd-actie-"]').filter({ hasText: 'Projectschouw plannen' })
    await expect(rij).toContainText('Els Testhouten')
    await expect(page.getByTestId('apd-voortgang')).toContainText('0 van 1 acties klaar')

    // De actie is een echte taak op het account (accountkaart) en van Eva (Acties).
    const tabs = await (await page.request.get('/api/accounts/eva-a09/tabbladen')).json()
    const taak = tabs.taken.find((t: any) => t.titel === 'Projectschouw plannen met de directeur' || t.title === 'Projectschouw plannen met de directeur')
    expect(taak).toBeTruthy()
    expect(taak.contactId).toBe('eva-a09-c1')

    await rij.getByTestId('apd-vink').check()
    await expect(page.getByTestId('apd-voortgang')).toContainText('1 van 1 acties klaar')

    // Opruimen: de actie uit het plan (taak geannuleerd) en het plan weg.
    await rij.getByRole('button', { name: /Verwijder actie/ }).click()
    await page.getByTestId('bevestig').click()
    await expect(page.getByTestId('apd-voortgang')).toContainText('0 van 0 acties klaar')
    await page.getByTestId('apd-verwijder').click()
    await page.getByTestId('bevestig').click()
    await page.waitForURL(/\/accountplannen$/)
    await expect(page.getByTestId(`ap-kaart-${planId}`)).toHaveCount(0)
  })

  test('accountkaart: de plannen van het account en + Accountplan met het account ingevuld', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-a07')
    // Het tabblad Accountplan staat direct rechts van Campagnes.
    const tabs = await page.locator('[data-test^=tab-]').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    expect(tabs.indexOf('tab-accountplan')).toBe(tabs.indexOf('tab-campagnes') + 1)
    await page.getByTestId('tab-accountplan').click()
    await expect(page).toHaveURL(/tab=accountplan/)
    const blok = page.getByTestId('ak-accountplannen')
    await expect(blok.getByTestId('ak-accountplan-eva-plan-01')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    // Het lopende plan: samenvatting, acties met de voortgang en de link naar het plan.
    await expect(blok.getByTestId('apt-lopend')).toContainText('Lopend accountplan')
    await expect(blok.getByTestId('apt-voortgang')).toContainText(/\d+ van \d+ acties klaar/)
    await expect(blok.getByTestId('apt-samenvatting')).toBeVisible()
    await expect(blok.getByTestId('apt-acties').locator('li').first()).toBeVisible()
    await expect(blok.getByTestId('apt-open')).toHaveAttribute('href', '/accountplannen/eva-plan-01')
    await blok.getByTestId('ak-accountplan-nieuw').click()
    await expect(page.getByTestId('apn-gekozen')).toContainText('Testtechniek Leusden')
  })

  test('accountkaart: lege staat met Maak accountplan; zonder de functie geen tabblad', async ({ page }) => {
    await login(page, 'u-07')
    const naam = `${crypto.randomUUID().slice(0, 10)} Planloos`
    const a = await (await page.request.post('/api/accounts', { data: { naam } })).json()
    await ga(page, `/accounts/${a.id}?tab=accountplan`)
    const blok = page.getByTestId('ak-accountplannen')
    await expect(blok.getByTestId('apt-leeg')).toContainText('Nog geen accountplan')
    await blok.getByTestId('ak-accountplan-nieuw').click()
    await expect(page.getByTestId('apn-gekozen')).toContainText(naam)
    // Een Gevorderde heeft geen accountplannen en dus geen tabblad.
    await login(page, 'u-01')
    await ga(page, '/accounts/pr-06')
    await expect(page.getByTestId('tab-campagnes')).toBeVisible()
    await expect(page.getByTestId('tab-accountplan')).toHaveCount(0)
  })

  test('een plan is voor een topprospect: geen + Accountplan bij een klant, de API weigert een klant, de zoeker toont alleen prospects', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/accounts/eva-k01?tab=accountplan')
    const blok = page.getByTestId('ak-accountplannen')
    await expect(blok).toContainText('Een plan voor een klant maak je in DealDrive.')
    await expect(blok.getByTestId('ak-accountplan-nieuw')).toHaveCount(0)
    const r = await page.request.post('/api/accountplannen', { data: { accountId: 'eva-k01', titel: 'Plan voor een klant' } })
    expect(r.status()).toBe(422)
    const treffers = await (await page.request.get('/api/accounts/kies', { params: { q: 'Testwarmte', soort: 'prospect' } })).json()
    expect(treffers.some((t: any) => t.id === 'eva-k01')).toBe(false)
  })

  for (const [id, niveau] of [['u-02', 'Beginner'], ['u-01', 'Gevorderd']] as const) {
    test(`${niveau} ziet Accountplannen niet`, async ({ page }) => {
      await login(page, id)
      await expect(page.locator('.sb-groep .sb-link:not(.sb-link--slot)[data-sleutel="nav.accountplannen"]')).toHaveCount(0)
      await ga(page, '/accountplannen')
      await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
      expect((await page.request.get('/api/accountplannen', { timeout: 30_000 })).status()).toBe(403)
    })
  }
})
