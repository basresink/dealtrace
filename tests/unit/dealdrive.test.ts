// P23: de DealDrive-koppeling. HMAC (tijdgrens, andere body, ontbrekende header), naarContract,
// foutcodes, het schema voor opnieuw proberen, de betekenis van terugmeldingen, en de contracttests:
// dezelfde suite tegen de mock en tegen de uitvoering http met een lokale testserver die de fixtures uit
// seed/dealdrive-mock ongewijzigd teruggeeft. Elk verzoek en elk antwoord gaat langs de OpenAPI-specificatie.
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { parse } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { controleerHandtekening, controleerTerugmelding, foutNaarMelding, FOUTCODES, naarContract, tekenVerzoek, verwerkTerugmelding } from '../../shared/dealdrive'
import { volgendePoging } from '../../shared/funnel'
import { verkoopverhaalUitSeed } from '../../shared/verkoopverhaal'
import { httpKoppeling, koppelingsUrl, mockKoppeling, type DealDriveKoppeling } from '../../server/utils/dealdriveAdapter'

const fixture = (f: string) => JSON.parse(readFileSync(`seed/dealdrive-mock/${f}`, 'utf8'))
const VERZOEK = fixture('overdracht-verzoek.json')
const ANTWOORD = fixture('overdracht-antwoord.json')
const AL_KLANT = fixture('fout-al-klant.json')
const ZOEK = fixture('zoek-antwoord.json')
const WEBHOOKS = ['webhook-overdracht-verwerkt.json', 'webhook-deal-gewonnen.json', 'webhook-deal-verloren.json', 'webhook-klant-slapend.json'].map(fixture)
const GEHEIM = 'testgeheim-voor-de-contracttests-32-tekens'

const spec = parse(readFileSync('docs/api/dealdrive-koppeling.openapi.yaml', 'utf8'))
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addSchema({ $id: 'dd', components: spec.components })
const schema = (naam: string) => ajv.compile({ $ref: `dd#/components/schemas/${naam}` })
const past = (naam: string, data: unknown) => { const v = schema(naam); const ok = v(data); return ok ? true : v.errors }
const ZOEK_SCHEMA = ajv.compile(JSON.parse(JSON.stringify(spec.paths['/accounts/zoek'].get.responses['200'].content['application/json'].schema).replaceAll('"#/components', '"dd#/components')))

describe('handtekening (hoofdstuk 2)', () => {
  const body = '{"a":1}'
  const nu = new Date('2026-10-15T12:00:00Z')
  const t = Math.floor(nu.getTime() / 1000)
  it('sha256=<hex> over "<tijd>.<body>"; geldig binnen het venster', () => {
    const h = tekenVerzoek(body, GEHEIM, t)
    expect(h).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(controleerHandtekening({ handtekening: h, tijd: String(t) }, body, GEHEIM, nu)).toEqual({ geldig: true })
  })
  it('precies 5 minuten verschil mag, daarboven tijd_verlopen', () => {
    const oud = t - 300
    expect(controleerHandtekening({ handtekening: tekenVerzoek(body, GEHEIM, oud), tijd: String(oud) }, body, GEHEIM, nu).geldig).toBe(true)
    const te = t - 301
    expect(controleerHandtekening({ handtekening: tekenVerzoek(body, GEHEIM, te), tijd: String(te) }, body, GEHEIM, nu)).toEqual({ geldig: false, fout: 'tijd_verlopen' })
    expect(controleerHandtekening({ handtekening: tekenVerzoek(body, GEHEIM, t + 301), tijd: String(t + 301) }, body, GEHEIM, nu)).toEqual({ geldig: false, fout: 'tijd_verlopen' })
  })
  it('andere body, ander geheim of ontbrekende header: handtekening_ongeldig', () => {
    const h = tekenVerzoek(body, GEHEIM, t)
    expect(controleerHandtekening({ handtekening: h, tijd: String(t) }, '{"a":2}', GEHEIM, nu)).toEqual({ geldig: false, fout: 'handtekening_ongeldig' })
    expect(controleerHandtekening({ handtekening: h, tijd: String(t) }, body, 'ander-geheim', nu).geldig).toBe(false)
    expect(controleerHandtekening({ handtekening: null, tijd: String(t) }, body, GEHEIM, nu).geldig).toBe(false)
    expect(controleerHandtekening({ handtekening: h, tijd: null }, body, GEHEIM, nu).geldig).toBe(false)
    expect(controleerHandtekening({ handtekening: h, tijd: 'gisteren' }, body, GEHEIM, nu).geldig).toBe(false)
  })
})

describe('naarContract', () => {
  it('de fixture blijft geldig volgens de OpenAPI-specificatie', () => {
    expect(past('Overdracht', naarContract(VERZOEK))).toBe(true)
  })
  it('verplichte velden ontbreken: ongeldige_invoer met de velden', () => {
    const { vervolgstap: _v, ...zonder } = VERZOEK
    let fout: any
    try { naarContract({ ...zonder, contacten: [] }) } catch (e) { fout = e }
    expect(fout.code).toBe('ongeldige_invoer')
    expect(fout.velden).toEqual(['contacten', 'vervolgstap.omschrijving'])
  })
  it('privégegevens leeg, geen offertes of deals, vaste volgorde voor de hash', () => {
    const p = { ...VERZOEK, offertes: [{ id: 'x' }], deals: [{ id: 'y' }], contacten: [{ ...VERZOEK.contacten[0], prive: ['mobiel'] }] }
    const c: any = naarContract(p)
    expect(c.contacten[0].mobiel).toBeNull()
    expect(c.contacten[0].prive).toBeUndefined()
    expect(c.offertes).toBeUndefined()
    expect(c.deals).toBeUndefined()
    const omgekeerd = Object.fromEntries(Object.entries(VERZOEK).reverse())
    expect(JSON.stringify(naarContract(omgekeerd))).toBe(JSON.stringify(naarContract(VERZOEK)))
  })
})

describe('foutcodes en opnieuw proberen', () => {
  it('elke code een melding in gewone taal; onbekend valt terug op interne_fout', () => {
    for (const c of FOUTCODES) expect(foutNaarMelding(c).length).toBeGreaterThan(20)
    expect(foutNaarMelding('bestaat_niet')).toBe(foutNaarMelding('interne_fout'))
    expect(foutNaarMelding('ongeldige_invoer', ['account.naam'])).toContain('Ontbreekt: account.naam')
  })
  it('schema 1, 5 en 30 minuten, 2 en 12 uur; de zesde poging is mislukt', () => {
    const nu = new Date('2026-10-15T10:00:00Z')
    const min = [1, 2, 3, 4, 5].map((n) => (volgendePoging(n, nu)!.getTime() - nu.getTime()) / 60_000)
    expect(min).toEqual([1, 5, 30, 120, 720])
    expect(volgendePoging(6, nu)).toBeNull()
  })
})

describe('verwerkTerugmelding', () => {
  const stand = verkoopverhaalUitSeed(JSON.parse(readFileSync('seed/voltvast.json', 'utf8')).verkoopverhaal)
  it('de vier webhooks passen in het schema Gebeurtenis', () => {
    for (const w of WEBHOOKS) { expect(past('Gebeurtenis', w)).toBe(true); expect(controleerTerugmelding(w)).toEqual([]) }
  })
  it('overdracht.verwerkt bevestigt de overdracht uit de gegevens', () => {
    expect(verwerkTerugmelding(WEBHOOKS[0], stand)).toEqual({ soort: 'overdracht-bevestigd', overdrachtId: '5d2f7c1e-0b7a-4c1e-9a55-1f3f0c2b9e10' })
  })
  it('deal.gewonnen: geen klant, alleen tellen', () => {
    expect(verwerkTerugmelding(WEBHOOKS[1], stand)).toMatchObject({ soort: 'gewonnen', dealId: 'deal_dd_9041', waarde: 4850000 })
  })
  it('deal.verloren met reden Prijs: via de redenmapping naar hc-03; zonder verlorenAan ook', () => {
    const r: any = verwerkTerugmelding(WEBHOOKS[2], stand)
    expect(r).toMatchObject({ soort: 'winback', reden: 'Prijs', verlorenAan: 'Online webgroothandel' })
    expect(r.regel.id).toBe('hc-03')
    const zonder: any = verwerkTerugmelding({ ...WEBHOOKS[2], gegevens: { dealId: 'd', reden: 'Prijs' } }, stand)
    expect(zonder.verlorenAan).toBeNull()
  })
  it('klant.slapend 6: hc-04; 3 en 12 zonder regel in de startset', () => {
    expect((verwerkTerugmelding(WEBHOOKS[3], stand) as any).regel.id).toBe('hc-04')
    for (const m of [3, 12]) expect(verwerkTerugmelding({ ...WEBHOOKS[3], gegevens: { maandenNietBesteld: m } }, stand)).toMatchObject({ soort: 'herwin', maanden: m, regel: null })
  })
  it('vormcontrole: ontbrekende velden en een ongeldig aantal maanden', () => {
    expect(controleerTerugmelding({ soort: 'deal.gewonnen' })).toEqual(['gebeurtenisId', 'op', 'dealtraceAccountId'])
    expect(controleerTerugmelding({ ...WEBHOOKS[3], gegevens: { maandenNietBesteld: 7 } })).toEqual(['gegevens.maandenNietBesteld'])
  })
})

// ── Contracttests: mock en http met een lokale testserver ───────────────────
const ontvangen: { methode: string; pad: string; headers: Record<string, string>; body: string }[] = []
const accountsAangemaakt = new Set<string>()
let server: Server
let basis = ''
beforeAll(async () => {
  const gezien = new Map<string, unknown>()
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      const h = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]))
      ontvangen.push({ methode: req.method!, pad: req.url!, headers: h, body })
      const stuur = (s: number, j: unknown) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
      const ok = controleerHandtekening({ handtekening: h['x-koppeling-handtekening'], tijd: h['x-koppeling-tijd'] }, body, GEHEIM)
      if (!ok.geldig) return stuur(401, { fout: { code: ok.fout, bericht: 'x' } })
      if (h['x-koppeling-organisatie'] !== 'dd-org-1') return stuur(404, { fout: { code: 'organisatie_onbekend', bericht: 'x' } })
      const pad = req.url!.replace('/api/koppelingen/dealtrace/v1', '')
      if (req.method === 'POST' && pad === '/overdrachten') {
        const b = JSON.parse(body)
        if (!past('Overdracht', b) || !h['idempotentie-sleutel']) return stuur(422, { fout: { code: 'ongeldige_invoer', bericht: 'x' } })
        if (b.account.kvkNummer === '99777777' && !b.alsNieuweKansBijKlant) return stuur(409, AL_KLANT)
        const sleutel = h['idempotentie-sleutel']
        if (gezien.has(sleutel)) return stuur(200, gezien.get(sleutel))
        accountsAangemaakt.add(sleutel)
        gezien.set(sleutel, ANTWOORD)
        return stuur(201, ANTWOORD)
      }
      if (req.method === 'GET' && pad.startsWith('/overdrachten/')) return gezien.has(pad.split('/')[2]!) ? stuur(200, ANTWOORD) : stuur(404, { fout: { code: 'account_onbekend', bericht: 'x' } })
      if (req.method === 'GET' && pad.startsWith('/accounts/zoek')) return stuur(200, new URL(pad, 'http://x').searchParams.get('kvk') === '99123456' ? ZOEK : { treffers: [] })
      if (req.method === 'GET' && pad === '/ping') return stuur(200, { status: 'ok', versie: 'test' })
      if (pad === '/storing') return stuur(503, { fout: { code: 'interne_fout', bericht: 'x' } })
      return stuur(404, { fout: { code: 'interne_fout', bericht: 'x' } })
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const uitvoeringen: [string, () => DealDriveKoppeling][] = [
  ['mock', () => mockKoppeling([{ naam: 'Testklant Kabelwerk', kvk: '99777777' }])],
  ['http', () => httpKoppeling({ basisUrl: basis, organisatieId: 'dd-org-1', geheim: GEHEIM })],
]
describe.each(uitvoeringen)('contract: %s', (naam, maak) => {
  const id = (n: number) => `5d2f7c1e-0b7a-4c1e-9a55-${naam === 'mock' ? '0' : '1'}00000000${n}0`
  it('overdragen: 201 met het accountId uit overdracht-antwoord.json; het antwoord past', async () => {
    const r = await maak().overdragen({ ...VERZOEK, overdrachtId: id(1) })
    expect(r).toMatchObject({ ok: true, status: 201, accountId: 'acc_dd_5520', dealId: 'deal_dd_9041', bevestigd: false })
    expect(past('OverdrachtAntwoord', ANTWOORD)).toBe(true)
  })
  it('tweede verzending met dezelfde sleutel: 200, geen tweede account', async () => {
    const k = maak()
    await k.overdragen({ ...VERZOEK, overdrachtId: id(2) })
    const r = await k.overdragen({ ...VERZOEK, overdrachtId: id(2) })
    expect(r).toMatchObject({ ok: true, status: 200, accountId: 'acc_dd_5520' })
    if (naam === 'http') {
      expect([...accountsAangemaakt].filter((s) => s === id(2))).toHaveLength(1)
      const posts = ontvangen.filter((o) => o.methode === 'POST' && JSON.parse(o.body).overdrachtId === id(2))
      expect(posts.map((p) => p.headers['idempotentie-sleutel'])).toEqual([id(2), id(2)])
    }
  })
  it('409 al_klant (fout-al-klant.json); met alsNieuweKansBijKlant gaat hij door', async () => {
    const klant = { ...VERZOEK, overdrachtId: id(3), account: { ...VERZOEK.account, kvkNummer: '99777777', naam: 'Testklant Kabelwerk' } }
    expect(past('Fout', AL_KLANT)).toBe(true)
    expect(await maak().overdragen(klant)).toMatchObject({ ok: false, code: 'al_klant', accountId: 'acc_dd_1200' })
    expect(await maak().overdragen({ ...klant, alsNieuweKansBijKlant: true })).toMatchObject({ ok: true })
  })
  it('zoekAccount: het KvK-nummer uit zoek-antwoord.json geeft de prospect; het antwoord past', async () => {
    const t = await maak().zoekAccount!({ kvk: '99123456' })
    expect(t).toEqual(ZOEK.treffers)
    expect(ZOEK_SCHEMA(ZOEK)).toBe(true)
    expect(await maak().zoekAccount!({ kvk: '99000000' })).toEqual([])
  })
  it('status na versturen en ping', async () => {
    const k = maak()
    await k.overdragen({ ...VERZOEK, overdrachtId: id(4) })
    expect(await k.status!(id(4))).toMatchObject({ gevonden: true, status: 'ontvangen', accountId: 'acc_dd_5520' })
    expect(await k.status!(id(5))).toEqual({ gevonden: false })
    expect((await k.ping!()).ok).toBe(true)
  })
})

describe('http: ondertekening en fouten', () => {
  it('elk verzoek draagt tijd, organisatie en een geldige handtekening over de ruwe body', () => {
    const http = ontvangen.filter((o) => o.headers['x-koppeling-organisatie'] === 'dd-org-1')
    expect(http.length).toBeGreaterThan(5)
    for (const o of http) expect(controleerHandtekening({ handtekening: o.headers['x-koppeling-handtekening'], tijd: o.headers['x-koppeling-tijd'] }, o.body, GEHEIM).geldig).toBe(true)
  })
  it('verkeerd geheim: geen nieuwe poging (handtekening_ongeldig); 5xx en onbereikbaar: tijdelijk', async () => {
    const fout = await httpKoppeling({ basisUrl: basis, organisatieId: 'dd-org-1', geheim: 'verkeerd-geheim-verkeerd-geheim-xx' }).overdragen({ ...VERZOEK, overdrachtId: '5d2f7c1e-0b7a-4c1e-9a55-200000000000' })
    expect(fout).toMatchObject({ ok: false, code: 'fout', tijdelijk: false, foutcode: 'handtekening_ongeldig' })
    const storing = await httpKoppeling({ basisUrl: `${basis}/storing#`, organisatieId: 'dd-org-1', geheim: GEHEIM }, {}).ping!()
    expect(storing.ok).toBe(false)
    const weg = await httpKoppeling({ basisUrl: 'http://127.0.0.1:9', organisatieId: 'dd-org-1', geheim: GEHEIM }, { timeoutMs: 500 }).overdragen({ ...VERZOEK, overdrachtId: '5d2f7c1e-0b7a-4c1e-9a55-300000000000' })
    expect(weg).toMatchObject({ ok: false, tijdelijk: true })
  })
  it('basis-URL krijgt het pad van de koppeling', () => {
    expect(koppelingsUrl('https://dealdrive.test/')).toBe('https://dealdrive.test/api/koppelingen/dealtrace/v1')
    expect(koppelingsUrl('https://dealdrive.test/api/koppelingen/dealtrace/v1')).toBe('https://dealdrive.test/api/koppelingen/dealtrace/v1')
  })
})
