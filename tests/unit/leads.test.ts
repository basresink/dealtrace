// P11: de leadstroom in shared/leadGenerator.ts, met de grenzen uit de Definition of Done
// (30 en 120 dagen, 60 en 80 procent, 3 en 4 beoordeeld, 10 en 11 rondes).
import { describe, expect, it } from 'vitest'
import { creditsStand } from '../../shared/credits'
import {
  alleenEchteUrls, beoordeelLead, bijsturing, brancheUitSbi, controleerBewijs, controleerContacten, DAGGRENS_TEKST, dossierLabel, GRENZEN,
  groepeerLead, klasseUitMedewerkers, leadSleutels, leidZoekopdrachtAf, magRonde, pastNaBijsturing, zoekopdrachtHash, zoeksjablonen,
  type Bewijs, type BrancheMapping, type LeadFeiten,
} from '../../shared/leadGenerator'
import { zoekDuplicaat } from '../../shared/ontdubbelen'
import type { Klasse } from '../../shared/ritmematrix'

const nu = new Date('2026-10-15T10:00:00Z')
const dagenTerug = (n: number) => new Date(nu.getTime() - n * 864e5).toISOString()
const VOLTVAST: Klasse[] = [
  { id: 'kl-a-prospects', naam: 'A · Aantal monteurs (Prospects)', tabblad: 'Prospects' },
  { id: 'kl-b-prospects', naam: 'B · Aantal monteurs (Prospects)', tabblad: 'Prospects' },
  { id: 'kl-c-prospects', naam: 'C · Aantal monteurs (Prospects)', tabblad: 'Prospects' },
  { id: 'kl-a-klanten', naam: 'A · Jaaromzet bij Voltvast (Klanten)', tabblad: 'Klanten' },
]
const MAPPING: BrancheMapping[] = [
  { brancheId: 'br-01', sbiCodes: ['4321', '4322'], trefwoorden: [] },
  { brancheId: 'br-02', sbiCodes: ['4321', '4322'], trefwoorden: [] },
  { brancheId: 'br-03', sbiCodes: ['6820'], trefwoorden: [] },
  { brancheId: 'br-04', sbiCodes: ['4321'], trefwoorden: ['zonnepanelen'] },
]
const lead = (x: Partial<LeadFeiten> = {}): LeadFeiten => ({
  naam: 'Teeuwen Bouw', kvk: '91000001', plaats: 'Zwolle', postcode: '8011 AB', lat: 52.51, lng: 6.09, medewerkers: 60, sbi: ['4321'],
  contacten: [{ naam: 'Peter Kok', functie: 'eigenaar', telefoon: '+31381234567', bron: 'web' }],
  zinnen: [{ tekst: 'Teeuwen Bouw werft twee servicemonteurs voor de nieuwbouw.', bron: 'web', url: 'https://teeuwenbouw.test/vacatures', datum: dagenTerug(3) }],
  dossierOp: dagenTerug(1), ...x,
})
const bewijs = (...o: ('ja' | 'nee' | 'onbekend')[]): Bewijs[] => o.map((oordeel, i) => ({ criterium: (['klasse', 'branche', 'werkgebied', 'aanleiding', 'groei', 'bereikbaar'] as const)[i]!, oordeel, zin: 'x', bron: 'kvk' }))

describe('klasse en beoordeling', () => {
  it('klasse uit de klassen van de organisatie, niet uit een vaste standaard; zonder medewerkers null', () => {
    expect(klasseUitMedewerkers(60, VOLTVAST)).toBe('kl-b-prospects')
    expect(klasseUitMedewerkers(300, VOLTVAST)).toBe('kl-a-prospects')
    expect(klasseUitMedewerkers(5, VOLTVAST)).toBe(null)
    expect(klasseUitMedewerkers(null, VOLTVAST)).toBe(null)
    expect(klasseUitMedewerkers(49, [])).toBe('C')
    expect(klasseUitMedewerkers(50, [])).toBe('B')
  })
  it('zes oordelen met bewijs; alles ja geeft 6/6', () => {
    const r = beoordeelLead(lead(), { klassen: ['B'], sbi: ['4321'], werkgebied: { straal: { lat: 52.5, lng: 6.1, km: 50 } }, aanleiding: 'werft servicemonteurs' }, VOLTVAST, nu)
    expect(r.bewijs.map((b) => b.criterium)).toEqual(['klasse', 'branche', 'werkgebied', 'aanleiding', 'groei', 'bereikbaar'])
    expect(r.score).toBe(6)
    expect(r.bewijs.find((b) => b.criterium === 'aanleiding')!.url).toBe('https://teeuwenbouw.test/vacatures')
  })
  it('werkgebied buiten de straal geeft nee met bewijsregel (gat 46)', () => {
    const r = beoordeelLead(lead({ lat: 53.21, lng: 6.56 }), { werkgebied: { straal: { lat: 52.09, lng: 5.12, km: 50 } } }, VOLTVAST, nu)
    const w = r.bewijs.find((b) => b.criterium === 'werkgebied')!
    expect(w.oordeel).toBe('nee')
    expect(w.zin).toMatch(/km van je thuisbasis; je straal is 50 km/)
  })
  it('postcodegebied: binnen ja, buiten nee', () => {
    expect(beoordeelLead(lead(), { werkgebied: { postcodes: ['80'] } }, VOLTVAST, nu).bewijs[2]!.oordeel).toBe('ja')
    expect(beoordeelLead(lead(), { werkgebied: { postcodes: ['35'] } }, VOLTVAST, nu).bewijs[2]!.oordeel).toBe('nee')
  })
  it('onbekend is geen nee: zonder medewerkers, SBI, adres en dossier', () => {
    const r = beoordeelLead({ naam: 'Leeg BV' }, { klassen: ['B'], sbi: ['4321'], werkgebied: { postcodes: ['80'] }, aanleiding: 'werft monteurs' }, VOLTVAST, nu)
    expect(r.bewijs.every((b) => b.oordeel === 'onbekend')).toBe(true)
    expect(r.beoordeeld).toBe(0)
  })
  it('verkeerde klasse en branche geven nee', () => {
    const r = beoordeelLead(lead({ medewerkers: 400, sbi: ['6820'] }), { klassen: ['B', 'C'], sbi: ['4321', '4322'] }, VOLTVAST, nu)
    expect(r.bewijs[0]!.oordeel).toBe('nee')
    expect(r.bewijs[1]!.oordeel).toBe('nee')
  })
  it('bewijs ouder dan 120 dagen vervalt; precies 120 telt nog', () => {
    const z = { aanleiding: 'werft servicemonteurs' }
    expect(beoordeelLead(lead({ dossierOp: dagenTerug(120), zinnen: [{ tekst: 'Werft servicemonteurs.', bron: 'web', datum: dagenTerug(120) }] }), z, VOLTVAST, nu).bewijs[3]!.oordeel).toBe('ja')
    expect(beoordeelLead(lead({ dossierOp: dagenTerug(121), zinnen: [{ tekst: 'Werft servicemonteurs.', bron: 'web', datum: dagenTerug(121) }] }), z, VOLTVAST, nu).bewijs[3]!.oordeel).toBe('onbekend')
  })
  it('een e-mail als aanname telt niet voor bereikbaarheid', () => {
    const r = beoordeelLead(lead({ contacten: [{ naam: 'Peter Kok', functie: 'eigenaar', email: 'peter@teeuwenbouw.test', aanname: true, bron: 'web' }] }), {}, VOLTVAST, nu)
    expect(r.bewijs[5]!.oordeel).toBe('onbekend')
  })
})

describe('groepen', () => {
  it('eerste treffer wint: al bekend gaat voor valt af', () => {
    expect(groepeerLead({ alBekend: true, bewijs: bewijs('nee') }, nu)).toBe('alBekend')
    expect(groepeerLead({ bewijs: bewijs('nee', 'ja', 'ja', 'ja'), dossierOp: dagenTerug(40) }, nu)).toBe('valtAf')
  })
  it('verlopen na 30 dagen; precies 30 dagen nog niet', () => {
    expect(groepeerLead({ bewijs: bewijs('ja', 'ja', 'ja', 'ja'), dossierOp: dagenTerug(30) }, nu)).toBe('passend')
    expect(groepeerLead({ bewijs: bewijs('ja', 'ja', 'ja', 'ja'), dossierOp: dagenTerug(31) }, nu)).toBe('verlopen')
  })
  it('3 keer ja met 3 beoordeeld blijft "Nog niet te beoordelen"; 3 ja met 4 beoordeeld is passend', () => {
    expect(groepeerLead({ bewijs: bewijs('ja', 'ja', 'ja', 'onbekend', 'onbekend', 'onbekend') }, nu)).toBe('onbeoordeeld')
    expect(groepeerLead({ bewijs: bewijs('ja', 'ja', 'ja', 'ja', 'onbekend', 'onbekend') }, nu)).toBe('passend')
  })
  it('dossierlabel: vandaag, oranje na 30 dagen', () => {
    expect(dossierLabel(nu.toISOString(), nu)).toEqual({ tekst: 'Dossier van vandaag', oranje: false })
    expect(dossierLabel(dagenTerug(31), nu)!.oranje).toBe(true)
    expect(dossierLabel(null, nu)).toBe(null)
  })
})

describe('ontdubbelen', () => {
  const bestand = [{ id: 'a1', name: 'Installatiebedrijf Teeuwen', kvk: '91000001', domein: 'teeuwen.test', postcode: '8011 AB' }]
  it('KvK gelijk, dan domein, dan naam plus postcode met 80 procent (60 tot 80 mogelijk)', () => {
    expect(zoekDuplicaat({ name: 'Iets anders', kvk: '91000001' }, bestand).op).toBe('kvk')
    expect(zoekDuplicaat({ name: 'Iets anders', domein: 'www.teeuwen.test' }, bestand).op).toBe('domein')
    expect(zoekDuplicaat({ name: 'Installatiebedrijf Teeuwen BV', postcode: '8011AB' }, bestand).soort).toBe('zeker')
    expect(zoekDuplicaat({ name: 'Installatie Teeuw', postcode: '8011 AB' }, bestand).soort).toBe('mogelijk')
    expect(zoekDuplicaat({ name: 'Bakkerij De Korf', postcode: '8011 AB' }, bestand).soort).toBe('geen')
  })
  it('leadsleutels voor afgewezen bedrijven', () => {
    expect(leadSleutels({ naam: 'Teeuwen Bouw B.V.', kvk: '9100 0001', website: 'https://www.teeuwenbouw.test/', postcode: '8011 ab' })).toEqual(['kvk:91000001', 'dom:teeuwenbouw.test', 'naam:teeuwen bouw|8011AB'])
  })
})

describe('zoekopdracht, branche en sjablonen', () => {
  it('hash: volgorde van bronnen en SBI maakt niet uit', () => {
    const a = zoekopdrachtHash({ sbi: ['4321', '4322'], klassen: ['B', 'C'] }, ['kvk', 'ai'])
    expect(zoekopdrachtHash({ sbi: ['4322', '4321'], klassen: ['C', 'B'] }, ['ai', 'kvk'])).toBe(a)
    expect(zoekopdrachtHash({ sbi: ['4321'], klassen: ['B', 'C'] }, ['kvk', 'ai'])).not.toBe(a)
  })
  it('SBI 4321 bij br-01, br-02 en br-04: het trefwoord zonnepanelen beslist; 6820 is br-03; geen mapping null', () => {
    expect(brancheUitSbi(['4321'], MAPPING)).toBe('br-01')
    expect(brancheUitSbi(['4321'], MAPPING, 'Wij leggen zonnepanelen op daken')).toBe('br-04')
    expect(brancheUitSbi(['6820'], MAPPING)).toBe('br-03')
    expect(brancheUitSbi(['4321'], [])).toBe(null)
    expect(brancheUitSbi([], MAPPING)).toBe(null)
  })
  it('zoeksjabloon per concurrent van soort Direct', () => {
    const s = zoeksjablonen([{ id: 'cc-01', naam: 'Landelijke groothandelsketen', soort: 'Direct' }, { id: 'cc-03', naam: 'Installateur koopt zelf', soort: 'Indirect' }])
    expect(s.map((x) => x.naam)).toEqual(['Overstappers van Landelijke groothandelsketen'])
  })
  it('"Lijkt op mijn klanten" telt alleen klanten, nooit prospects (gat 46); zonder klanten leeg', () => {
    const r = leidZoekopdrachtAf([
      { accountKind: 'klant', sbi: ['4321'], postcode: '8011 AB' }, { accountKind: 'klant', sbi: ['4321', '4322'], postcode: '8012 CD' },
      { accountKind: 'prospect', sbi: ['6820', '6820', '6820'], postcode: '1011 AA' }, { accountKind: 'klant', sbi: ['4322'], postcode: '9711 AA' },
    ])
    expect(r).toEqual({ sbi: [{ code: '4321', aantal: 2 }, { code: '4322', aantal: 2 }], postcodes: ['80', '97'], aantalKlanten: 3 })
    expect(leidZoekopdrachtAf([{ accountKind: 'prospect', sbi: ['4321'] }])).toEqual({ sbi: [], postcodes: [], aantalKlanten: 0 })
  })
})

describe('grenzen', () => {
  const stand = (verbruikt: number) => creditsStand({ pakket: 'compleet', gebruikers: 1, verbruikt })
  const kvk = { gekoppeld: true, gebruikt: 0, plafond: 2000 }
  it('tiende ronde mag, elfde niet', () => {
    expect(magRonde({ rondesVandaag: 9, stand: stand(0), kvk }, 'compleet', ['kvk']).mag).toBe(true)
    expect(magRonde({ rondesVandaag: GRENZEN.rondesPerDag, stand: stand(0), kvk }, 'compleet', ['kvk'])).toEqual({ mag: false, status: 429, reden: DAGGRENS_TEKST })
  })
  it('minder dan 20 credits over geeft 402; precies 20 mag', () => {
    expect(magRonde({ rondesVandaag: 0, stand: stand(1481), kvk }, 'compleet', ['ai']).status).toBe(402)
    expect(magRonde({ rondesVandaag: 0, stand: stand(1480), kvk }, 'compleet', ['ai']).mag).toBe(true)
  })
  it('de AI-zoeker staat niet aan op Plus; KvK zonder sleutel is niet kiesbaar; plafond bereikt', () => {
    expect(magRonde({ rondesVandaag: 0, stand: stand(0), kvk }, 'plus', ['ai']).status).toBe(403)
    expect(magRonde({ rondesVandaag: 0, stand: stand(0), kvk }, 'plus', ['kvk']).mag).toBe(true)
    expect(magRonde({ rondesVandaag: 0, stand: stand(0), kvk: { ...kvk, gekoppeld: false } }, 'compleet', ['kvk']).status).toBe(400)
    expect(magRonde({ rondesVandaag: 0, stand: stand(0), kvk: { ...kvk, gebruikt: 2000 } }, 'compleet', ['kvk']).status).toBe(429)
  })
  it('afwijzen stuurt de volgende ronde bij', () => {
    const b = bijsturing([{ reden: 'Te klein', medewerkers: 4 }, { reden: 'Te klein', medewerkers: 8 }, { reden: 'Buiten gebied', plaats: 'Emmen' }])
    expect(b.maxTeKlein).toBe(8)
    expect(pastNaBijsturing({ medewerkers: 8 }, b)).toBe(false)
    expect(pastNaBijsturing({ medewerkers: 9 }, b)).toBe(true)
    expect(pastNaBijsturing({ plaats: 'Emmen' }, b)).toBe(true)
  })
})

describe('bewijsplicht van de Zoeker', () => {
  it('alleen URL\'s uit de echte zoekresultaten; een verzonnen URL valt weg', () => {
    const r = alleenEchteUrls([{ naam: 'A', url: 'https://a.test/' }, { naam: 'B', url: 'https://verzonnen.test' }, { naam: 'C', url: null }], [{ url: 'https://a.test' }])
    expect(r.map((x) => x.naam)).toEqual(['A'])
  })
  it('geen bewijs zonder letterlijk citaat', () => {
    const m = [{ url: 'https://a.test', tekst: 'Wij zoeken twee servicemonteurs voor onze vestiging in Zwolle.' }]
    const b: Bewijs[] = [
      { criterium: 'groei', oordeel: 'ja', zin: 'zoeken twee servicemonteurs', bron: 'web', url: 'https://a.test' },
      { criterium: 'aanleiding', oordeel: 'ja', zin: 'opent een nieuwe vestiging in Assen', bron: 'web', url: 'https://a.test' },
      { criterium: 'groei', oordeel: 'ja', zin: 'zoeken twee servicemonteurs', bron: 'web', url: 'https://ander.test' },
    ]
    expect(controleerBewijs(b, m).map((x) => x.criterium)).toEqual(['groei'])
  })
  it('een nummer dat niet op de bron staat wordt niet ingevuld', () => {
    const c = controleerContacten([
      { naam: 'Peter Kok', functie: 'eigenaar', telefoon: '+31381234567', email: 'peter@kok.test', bron: 'web' },
      { naam: 'Jan Verzonnen', functie: 'inkoper', telefoon: '+31201112233', bron: 'web' },
    ], 'Peter Kok, eigenaar. Bel 038 123 4567.')
    expect(c).toEqual([{ naam: 'Peter Kok', functie: 'eigenaar', telefoon: '+31381234567', email: null, bron: 'web' }])
  })
})
