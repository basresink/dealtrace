// P15: Datacollectief als vijfde bron. Selectie uit een doelgroep, record naar lead met herkomst,
// contacten samenvoegen (15.1), bronprioriteit (10.1), plafondstand en de poort voor een ronde.
import { describe, expect, it } from 'vitest'
import { magOverschrijven } from '../../shared/herkomst'
import { DC_NIET_GEKOPPELD, DC_PLAFOND_TEKST, datacollectiefNaarLead, magRonde, plafondStand, priveEmail, selectieUitDoelgroep } from '../../shared/leadGenerator'
import { voegContactenSamen } from '../../shared/ontdubbelen'
import { DC_MOCK } from '../../server/utils/bronnen/datacollectiefMock'

const MAPPING = [{ brancheId: 'br-01', sbiCodes: ['4321', '4322'], trefwoorden: [] }, { brancheId: 'br-02', sbiCodes: ['4321', '4322'], trefwoorden: [] }, { brancheId: 'br-04', sbiCodes: [], trefwoorden: ['zonnepanelen'] }]
const OP = '2026-10-14T09:00:00.000Z'

describe('selectieUitDoelgroep', () => {
  it('branche br-01 en br-02 naar 4321 en 4322 (Bijlage C); regio uit postcodes', () => {
    const s = selectieUitDoelgroep({ brancheId: 'br-01', postcodes: ['8011 AB', '9723'] }, MAPPING)
    expect(s).toMatchObject({ sbi: ['4321', '4322'], regio: ['80', '97'], melding: null })
    expect(s.functieniveaus).toEqual(['eigenaar', 'directie', 'management'])
  })
  it('eigen SBI gaat voor; branche zonder mapping en doelgroep zonder branche geven een melding', () => {
    expect(selectieUitDoelgroep({ sbi: ['4120'], brancheId: 'br-01' }, MAPPING).sbi).toEqual(['4120'])
    expect(selectieUitDoelgroep({ brancheId: 'br-04' }, MAPPING)).toMatchObject({ sbi: [], trefwoorden: ['zonnepanelen'], melding: expect.stringContaining('geen SBI-koppeling') })
    expect(selectieUitDoelgroep({}, MAPPING).melding).toContain('breed')
  })
})

describe('datacollectiefNaarLead', () => {
  it('elk gevuld veld krijgt herkomst datacollectief met datum; contacten met bron', () => {
    const l = datacollectiefNaarLead(DC_MOCK[0]!, OP)
    expect(l).toMatchObject({ naam: 'Installatiebedrijf Hoekstra Techniek', kvk: '92000001', domein: 'hoekstratechniek.test', medewerkers: 28, sbi: ['4321'] })
    expect(l.herkomst).toMatchObject({ naam: { bron: 'datacollectief', op: OP }, kvk: { bron: 'datacollectief', op: OP }, medewerkers: { bron: 'datacollectief', op: OP } })
    expect(l.contacten).toEqual([
      { naam: 'Jelle Testhoekstra', functie: 'Eigenaar', email: 'jelle@hoekstratechniek.test', telefoon: '06 4000 0011', linkedin: null, bron: 'datacollectief' },
      { naam: 'Anke Proefstra', functie: 'Projectleider', email: 'anke@hoekstratechniek.test', telefoon: '058 400 0012', linkedin: null, bron: 'datacollectief' },
    ])
  })
  it('nooit privégegevens: een privé contact valt weg, een privé-ogend adres ook; zonder e-mail blijft het contact', () => {
    expect(priveEmail('ilse.prive@gmail.test')).toBe(true)
    expect(datacollectiefNaarLead(DC_MOCK[2]!, OP).contacten!.find((c) => c.naam === 'Ilse Privéproef')!.email).toBeNull()
    expect(datacollectiefNaarLead(DC_MOCK[3]!, OP).contacten!.map((c) => c.naam)).toEqual(['Tim Testoost'])
    expect(datacollectiefNaarLead(DC_MOCK[6]!, OP).contacten![0]).toMatchObject({ naam: 'Kees Proefdrent', email: null })
  })
  it('record zonder KvK: geen kvk-herkomst', () => {
    const l = datacollectiefNaarLead({ ...DC_MOCK[4]!, kvk: null }, OP)
    expect(l.kvk).toBeNull()
    expect(l.herkomst!.kvk).toBeUndefined()
  })
})

describe('voegContactenSamen', () => {
  const bestaand = [{ id: 'c1', accountId: 'a1', firstName: 'Frank', lastName: 'Teststroom', email: 'frank@stroomdal.test', telefoon: null, functie: null }, { id: 'c2', accountId: 'a1', firstName: 'Noor', lastName: 'Proefdal', email: null, telefoon: '+31522400092', functie: 'Werkvoorbereider' }]
  it('exacte e-mail wint; anders volledige naam; nieuw wordt toegevoegd; dubbel in de nieuwe lijst één keer', () => {
    const r = voegContactenSamen(bestaand, [
      { firstName: 'F.', lastName: 'Anders', email: 'FRANK@stroomdal.test', telefoon: '+31640000091', functie: 'Eigenaar' },
      { firstName: 'Noor', lastName: 'Proefdal', email: 'noor@stroomdal.test' },
      { firstName: 'Lotte', lastName: 'Nieuw', email: 'lotte@stroomdal.test' },
      { firstName: 'Lotte', lastName: 'Nieuw', email: 'lotte@stroomdal.test' },
    ])
    expect(r.bijwerken).toEqual([{ id: 'c1', velden: { telefoon: '+31640000091', functie: 'Eigenaar' } }, { id: 'c2', velden: { email: 'noor@stroomdal.test' } }])
    expect(r.toevoegen.map((c) => c.lastName)).toEqual(['Nieuw'])
    expect(r.overslaan).toHaveLength(1)
  })
  it('niets nieuws: overslaan', () => {
    expect(voegContactenSamen(bestaand, [{ firstName: 'Noor', lastName: 'Proefdal', telefoon: '+31600000000', functie: 'x' }]).overslaan).toHaveLength(1)
  })
})

describe('bronprioriteit en plafond', () => {
  it('Datacollectief overschrijft nooit hand of KvK, wel web, ai en import', () => {
    expect(magOverschrijven('hand', 'datacollectief')).toBe(false)
    expect(magOverschrijven('kvk', 'datacollectief')).toBe(false)
    expect(magOverschrijven('web', 'datacollectief')).toBe(true)
    expect(magOverschrijven('import', 'datacollectief')).toBe(true)
    expect(magOverschrijven(undefined, 'datacollectief')).toBe(true)
  })
  it('plafondStand: waarschuwen vanaf 80 procent, blokkeren op 100; plafond 0 en geen plafond', () => {
    expect(plafondStand(399, 500)).toMatchObject({ rest: 101, waarschuwen: false, geblokkeerd: false })
    expect(plafondStand(400, 500)).toMatchObject({ procent: 80, waarschuwen: true, geblokkeerd: false })
    expect(plafondStand(500, 500)).toMatchObject({ rest: 0, geblokkeerd: true })
    expect(plafondStand(0, 0)).toMatchObject({ geblokkeerd: true, procent: 100 })
    expect(plafondStand(10, null)).toEqual({ rest: null, procent: 0, geblokkeerd: false, waarschuwen: false })
  })
  it('magRonde: pakket, niet gekoppeld en plafond', () => {
    const v = (dc: { gekoppeld: boolean; gebruikt: number; plafond: number }) => ({ rondesVandaag: 0, stand: null, kvk: { gekoppeld: false, gebruikt: 0, plafond: 0 }, dc })
    expect(magRonde(v({ gekoppeld: true, gebruikt: 0, plafond: 500 }), 'plus', ['datacollectief'])).toMatchObject({ mag: false, status: 403 })
    expect(magRonde(v({ gekoppeld: false, gebruikt: 0, plafond: 500 }), 'compleet', ['datacollectief'])).toEqual({ mag: false, status: 400, reden: DC_NIET_GEKOPPELD })
    expect(magRonde(v({ gekoppeld: true, gebruikt: 500, plafond: 500 }), 'compleet', ['datacollectief'])).toEqual({ mag: false, status: 429, reden: DC_PLAFOND_TEKST })
    expect(magRonde(v({ gekoppeld: true, gebruikt: 10, plafond: 500 }), 'compleet', ['datacollectief'])).toEqual({ mag: true })
  })
  it('fixtures zijn fictief: KvK-nummers en websites verzonnen, e-mail op .test', () => {
    for (const r of DC_MOCK) {
      expect(r.website).toMatch(/\.test$/)
      for (const c of r.contacten) if (c.email) expect(c.email).toMatch(/\.test$/)
    }
  })
})
