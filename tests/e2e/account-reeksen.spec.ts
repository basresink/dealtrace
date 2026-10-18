import { expect, test, type APIRequestContext } from '@playwright/test'
import { ga, login } from './hulp'

// Opvolgreeksen per prospect onder Meer op de accountkaart (F7): Meer, Opvolgreeksen opent een eigen venster met de
// lopende reeks, de eerdere reeksen en Start reeks met deze prospect vast. Op 1280 en 390 px (schermvullend):
// start een reeks voor een eigen fictieve prospect, zie hem lopen, stop hem en zie hem bij de eerdere reeksen.
// Ook: ?meer=reeksen opent het venster direct, Meer terug in de kop, en een tweede reeks starten geeft 409.

async function fixture(request: APIRequestContext, naam: string) {
  await request.post('/api/sessie/ontwikkel', { data: { gebruikerId: 'u-01' } })
  const treffers = await (await request.get(`/api/accounts/kies?q=${encodeURIComponent(naam)}`)).json()
  let id: string = treffers.find((t: any) => (t.naam ?? t.name) === naam)?.id
  if (!id) id = (await (await request.post('/api/accounts', { data: { naam, plaats: 'Deventer', telefoon: '0570 400 123', negeerMogelijk: true } })).json()).id
  const v = await (await request.get(`/api/volgen/${id}`)).json()
  if (!v.contacten?.length) await request.post('/api/contacten', { data: { accountId: id, voornaam: 'Sanne', achternaam: 'Proefreeks', functie: 'Inkoper', email: `sanne@${naam.toLowerCase().replace(/\s+/g, '')}.test`, rol: 'beslisser' } })
  const r = await (await request.get(`/api/accounts/${id}/reeksen`)).json()
  if (r.lopend) await request.put(`/api/reeksen/${r.lopend.id}`, { data: { actie: 'stop' } })
  return id
}

test.describe('opvolgreeksen op de accountkaart', () => {
  test.describe.configure({ timeout: 180_000, mode: 'serial' })

  for (const breedte of [1280, 390]) {
    test(`${breedte} px: Meer, Opvolgreeksen: start een reeks, zie hem lopen en stop hem`, async ({ page, request }) => {
      const naam = `Testreeks Kaart ${breedte}`
      const id = await fixture(request, naam)
      await page.setViewportSize({ width: breedte, height: breedte === 390 ? 844 : 900 })
      await login(page, 'u-01')
      await ga(page, `/accounts/${id}`)
      await page.getByTestId('kop-meer').click()
      const kader = page.getByTestId('meer-flyout').getByTestId('meer-reeksen')
      await expect(kader.locator('.mf-titel')).toHaveText('Opvolgreeksen')
      await kader.click()
      await expect(page.getByTestId('meer-flyout')).toHaveCount(0)
      const f = page.getByTestId('reeksen-flyout')
      await expect(f).toBeVisible()
      await expect(f.getByTestId('fs-terug')).toBeVisible()
      await expect(f.getByTestId('arf-lopend')).toHaveCount(0)
      if (breedte === 390) {
        const box = await f.boundingBox()
        expect(Math.round(box!.width)).toBe(390)
        const h = await f.getByTestId('arf-start').evaluate((e) => e.getBoundingClientRect().height)
        expect(h).toBeGreaterThanOrEqual(44)
      }

      // Start reeks: de prospect staat vast, sjabloon en contact kiezen.
      await f.getByTestId('arf-start').click()
      const s = page.getByTestId('reeks-start-flyout')
      await expect(s.getByTestId('rsf-gekozen')).toContainText(naam)
      await expect(s.getByRole('button', { name: 'Andere prospect kiezen' })).toHaveCount(0)
      await s.getByTestId('rsf-sjabloon-na-informatie').click()
      await expect(s.getByTestId('rsf-contact-keuze')).toContainText('Sanne Proefreeks')
      await s.getByTestId('rsf-start').click()
      await expect(s).toBeHidden({ timeout: 60_000 })

      // De reeks loopt: stap x van y, volgende stap, contact en de stappen per dag.
      const lopend = f.getByTestId('arf-lopend')
      await expect(lopend).toContainText(/Na informatie · stap 1 van \d/, { timeout: 60_000 })
      await expect(lopend).toContainText('Sanne Proefreeks')
      await expect(lopend.getByTestId('arf-volgende')).not.toBeEmpty()
      await expect(lopend.getByTestId('vr-stappen').locator('li')).toHaveCount(5, { timeout: 60_000 })
      await expect(f.getByTestId('arf-start')).toHaveCount(0)
      // Niet twee lopende reeksen tegelijk: de server weigert een tweede.
      const sj = (await (await page.request.get(`/api/volgen/${id}`)).json()).sjablonen[0].id
      expect((await page.request.post(`/api/volgen/${id}/reeks`, { data: { sjabloonId: sj } })).status()).toBe(409)

      // Pauzeren en hervatten, dan stoppen.
      await lopend.getByTestId('vr-pauzeer').click()
      await expect(lopend).toContainText('gepauzeerd')
      await lopend.getByTestId('vr-hervat').click()
      await expect(lopend.getByTestId('vr-pauzeer')).toBeVisible()
      page.once('dialog', (d) => d.accept())
      await lopend.getByTestId('vr-stop').click()
      await expect(f.getByTestId('arf-lopend')).toHaveCount(0, { timeout: 60_000 })
      const eerder = f.getByTestId('arf-eerdere')
      await expect(eerder).toContainText('Na informatie')
      await expect(eerder.getByTestId('arf-uitkomst').first()).toContainText('Je stopte de reeks')
      await expect(f.getByTestId('arf-start')).toBeVisible()
      if (breedte === 390) expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      // Meer terug in de kop opent Meer weer, met de stand in de regel.
      await f.getByTestId('fs-terug').click()
      await expect(page.getByTestId('meer-flyout').getByTestId('meer-reeksen')).toContainText(/eerdere reeks/)
    })
  }

  test('?meer=reeksen opent het venster direct', async ({ page, request }) => {
    const id = await fixture(request, 'Testreeks Kaart 1280')
    await login(page, 'u-01')
    await ga(page, `/accounts/${id}?meer=reeksen`)
    const f = page.getByTestId('reeksen-flyout')
    await expect(f).toBeVisible()
    await expect(f.getByTestId('fs-terug')).toHaveCount(0)
    await expect(f.getByTestId('arf-eerdere')).toBeVisible()
  })
})
