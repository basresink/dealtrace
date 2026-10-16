// P20: veldtoewijzing, conflictregel, eigenaarsregel, CRM naar lead, slapende klanten, schrijfplan en overdracht.
import { describe, expect, it } from 'vitest'
import { crmNaarLead, eigenaarVoor, isSlapend, losConflictOp, naarCenten, overdrachtNaarCrm, pasToewijzingToe, schrijfplan, TOEWIJZING_STANDAARD, toewijzingFouten } from '../../shared/crm'
import { magRonde } from '../../shared/leadGenerator'

const op = '2026-10-15T10:00:00.000Z'
describe('pasToewijzingToe', () => {
  it('lege CRM-waarde wordt niet gewist; onbekend veld genegeerd; domein schoon; lifecycle naar soort', () => {
    const r = pasToewijzingToe({ name: 'Testklant Warmtewerk', phone: '', domain: 'https://www.warmtewerk.test/contact', lifecyclestage: 'customer', numberofemployees: '24' }, [...TOEWIJZING_STANDAARD.bedrijven, { crmVeld: 'x', veld: 'bestaatNiet' }], 'bedrijven', op)
    expect(r.velden).toEqual({ naam: 'Testklant Warmtewerk', domein: 'warmtewerk.test', soort: 'klant', medewerkers: 24 })
    expect(r.herkomst.naam).toEqual({ bron: 'crm', op })
    expect('telefoon' in r.velden).toBe(false)
  })
  it('geld naar centen; een eigen veld als cf:', () => {
    expect(naarCenten('1.250,50')).toBe(125050)
    expect(naarCenten(12.5)).toBe(1250)
    expect(naarCenten('')).toBeUndefined()
    expect(pasToewijzingToe({ omzet: '1000', monteurs: 12 }, [{ crmVeld: 'omzet', veld: 'omzet' }, { crmVeld: 'monteurs', veld: 'cf:aantal_monteurs' }], 'bedrijven', op).velden).toEqual({ omzet: 100000, 'cf:aantal_monteurs': 12 })
  })
  it('toewijzingFouten: onbekend Dealtrace-veld, eigen veld alleen als het bestaat', () => {
    expect(toewijzingFouten('bedrijven', [{ crmVeld: 'a', veld: 'naam' }, { crmVeld: 'b', veld: 'cf:monteurs' }], ['monteurs'])).toEqual([])
    expect(toewijzingFouten('bedrijven', [{ crmVeld: 'b', veld: 'cf:onbekend' }, { crmVeld: 'c', veld: 'deal' }])).toHaveLength(2)
  })
})

describe('losConflictOp', () => {
  const patch = { velden: { telefoon: '010 1', naam: 'Nieuw', plaats: 'Zwolle', kvk: '1' }, herkomst: { telefoon: { bron: 'crm', op }, naam: { bron: 'crm', op }, plaats: { bron: 'crm', op }, kvk: { bron: 'crm', op } } }
  it('hand wint; hogere bron wint; ontbrekende herkomst telt als import; leeg wordt gevuld', () => {
    const r = losConflictOp({
      telefoon: { waarde: '06 2', herkomst: { bron: 'hand', op } }, naam: { waarde: 'Oud', herkomst: { bron: 'kvk', op } },
      plaats: { waarde: 'Deventer', herkomst: null }, kvk: { waarde: null },
    }, patch)
    expect(r.toepassen).toEqual({ plaats: 'Zwolle', kvk: '1' })
    expect(r.afgewezen.map((a) => a.veld)).toEqual(['telefoon', 'naam'])
  })
  it('gelijke bron: de nieuwste wint', () => {
    expect(losConflictOp({ naam: { waarde: 'Oud', herkomst: { bron: 'crm', op: '2026-01-01' } } }, patch).toepassen).toEqual({ naam: 'Nieuw', telefoon: '010 1', plaats: 'Zwolle', kvk: '1' })
    expect(losConflictOp({ naam: { waarde: 'Oud', herkomst: { bron: 'crm', op: '2027-01-01' } } }, patch).afgewezen.map((a) => a.veld)).toEqual(['naam'])
  })
})

describe('eigenaarVoor', () => {
  const g = [{ id: 'u-01', email: 'anouk@voltvast.test' }, { id: 'u-03', email: 'Sanne@Voltvast.test' }]
  it('zonder hoofdlettergevoeligheid; onbekend valt terug', () => {
    expect(eigenaarVoor('SANNE@voltvast.test', g, 'u-04')).toEqual({ id: 'u-03', gevonden: true })
    expect(eigenaarVoor('nieuw@voltvast.test', g, 'u-04')).toEqual({ id: 'u-04', gevonden: false })
    expect(eigenaarVoor(null, g, null)).toEqual({ id: null, gevonden: false })
  })
})

describe('crmNaarLead', () => {
  it('leadstructuur zonder KvK, met het eerste domein en contacten', () => {
    const f = crmNaarLead({ id: 'hs-1', velden: { name: 'Testprospect Gasvast', domain: 'gasvast.test; gasvast-oud.test', city: 'Apeldoorn' } },
      [{ id: 'c1', bedrijfId: 'hs-1', velden: { firstname: 'Gijs', lastname: 'Testgas', jobtitle: 'Directeur' } }, { id: 'c2', bedrijfId: 'hs-2', velden: { lastname: 'Ander' } }], TOEWIJZING_STANDAARD, op)
    expect(f).toMatchObject({ naam: 'Testprospect Gasvast', kvk: null, domein: 'gasvast.test', website: 'https://gasvast.test', plaats: 'Apeldoorn' })
    expect(f.contacten).toEqual([expect.objectContaining({ naam: 'Gijs Testgas', functie: 'Directeur', bron: 'crm' })])
    expect(f.herkomst?.naam).toEqual({ bron: 'crm', op })
  })
})

describe('isSlapend', () => {
  const nu = new Date('2026-10-15T10:00:00Z')
  it('grens op de dag; zonder datum niet', () => {
    expect(isSlapend('2026-04-15', nu, 6)).toBe(false)
    expect(isSlapend('2026-04-14', nu, 6)).toBe(true)
    expect(isSlapend('2026-07-14', nu, 3)).toBe(true)
    expect(isSlapend(null, nu, 12)).toBe(false)
  })
})

describe('schrijfplan', () => {
  const ev = [
    { soort: 'activiteit' as const, id: 'x1', accountId: 'a1', externBedrijf: 'hs-1' },
    { soort: 'contact' as const, id: 'c1', accountId: 'a2' },
    { soort: 'bedrijf' as const, id: 'a2', accountId: 'a2' },
    { soort: 'bedrijf' as const, id: 'a2', accountId: 'a2' },
    { soort: 'bedrijf' as const, id: 'a3', accountId: 'a3', extern: 'hs-3' },
    { soort: 'contact' as const, id: 'c9', accountId: 'a9' },
  ]
  it('Lezen geeft niets', () => expect(schrijfplan(ev, { bedrijven: 'lezen', contacten: 'lezen', activiteiten: 'lezen' })).toEqual([]))
  it('Beide: eerst bedrijven, elk één keer; geen record met extern id; geen contact zonder bedrijf', () => {
    expect(schrijfplan(ev, { bedrijven: 'beide', contacten: 'beide', activiteiten: 'schrijven' })).toEqual([
      { soort: 'bedrijf', id: 'a2', accountId: 'a2' }, { soort: 'contact', id: 'c1', accountId: 'a2' }, { soort: 'activiteit', id: 'x1', accountId: 'a1' },
    ])
  })
})

describe('overdrachtNaarCrm', () => {
  const pakket = { overdrachtId: 'ov-1', op, account: { naam: 'Testinstallatie Koperwiek' }, briefing: 'Kort verhaal', vervolgstap: { omschrijving: '', datum: null }, afspraak: { verslag: 'Goed gesprek' } }
  it('een activiteit met vaste sleutel; zonder extern bedrijf eerst het bedrijf; lege vervolgstap', () => {
    const r = overdrachtNaarCrm(pakket, { bedrijfExtern: null, eigenaarEmail: 'joost@voltvast.test' })
    expect(r.activiteit.sleutel).toBe('dealtrace-overdracht:ov-1')
    expect(r.activiteit.tekst).toContain('Vervolgstap: nog niet vastgelegd')
    expect(r).toMatchObject({ eerstBedrijf: true, bedrijf: { eigenaar: 'joost@voltvast.test' } })
    expect(overdrachtNaarCrm(pakket, { bedrijfExtern: 'hs-1' }).activiteit.sleutel).toBe(r.activiteit.sleutel)
    expect(() => overdrachtNaarCrm({}, { bedrijfExtern: null })).toThrow()
  })
})

describe('magRonde met de bron CRM', () => {
  const v = { rondesVandaag: 0, stand: null, kvk: { gekoppeld: false, gebruikt: 0, plafond: 0 } }
  it('zonder koppeling 400, in Starter 403', () => {
    expect(magRonde({ ...v, crm: { gekoppeld: false } }, 'plus', ['crm'])).toMatchObject({ mag: false, status: 400 })
    expect(magRonde({ ...v, crm: { gekoppeld: true } }, 'starter', ['crm'])).toMatchObject({ mag: false, status: 403 })
    expect(magRonde({ ...v, crm: { gekoppeld: true } }, 'plus', ['crm'])).toEqual({ mag: true })
  })
})
