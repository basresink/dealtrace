// API-regels: rechten, redenen bij 403, verborgen instellingen, teamgrens en sync.
import { expect, test } from '@playwright/test'
import { apiLogin } from './hulp'

test.describe('API', () => {
  test('403 met reden rol en niveau', async ({ request }) => {
    await apiLogin(request, 'u-02')
    // Beginner: niveau wijzigen mag de accountmanager niet (rol).
    const rol = await request.post('/api/gebruikers/u-03/niveau', { data: { niveau: 'expert' } })
    expect(rol.status()).toBe(403)
    expect((await rol.json()).data?.reden).toBe('rol')
    // Leadgenerator staat voor Beginner nog niet aan. De reden 'pakket' testen de unit-tests:
    // in P01 zitten alle functies nog in het pakket Starter.
    const lijst = await (await request.get('/api/functies')).json()
    expect(lijst.find((f: any) => f.sleutel === 'nav.leadgenerator')?.reden).toBe('niveau')
  })

  test('verborgen instellingen blijven verborgen', async ({ request }) => {
    await apiLogin(request, 'u-06')
    const alles = await (await request.get('/api/settings')).json()
    for (const k of ['pakket', 'aiCredits', 'features', 'platformprompts']) expect(alles).not.toHaveProperty(k)
    expect((await request.put('/api/settings/pakket', { data: { value: 'compleet' } })).status()).toBe(403)
    expect((await request.put('/api/settings/bestaatniet', { data: { value: 1 } })).status()).toBe(400)
  })

  test('salesmanager zet alleen niveaus in zijn eigen teams', async ({ request }) => {
    await apiLogin(request, 'u-04')
    const zichtbaar = await (await request.get('/api/gebruikers')).json()
    expect(zichtbaar.some((g: any) => g.id === 'u-06')).toBe(false)
    const buiten = await request.post('/api/gebruikers/u-06/niveau', { data: { niveau: 'gevorderd', reden: 'test' } })
    expect(buiten.status()).toBe(403)
  })

  test('verlagen zonder reden geeft 400', async ({ request }) => {
    await apiLogin(request, 'u-06')
    const r = await request.post('/api/gebruikers/u-07/niveau', { data: { niveau: 'beginner' } })
    expect(r.status()).toBe(400)
  })

  test('accountmanager ziet geen gebruikerslijst', async ({ request }) => {
    await apiLogin(request, 'u-02')
    expect((await request.get('/api/gebruikers')).status()).toBe(403)
  })

  test('sync is idempotent en meldt een versieconflict', async ({ request }) => {
    await apiLogin(request, 'u-02')
    const sleutel = crypto.randomUUID()
    const mutatie = { idempotentieSleutel: sleutel, tabel: 'persoonlijke_instellingen', op: 'patch', recordId: 'u-02', patch: { test: sleutel } }
    const een = await (await request.post('/api/sync/mutations', { data: { mutaties: [mutatie] } })).json()
    const twee = await (await request.post('/api/sync/mutations', { data: { mutaties: [mutatie] } })).json()
    expect(een.resultaten[0].status).toBe('ok')
    expect(twee.resultaten[0]).toEqual(een.resultaten[0])

    const oud = { ...mutatie, idempotentieSleutel: crypto.randomUUID(), versie: 0 }
    const conflict = await (await request.post('/api/sync/mutations', { data: { mutaties: [oud] } })).json()
    expect(conflict.resultaten[0].status).toBe('conflict')

    const vreemd = { ...mutatie, idempotentieSleutel: crypto.randomUUID(), recordId: 'u-03' }
    const geweigerd = await (await request.post('/api/sync/mutations', { data: { mutaties: [vreemd] } })).json()
    expect(geweigerd.resultaten[0].status).toBe('geweigerd')

    const onbekend = { ...mutatie, idempotentieSleutel: crypto.randomUUID(), tabel: 'users' }
    const r = await request.post('/api/sync/mutations', { data: { mutaties: [onbekend] } })
    const body = r.ok() ? (await r.json()).resultaten[0].status : r.status()
    expect(body === 'geweigerd' || body === 400).toBe(true)
  })
})
