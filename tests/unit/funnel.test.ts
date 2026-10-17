import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import {
  conversie, doorlooptijd, FUNNEL_FASES, funnelStand, kopTekst, leesNormen, magOverdragen, NORMEN_STANDAARD, overdrachtBriefing, overdrachtPakket,
  eersteAfspraakPoging, pogingTotAfspraak, stokpunt, uitvalPerReden, volgendePoging, type GeschRij, type PakketContext,
} from '../../shared/funnel'

const periode = { van: '2026-10-01T00:00:00Z', tot: '2026-10-31T23:59:59Z' }
const r = (accountId: string, naarFaseId: string, dag: number, gebeurtenis = 'x', reden: string | null = null): GeschRij => ({ accountId, naarFaseId, gebeurtenis, op: `2026-10-${String(dag).padStart(2, '0')}T10:00:00.000Z`, reden })
const fase = (s: ReturnType<typeof funnelStand>, f: string) => s.find((x) => x.faseId === f)!

describe('funnelStand', () => {
  it('een account telt in elke fase die het bereikte en niet in een overgeslagen fase', () => {
    const s = funnelStand([r('a', 'gevonden', 1), r('a', 'gekwalificeerd', 3), r('a', 'benaderd', 5), r('a', 'in-gesprek', 8), r('a', 'afspraak-gepland', 12)], periode)
    expect(FUNNEL_FASES.map((f) => fase(s, f).binnengekomen)).toEqual([1, 0, 1, 1, 1, 1, 0, 0])
    expect(fase(s, 'gevonden').doorgestroomd).toBe(1)
    expect(fase(s, 'afspraak-gepland').aanwezig).toBe(1)
  })
  it('binnengekomen = doorgestroomd + uitgevallen + aanwezig, per fase', () => {
    const rijen = [
      r('a', 'gevonden', 1), r('a', 'gekwalificeerd', 2), r('a', 'benaderd', 4), r('a', 'verloren', 9, 'nee', 'Geen budget'),
      r('b', 'gevonden', 2), r('b', 'gekwalificeerd', 3), r('b', 'geparkeerd', 10, 'geparkeerd'),
      r('c', 'gevonden', 3),
      r('d', 'afspraak-gepland', 4), r('d', 'in-gesprek', 6, 'afspraak-niet-verschenen'),
    ]
    for (const f of funnelStand(rijen, periode)) expect(f.binnengekomen).toBe(f.doorgestroomd + f.uitgevallen + f.aanwezig)
    const s = funnelStand(rijen, periode)
    expect(fase(s, 'benaderd').uitval).toEqual({ 'Geen budget': 1 })
    expect(fase(s, 'gekwalificeerd').uitval).toEqual({ Geparkeerd: 1 })
    expect(fase(s, 'afspraak-gepland').uitval).toEqual({ 'No-show': 1 })
  })
  it('twee keer door dezelfde fase telt één keer per periode; buiten de periode telt niet', () => {
    const s = funnelStand([r('a', 'benaderd', 2), r('a', 'in-gesprek', 4), r('a', 'benaderd', 6), r('a', 'in-gesprek', 7), { accountId: 'z', naarFaseId: 'gevonden', gebeurtenis: 'import', op: '2026-09-20T10:00:00Z' }], periode)
    expect(fase(s, 'benaderd').binnengekomen).toBe(1)
    expect(fase(s, 'gevonden').binnengekomen).toBe(0)
  })
  it('lege periode', () => {
    const s = funnelStand([], periode)
    expect(s.every((f) => f.binnengekomen === 0)).toBe(true)
    expect(kopTekst(s, null).titel).toBe('Nog geen accounts in deze periode.')
  })
  it('met uitTot telt de uitstroom van later mee (afgeleide stand per dag)', () => {
    const rij = [r('a', 'benaderd', 2), r('a', 'in-gesprek', 20)]
    expect(fase(funnelStand(rij, { van: '2026-10-02T00:00:00Z', tot: '2026-10-03T00:00:00Z' }), 'benaderd').aanwezig).toBe(1)
    expect(fase(funnelStand(rij, { van: '2026-10-02T00:00:00Z', tot: '2026-10-03T00:00:00Z', uitTot: periode.tot }), 'benaderd').doorgestroomd).toBe(1)
  })
})

describe('conversie, doorlooptijd, stokpunt', () => {
  it('conversie zonder noemer is n.v.t.', () => {
    expect(conversie(0, 0)).toBeNull()
    expect(conversie(3, 1)).toBe(33)
  })
  it('doorlooptijd telt alleen wie de fase verliet', () => {
    const s = funnelStand([r('a', 'benaderd', 1), r('a', 'in-gesprek', 5), r('b', 'benaderd', 2)], periode)
    expect(doorlooptijd(fase(s, 'benaderd'))).toBe(4)
    expect(doorlooptijd({ doorlooptijdSom: 0, doorlooptijdAantal: 0 })).toBeNull()
  })
  it('de grootste achterstand op de norm; gelijk: de eerste; alles boven de norm: geen markering', () => {
    const rijen: GeschRij[] = []
    // Benaderd: 10 binnen, 1 door (10%, norm 30, achter 20). In gesprek: 5 binnen, 0 door (0%, norm 35, achter 35).
    for (let i = 0; i < 10; i++) rijen.push(r(`b${i}`, 'benaderd', 2))
    rijen.push(r('b0', 'in-gesprek', 5))
    for (let i = 1; i < 5; i++) rijen.push(r(`g${i}`, 'in-gesprek', 3))
    const s = funnelStand(rijen, periode)
    expect(stokpunt(s, NORMEN_STANDAARD)).toMatchObject({ faseId: 'in-gesprek', naarFaseId: 'afspraak-gepland', conversie: 0, norm: 35 })
    expect(kopTekst(s, stokpunt(s, NORMEN_STANDAARD)).stok).toBe('Hier stokt het: van In gesprek naar Afspraak gepland 0 procent, norm 35 procent.')
    // Gelijke achterstand (20 en 20): de eerste fase.
    expect(stokpunt(s, { benaderd: { conversie: 30 }, 'in-gesprek': { conversie: 20 } })!.faseId).toBe('benaderd')
    expect(stokpunt(s, { benaderd: { conversie: 30 }, 'in-gesprek': { conversie: 21 } })!.faseId).toBe('in-gesprek')
    expect(stokpunt(s, { benaderd: { conversie: 5 } })).toBeNull()
    expect(stokpunt(s, {})).toBeNull()
  })
  it('leesNormen vult aan met de standaard', () => {
    expect(leesNormen({ benaderd: { conversie: 40 } }).benaderd).toEqual({ conversie: 40, doorlooptijd: 21 })
    expect(leesNormen(null)['afspraak-gehouden']).toEqual({ conversie: 60, doorlooptijd: 2 })
  })
})

describe('pogingen en uitval', () => {
  it('bij welke poging de eerste afspraak ontstaat; zonder poging ervoor telt als 1', () => {
    const p = (a: string, dag: number, u: string | null = 'geen_reactie') => ({ accountId: a, op: `2026-10-${String(dag).padStart(2, '0')}T10:00:00Z`, uitkomst: u })
    expect(pogingTotAfspraak([p('a', 1, 'afspraak'), p('b', 1), p('b', 2), p('b', 3, 'afspraak'), ...[1, 2, 3, 4, 5, 6].map((d) => p('c', d)), p('c', 7, 'afspraak'), p('d', 1)]))
      .toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 0, later: 1 })
  })
  it('eersteAfspraakPoging: gemiddelde en verdeling bij poging 1, 2, 3 of 4 en later', () => {
    const p = (a: string, dag: number, u: string | null = 'geen_reactie') => ({ accountId: a, op: `2026-10-${String(dag).padStart(2, '0')}T10:00:00Z`, uitkomst: u })
    const pog = [p('a', 1, 'afspraak'), p('b', 1), p('b', 2), p('b', 3, 'afspraak'), p('b', 4, 'afspraak'), ...[1, 2, 3, 4, 5].map((d) => p('c', d)), p('c', 6, 'afspraak'), p('d', 1), p('e', 2, 'afspraak'), p('f', 3), p('f', 1)]
    const x = eersteAfspraakPoging(pog)
    expect(x.accounts).toBe(4)
    expect(x.verdeling).toEqual({ 1: 2, 2: 0, 3: 1, '4+': 1 })
    expect(x.gemiddeld).toBe(2.8) // (1 + 3 + 6 + 1) / 4 = 2,75
    expect(x.meest).toBe('1')
    // Volgorde in de invoer maakt niet uit; alleen de eerste afspraak telt.
    expect(eersteAfspraakPoging([p('g', 5, 'afspraak'), p('g', 2), p('g', 3)]).verdeling).toEqual({ 1: 0, 2: 0, 3: 1, '4+': 0 })
    // Vanaf: alleen eerste afspraken vanaf die datum, de pogingen ervoor tellen wel.
    expect(eersteAfspraakPoging(pog, '2026-10-02T00:00:00Z')).toMatchObject({ accounts: 3, verdeling: { 1: 1, 2: 0, 3: 1, '4+': 1 } })
    expect(eersteAfspraakPoging([p('d', 1)])).toEqual({ accounts: 0, gemiddeld: null, verdeling: { 1: 0, 2: 0, 3: 0, '4+': 0 }, meest: null })
  })
  it('top drie redenen, meest eerst', () => {
    expect(uitvalPerReden({ uitval: { 'Geen budget': 6, 'Tevreden met huidige leverancier': 14, 'Verkeerd moment': 5, Anders: 1 } }).map((u) => u.reden)).toEqual(['Tevreden met huidige leverancier', 'Geen budget', 'Verkeerd moment'])
  })
})

describe('overdracht', () => {
  it('magOverdragen: alleen na een gehouden eerste afspraak met vervolg, niet als er al een loopt', () => {
    const ok = { eerste: true, status: 'afgerond', overdragen: true }
    expect(magOverdragen({ nbStatus: 'gescoord' }, ok, false).ja).toBe(true)
    expect(magOverdragen({ nbStatus: 'gescoord' }, null, false)).toEqual({ ja: false, reden: 'Er is nog geen eerste afspraak' })
    expect(magOverdragen({ nbStatus: 'gescoord' }, { ...ok, status: 'gepland' }, false).ja).toBe(false)
    expect(magOverdragen({ nbStatus: 'gescoord' }, { ...ok, overdragen: false }, false).ja).toBe(false)
    expect(magOverdragen({ nbStatus: 'gescoord' }, ok, true).ja).toBe(false)
    expect(magOverdragen({ nbStatus: 'overgedragen' }, ok, false).ja).toBe(false)
  })
  it('opnieuw na 1, 5 en 30 minuten, 2 en 12 uur; daarna niet meer', () => {
    const nu = new Date('2026-10-15T10:00:00Z')
    expect([1, 2, 3, 4, 5].map((n) => (volgendePoging(n, nu)!.getTime() - nu.getTime()) / 60_000)).toEqual([1, 5, 30, 120, 720])
    expect(volgendePoging(6, nu)).toBeNull()
  })

  const ctx: PakketContext = {
    overdrachtId: '5d2f7c1e-0b7a-4c1e-9a55-1f3f0c2b9e10', op: '2026-10-15T12:05:00.000Z', door: { email: 'anouk@voltvast.test', naam: 'Anouk Noorderveld' }, nieuweEigenaar: 'eva.dijkstra@voltvast.test',
    account: { id: 'pr-02', naam: 'Testinstallatie Vonkenburg', kvk: '99123456', klasse: 'A', branche: 'Installatiebedrijven woningbouw', plaats: 'Drachten', postcode: '9201 AB', website: null, telefoon: null, eigenVelden: { aantalMonteurs: 24 } },
    contacten: [{ id: 'ct-09', voornaam: 'Piet', achternaam: 'Testpriv', email: 'piet@prive.test', mobiel: '+31600000001', rol: 'gebruiker', prive: ['email', 'mobiel'] }, { id: 'ct-03', voornaam: 'Marloes', achternaam: 'Testhuizen', functie: 'Eigenaar', email: 'marloes.testhuizen@vonkenburg.test', rol: 'beslisser' }],
    afspraak: { id: 'afs-vonkenburg', datum: '2026-10-14T08:00:00.000Z', soort: 'Kennismaking', vorm: 'bezoek', uitkomst: 'vervolg', verslag: 'Twee nieuwbouwprojecten.' },
    vervolgstap: { omschrijving: 'Gratis projectschouw op locatie', datum: '2026-10-22', soort: 'bezoek' }, winpunt: 'Gratis projectschouw binnen 48 uur',
    reis: { naam: 'Standaardreis', geschiedenis: [{ fase: 'Gevonden', op: '2026-09-02T10:00:00.000Z' }, { fase: 'Afspraak gehouden', op: '2026-10-14T09:00:00.000Z' }], pogingenTotAfspraak: 4, bron: 'KvK' },
    briefing: '## Overdracht Testinstallatie Vonkenburg',
  }
  const spec = parse(readFileSync('docs/api/dealdrive-koppeling.openapi.yaml', 'utf8'))
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  addFormats(ajv)
  ajv.addSchema({ $id: 'dd', components: spec.components })
  const valideer = ajv.compile({ $ref: 'dd#/components/schemas/Overdracht' })

  it('het pakket valideert tegen het schema van POST /overdrachten', () => {
    const p = overdrachtPakket(ctx)
    expect(valideer(p), JSON.stringify(valideer.errors)).toBe(true)
    expect(valideer(overdrachtPakket({ ...ctx, account: { id: 'x', naam: 'Kaal' }, contacten: [{ id: 'c', achternaam: 'Test' }], vervolgstap: { omschrijving: 'Bellen' }, reis: undefined, winpunt: null, nieuweEigenaar: null })), JSON.stringify(valideer.errors)).toBe(true)
  })
  it('de fixture uit seed/dealdrive-mock valideert ook (contract en fixture lopen gelijk)', () => {
    expect(valideer(JSON.parse(readFileSync('seed/dealdrive-mock/overdracht-verzoek.json', 'utf8'))), JSON.stringify(valideer.errors)).toBe(true)
  })
  it('geen privégegevens, deals of offertes; deterministische volgorde; minstens één contact', () => {
    const p = overdrachtPakket(ctx) as any
    expect(p.contacten.map((c: any) => c.dealtraceId)).toEqual(['ct-03', 'ct-09'])
    expect(p.contacten[1].email).toBeNull()
    expect(p.contacten[1].mobiel).toBeNull()
    expect(JSON.stringify(p)).not.toMatch(/prive\.test|offerte|"deal"/)
    expect(p.dealVoorstel).toEqual({ titel: 'Eerste afspraak Testinstallatie Vonkenburg', fase: 'behoefte', verwachteWaarde: null })
    expect(JSON.stringify(overdrachtPakket(ctx))).toBe(JSON.stringify(overdrachtPakket({ ...ctx, contacten: [...ctx.contacten].reverse() })))
    expect(() => overdrachtPakket({ ...ctx, contacten: [] })).toThrow(/Minstens één contact/)
  })
  it('de briefing is berekende tekst met wie, contacten, verslag en vervolgstap', () => {
    const b = overdrachtBriefing({ ...ctx, geschiedenis: ctx.reis!.geschiedenis })
    expect(b).toMatch(/^## Overdracht Testinstallatie Vonkenburg/)
    expect(b).toMatch(/Marloes Testhuizen, Eigenaar \(beslisser\)/)
    expect(b).toMatch(/\*\*Vervolgstap\*\*: Gratis projectschouw op locatie \(22 oktober 2026\)/)
    expect(b).not.toMatch(/[—–]/)
  })
})
