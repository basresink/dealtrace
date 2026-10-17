// Terug in beeld: status, groep, tellers, filters, starten binnen de afkoeling, belblok alleen bij bellen, Later
// nooit binnen de afkoeling, de bewaarde stand bij heropvolging en de functie in de zijbalk.
import { describe, expect, it } from 'vitest'
import { FUNCTIES, startindeling } from '../../shared/functies'
import {
  belblokMag, bijHeropvolging, groepVan, herkomstTekst, laterDatum, laterVoorstel, magStarten, pastFilter, regelTekst, sorteer, statusVan, tellers, uitlegVan,
  type TerugRij,
} from '../../shared/terugInBeeld'

const VANDAAG = '2026-11-02'
const rij = (p: Partial<TerugRij> = {}): TerugRij => ({
  id: 'p1', naam: 'Testbouw Zwolle', plaats: 'Zwolle', klasse: 'A · Corporate', eigenaar: { id: 'u-07', naam: 'Eva' }, bron: 'nee', reden: 'Prijs', toelichting: null,
  verlorenOp: '2026-05-05', terugOp: '2026-11-03', opgeschoven: false, hand: false, afkoelEind: '2026-08-03', kanaal: 'bellen',
  regel: { id: 'hc-03', naam: 'Prijs te hoog', dagen: 182, oppakker: 'Buitendienst', aanpak: 'Langs met een klantverhaal.', ritmeId: null },
  aanpak: 'Langs met een klantverhaal.', gestart: null, teruggekomen: false, ...p,
})

describe('status en groep', () => {
  it('over tijd, klaar, afkoeling, gepland en gestart', () => {
    expect(statusVan(rij({ terugOp: '2026-10-30' }), VANDAAG)).toBe('overtijd')
    expect(statusVan(rij({ terugOp: '2026-11-05' }), VANDAAG)).toBe('klaar')
    expect(statusVan(rij({ terugOp: '2026-11-05', afkoelEind: '2026-11-05' }), VANDAAG)).toBe('afkoeling')
    expect(statusVan(rij({ terugOp: '2026-11-20' }), VANDAAG)).toBe('gepland')
    expect(statusVan(rij({ terugOp: '2026-10-30', gestart: { soort: 'taak', op: '2026-11-02T09:00:00Z', eersteOp: VANDAAG } }), VANDAAG)).toBe('gestart')
  })
  it('deze week tot en met zes dagen (ook over tijd), deze maand tot de laatste dag, daarna later', () => {
    expect(groepVan('2026-10-01', VANDAAG)).toBe('week')
    expect(groepVan('2026-11-08', VANDAAG)).toBe('week')
    expect(groepVan('2026-11-30', VANDAAG)).toBe('maand')
    expect(groepVan('2026-12-01', VANDAAG)).toBe('later')
  })
  it('tellers en sortering op datum', () => {
    const lijst = [rij({ id: 'a', terugOp: '2026-12-10' }), rij({ id: 'b', terugOp: '2026-10-20' }), rij({ id: 'c', terugOp: '2026-11-15', gestart: { soort: 'reeks', op: '2026-11-01T10:00:00Z', eersteOp: '2026-11-02' } })]
    expect(tellers(lijst, VANDAAG)).toEqual({ week: 1, maand: 1, later: 1, overtijd: 1, gestart: 1 })
    expect(sorteer(lijst).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('starten', () => {
  it('niet binnen de afkoeling, met de dag waarop het wel mag', () => {
    const m = magStarten(rij({ afkoelEind: '2026-11-05' }), VANDAAG)
    expect(m.mag).toBe(false)
    expect(m.vanaf).toBe('2026-11-05')
    expect(m.reden).toBe('Mag vanaf do 5 nov: de afkoeling voor bellen loopt nog.')
    expect(magStarten(rij(), VANDAAG).mag).toBe(true)
    expect(magStarten(rij({ gestart: { soort: 'taak', op: 'x', eersteOp: null } }), VANDAAG).mag).toBe(false)
  })
  it('voor de terugkomdatum mag het al als de afkoeling voorbij is', () => {
    const r = rij({ terugOp: '2026-11-20', afkoelEind: '2026-10-01' })
    expect(statusVan(r, VANDAAG)).toBe('gepland')
    expect(magStarten(r, VANDAAG).mag).toBe(true)
  })
  it('belblok alleen bij bellen', () => {
    expect(belblokMag('bellen').mag).toBe(true)
    expect(belblokMag('mail')).toEqual({ mag: false, reden: 'Kan niet: de regel zegt mail, geen bellen.' })
  })
})

describe('Later', () => {
  it('nooit binnen de afkoeling en nooit vandaag of eerder', () => {
    expect(laterDatum('2026-11-10', rij({ afkoelEind: '2026-12-01' }), VANDAAG)).toEqual({ datum: '2026-12-01', geschoven: true })
    expect(laterDatum('2026-10-01', rij({ afkoelEind: null }), VANDAAG)).toEqual({ datum: '2026-11-03', geschoven: false })
    expect(laterDatum('2026-12-24', rij(), VANDAAG)).toEqual({ datum: '2026-12-24', geschoven: false })
  })
  it('voorstel: twee weken na de huidige datum of na vandaag', () => {
    expect(laterVoorstel(rij({ terugOp: '2026-10-20' }), VANDAAG)).toBe('2026-11-16')
    expect(laterVoorstel(rij({ terugOp: '2026-11-20' }), VANDAAG)).toBe('2026-12-04')
  })
})

describe('filters en teksten', () => {
  it('regel, zonder regel, kanaal, status en zoeken op naam of plaats', () => {
    const r = rij()
    expect(pastFilter(r, { regel: 'hc-03' }, VANDAAG)).toBe(true)
    expect(pastFilter(r, { regel: 'geen' }, VANDAAG)).toBe(false)
    expect(pastFilter(rij({ regel: null }), { regel: 'geen' }, VANDAAG)).toBe(true)
    expect(pastFilter(r, { kanaal: 'mail' }, VANDAAG)).toBe(false)
    expect(pastFilter(r, { status: 'klaar' }, VANDAAG)).toBe(true)
    expect(pastFilter(r, { zoek: 'zwol' }, VANDAAG)).toBe(true)
    expect(pastFilter(r, { zoek: 'ede' }, VANDAAG)).toBe(false)
  })
  it('regel, herkomst en uitleg in gewone taal', () => {
    expect(regelTekst(rij())).toBe('Prijs te hoog, na 182 dagen')
    expect(regelTekst(rij({ regel: null }))).toBe('Geen regel: afkoeling bellen')
    expect(herkomstTekst(rij())).toBe('Nee gezet op 5 mei 2026 · reden: Prijs')
    expect(herkomstTekst(rij({ bron: 'offerte_verloren', verlorenOp: null, reden: 'Offerte verloren' }))).toBe('Offerte verloren · reden: Offerte verloren')
    expect(uitlegVan(rij({ terugOp: '2026-11-20' }), VANDAAG)).toBe('Staat op vr 20 nov vanzelf in Vandaag.')
    expect(uitlegVan(rij({ terugOp: '2026-10-30' }), VANDAAG)).toBe('Sinds vr 30 okt terug in beeld. Start vandaag, dan telt hij nog als op tijd tot vr 6 nov.')
    expect(uitlegVan(rij({ gestart: { soort: 'reeks', op: 'x', eersteOp: '2026-11-02', ritmeNaam: 'Winback' } }), VANDAAG)).toBe('Reeks Winback loopt, stap 1 op ma 2 nov.')
    expect(uitlegVan(rij({ gestart: { soort: 'belblok', op: 'x', eersteOp: '2026-11-03', blokLabel: 'di 3 nov 10:00 tot 11:30' } }), VANDAAG)).toBe('Ingepland in het belblok van di 3 nov 10:00 tot 11:30.')
    expect(uitlegVan(rij({ gestart: { soort: 'taak', op: 'x', eersteOp: '2026-11-02' } }), VANDAAG)).toBe('Taak staat op ma 2 nov in Taken.')
  })
})

describe('heropvolging bewaart de stand', () => {
  const nu = new Date('2026-11-02T06:00:00Z')
  it('uit de nee: reden, datum, regel, kanaal en het einde van de afkoeling', () => {
    const s = bijHeropvolging({ terugOp: '2026-11-02', terugRegelId: 'hc-03', data: { nee: { reden: 'Prijs', op: '2026-05-05T10:00:00Z', afkoeling: { bellen: 90, bezoek: 180 } }, terugkom: { kanaal: 'bezoek', aanpak: 'Langs' } } }, nu)
    expect(s).toMatchObject({ terugOp: '2026-11-02', regelId: 'hc-03', reden: 'Prijs', bron: 'nee', verlorenOp: '2026-05-05', kanaal: 'bezoek', afkoelEind: '2026-11-01', hand: false, gestart: null })
  })
  it('Niet geschikt komt nooit terug; zonder nee blijft een gestarte stand staan', () => {
    expect(bijHeropvolging({ terugOp: '2027-11-02', terugRegelId: null, data: { nee: { reden: 'Niet geschikt', op: '2026-11-02T10:00:00Z', afkoeling: {} } } }, nu)).toBeNull()
    const gestart = { reden: 'Prijs', gestart: { soort: 'taak' } }
    expect(bijHeropvolging({ terugOp: null, terugRegelId: null, data: { terugInBeeld: gestart } }, nu)).toBe(gestart)
    expect(bijHeropvolging({ terugOp: '2026-12-01', terugRegelId: null, data: { terugInBeeld: { reden: 'Prijs', terugOp: '2026-11-01' } } }, nu)).toMatchObject({ terugOp: '2026-12-01', teruggekomenOp: nu.toISOString() })
  })
})

describe('functie', () => {
  it('in de zijbalk onder Planning, direct na Prospectplanning, op het niveau van de terugkomregels', () => {
    const f = FUNCTIES.find((x) => x.sleutel === 'nav.terugInBeeld')!
    expect(f.zijbalk).toMatchObject({ groep: 'Planning', route: '/terug-in-beeld', na: 'nav.planning' })
    expect(f.startNiveau).toBe(FUNCTIES.find((x) => x.sleutel === 'terugkomen.lezen')!.startNiveau)
    expect(startindeling().filter((r) => r.functie === 'nav.terugInBeeld')).toHaveLength(3)
  })
})
