// Wens opdrachtgever: "Als een feature uitstaat, dan laat de app de feature, de button en andere links
// niet zien." Per niveau (Beginner u-02, Gevorderd u-01) ontbreken ingangen van uitgezette functies op
// Vandaag, Taken, Prospects, de accountkaart en contactkaart (Meer), Agenda, Bezoeken, Meetings, Dagstart en
// in het menu; ingangen van aangezette functies staan er wel. De founder zet een functie uit voor de
// organisatie en de ingang verdwijnt. Op 1280 en 390 px.
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ timeout: 240_000 })

const BREEDTES = [1280, 390] as const
/** Links naar dit pad of een subpad, met of zonder query. */
const link = (pad: string) => `a[href="${pad}"], a[href^="${pad}/"], a[href^="${pad}?"]`

/** Uit voor een Beginner volgens de startindeling (shared/functies.ts startNiveau). */
const UIT_BEGINNER = ['/inzichten', '/accountplannen', '/leadgenerator', '/signaalradar', '/briefings', '/reizen', '/bezoek-analyse', '/meeting-analyse', '/kennisbank', '/data-kwaliteit']
/** Uit voor een Gevorderde: alleen Expert-functies. */
const UIT_GEVORDERD = ['/accountplannen', '/reizen']
const PAGINAS = ['/', '/taken', '/prospects', '/agenda', '/bezoeken', '/meetings', '/dagstart']

async function geenIngangen(page: Page, paden: string[], waar: string) {
  // Een reis bekijken (/reizen/<id>, alleen lezen) hoort bij "Reis bekijken" (vanaf Gevorderd); uit is alleen het overzicht.
  const sel = (p: string) => (p === '/reizen' ? `a[href="${p}"], a[href^="${p}?"]` : link(p))
  for (const p of paden) expect(await page.locator(sel(p)).count(), `${waar}: link naar ${p}`).toBe(0)
  await expect(page.getByText('Nog niet aangezet'), `${waar}: "Nog niet aangezet"`).toHaveCount(0)
  await expect(page.getByTestId('niet-aangezet-pagina')).toHaveCount(0)
}

async function eersteAccountEnContact(page: Page) {
  const accounts = await (await page.request.get('/api/accounts?eigenaar=iedereen')).json()
  const contacten = await (await page.request.get('/api/contacten?eigenaar=iedereen')).json()
  const account = accounts.rijen.find((r: any) => !r.gedeactiveerd)?.id as string
  const contact = contacten.contacten.find((c: any) => c.accountId)?.id as string
  expect(account).toBeTruthy()
  expect(contact).toBeTruthy()
  return { account, contact }
}

async function meerKaders(page: Page) {
  await page.getByTestId('kop-meer').click()
  const meer = page.getByTestId('meer-flyout')
  await expect(meer).toBeVisible()
  const ids = await meer.locator('.mf-kader').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
  await page.getByTestId('meer-flyout-sluit').click()
  return ids
}

async function geenHorizontaleScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

for (const breedte of BREEDTES) {
  test.describe(`${breedte} px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 }) })

    test('Beginner: geen ingang naar uitgezette functies; wel naar wat aanstaat', async ({ page }) => {
      await login(page, 'u-02')
      for (const pad of PAGINAS) {
        await ga(page, pad)
        await geenIngangen(page, UIT_BEGINNER, pad)
        await geenHorizontaleScroll(page)
      }
      // Wat aanstaat, staat er wel.
      await ga(page, '/')
      await expect(page.locator(link('/taken')).first()).toBeAttached()
      if (breedte > 500) await expect(page.getByTestId('vandaag-dagstart')).toBeVisible()
      await ga(page, '/taken')
      await expect(page.getByTestId('taak-nieuw')).toBeAttached()
      await ga(page, '/agenda')
      await expect(page.getByTestId('agenda-weekstart')).toBeAttached()
      // Bezoeken: geen blok "Te plannen bezoeken" en geen bellijst (uit voor Beginner), geen knop Analyse.
      await ga(page, '/bezoeken')
      await expect(page.getByTestId('te-plannen')).toHaveCount(0)
      await expect(page.getByTestId('bellijst-naast')).toHaveCount(0)

      // Accountkaart en contactkaart: Meer zonder Accountplan, wel met Campagnes.
      const { account, contact } = await eersteAccountEnContact(page)
      await ga(page, `/accounts/${account}`)
      await geenIngangen(page, UIT_BEGINNER, 'accountkaart')
      let ids = await meerKaders(page)
      expect(ids).not.toContain('meer-accountplan')
      expect(ids).toContain('meer-campagnes')
      await ga(page, `/contacten/${contact}`)
      await geenIngangen(page, UIT_BEGINNER, 'contactkaart')
      ids = await meerKaders(page)
      expect(ids).not.toContain('meer-accountplan')

      // Menu: geen groep "Nog niet aangezet"; op de telefoon ook niet in Meer.
      await expect(page.locator('.sb-slotgroep')).toHaveCount(0)
      if (breedte < 500) {
        await page.getByTestId('onderbalk').locator('[data-tab="meer"]').click()
        const meer = page.getByTestId('meer-venster')
        await expect(meer).toBeVisible()
        await expect(meer.getByTestId('meer-niet-aangezet')).toHaveCount(0)
        for (const p of UIT_BEGINNER) await expect(meer.locator(`[data-route="${p}"]`)).toHaveCount(0)
        await expect(meer.locator('[data-route="/agenda"]')).toBeVisible()
        const hoogtes = await meer.locator('.meer-item').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
        for (const h of hoogtes) expect(h).toBeGreaterThanOrEqual(44)
      }

      // Zoeken: geen resultaat dat naar een uitgezette pagina leidt.
      const zoek = await (await page.request.get('/api/zoeken?q=inzicht')).json()
      expect(zoek.groepen.flatMap((g: any) => g.rijen).some((r: any) => r.link === '/inzichten')).toBe(false)
      // Een directe URL toont de pagina "Nog niet aangezet".
      await ga(page, '/inzichten')
      await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
    })

    test('Gevorderd: Inzichten, Meetinganalyse en Bezoekanalyse aan; Accountplannen en Prospectreizen niet', async ({ page }) => {
      await login(page, 'u-01')
      for (const pad of PAGINAS) {
        await ga(page, pad)
        await geenIngangen(page, UIT_GEVORDERD, pad)
        await geenHorizontaleScroll(page)
      }
      await expect(page.locator('.sb-nav').locator(link('/inzichten'))).toHaveCount(1)
      await ga(page, '/meetings')
      await expect(page.locator(link('/meeting-analyse')).first()).toBeAttached()
      // Op de telefoon gaat Bezoeken door naar Onderweg; de knop Analyse staat op de laptop.
      if (breedte > 500) {
        await ga(page, '/bezoeken')
        await expect(page.locator(link('/bezoek-analyse')).first()).toBeAttached()
        await expect(page.getByTestId('te-plannen')).toBeAttached()
      }
      const zoek = await (await page.request.get('/api/zoeken?q=inzicht')).json()
      expect(zoek.groepen.flatMap((g: any) => g.rijen).some((r: any) => r.link === '/inzichten')).toBe(true)

      const { account, contact } = await eersteAccountEnContact(page)
      await ga(page, `/accounts/${account}`)
      await geenIngangen(page, UIT_GEVORDERD, 'accountkaart')
      expect(await meerKaders(page)).not.toContain('meer-accountplan')
      await ga(page, `/contacten/${contact}`)
      await geenIngangen(page, UIT_GEVORDERD, 'contactkaart')
    })
  })
}

test('Instellingen: de beheerder ziet de kaarten van wat aanstaat; een accountmanager ziet Instellingen niet', async ({ page }) => {
  await login(page, 'u-01')
  await expect(page.locator('.sb-nav').locator(link('/instellingen'))).toHaveCount(0)
  await login(page, 'u-06')
  await ga(page, '/instellingen')
  for (const kaart of ['Belscripts', 'Opvolgreeksen', 'Gebieden en regiodagen']) await expect(page.getByTestId(`kaart-${kaart}`)).toBeVisible()
  await expect(page.getByText('Nog niet aangezet')).toHaveCount(0)
})

test.describe('de founder zet een functie uit voor de organisatie', () => {
  const NIVEAUS = ['beginner', 'gevorderd', 'expert'] as const
  const FUNCTIE = 'belscript.kiezen'
  const ORG = 'org-voltvast'

  test.afterEach(async ({ playwright, baseURL }) => {
    // Terug naar de standaard, ook als de test faalt.
    const founder = await playwright.request.newContext({ baseURL })
    await apiLogin(founder, 'u-founder')
    for (const niveau of NIVEAUS) await founder.delete('/api/platform/features', { data: { functie: FUNCTIE, niveau, organisatieId: ORG } })
    await founder.dispose()
  })

  test('Belscript uit: de kaart in Instellingen, het kader in Meer en de knop op Vandaag verdwijnen (1280 en 390)', async ({ page, playwright, baseURL }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen')
    await expect(page.getByTestId('kaart-Belscripts')).toBeVisible()

    const founder = await playwright.request.newContext({ baseURL })
    await apiLogin(founder, 'u-founder')
    for (const niveau of NIVEAUS) expect((await founder.put('/api/platform/features', { data: { functie: FUNCTIE, niveau, aan: false, organisatieId: ORG } })).ok()).toBe(true)
    await founder.dispose()

    for (const breedte of BREEDTES) {
      await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
      await login(page, 'u-06')
      await ga(page, '/instellingen')
      await expect(page.getByTestId('kaart-Opvolgreeksen')).toBeVisible()
      await expect(page.getByTestId('kaart-Belscripts')).toHaveCount(0)
      await expect(page.getByTestId('kaart-Alle belscripts')).toHaveCount(0)
      await login(page, 'u-01')
      const { account } = await eersteAccountEnContact(page)
      await ga(page, `/accounts/${account}`)
      expect(await meerKaders(page)).not.toContain('meer-belscript')
      await ga(page, '/')
      await expect(page.locator(link('/belscripts'))).toHaveCount(0)
      await geenHorizontaleScroll(page)
      // Een directe URL toont de pagina "Nog niet aangezet", met de reden dat de organisatie hem uit heeft.
      await ga(page, '/belscripts')
      await expect(page.getByTestId('niet-aangezet-pagina')).toContainText('staat voor je organisatie nog niet aan')
    }
    // De server blijft weigeren.
    expect((await page.request.get('/api/belscripts')).status()).toBe(403)
  })
})
