import { describe, expect, it } from 'vitest'
import { filterTellers, pasFiltersToe, filtersNaarQuery, filtersUitQuery, sorteer, type AccountRij } from '../../shared/accountFilters'
import { belNummer, normaliseerTelefoon, ontbrekendeRollen, primairContact } from '../../shared/contactgegevens'
import { sleutelUitNaam, typeWisselAfwijkend, valideerWaarde, veldenVoorNiveau } from '../../shared/eigenVelden'
import { contactDuplicaat, dice, normaliseerNaam, zoekDuplicaat } from '../../shared/ontdubbelen'
import { berekenScore, laatsteContact, telOpenTaken } from '../../shared/score'

const NU = new Date('2026-10-15T12:00:00Z')
const terug = (d: number) => new Date(NU.getTime() - d * 864e5).toISOString()

describe('score', () => {
  it('een leeg account krijgt geen 50, maar 0 met opbouw', () => {
    const s = berekenScore({ nu: NU, contacten: [], laatsteContactOp: null })
    expect(s.score).toBe(0)
    expect(Object.keys(s.opbouw)).toEqual(['aanleiding', 'bereikbaarheid', 'fit', 'momentum', 'recentheid'])
    expect(s.opbouw.fit.geenGegevens).toBe(true)
  })
  it('elk onderdeel op zijn maximum is 100, nooit meer', () => {
    const s = berekenScore({ nu: NU, aanleidingen: [{ op: terug(1), heet: true }], contacten: [{ rol: 'beslisser', status: 'actief', telefoon: '+31612345678', email: 'a@b.nl' }], fit: { passend: 5, totaal: 5 }, momentum: { positieveUitkomsten30d: 9, afspraakGepland: true }, laatsteContactOp: terug(2) })
    expect(s.score).toBe(100)
  })
})

describe('laatste contact en open taken', () => {
  it('open taken, toekomstige afspraken en import tellen niet', () => {
    expect(laatsteContact([
      { soort: 'gebeld', op: terug(10) }, { soort: 'afspraak', op: terug(-3), status: 'gepland' }, { soort: 'bel', op: terug(1), status: 'open' },
      { soort: 'mail', op: terug(2), bron: 'import' }, { soort: 'notitie', op: terug(0) },
    ], NU)).toBe(terug(10))
    expect(laatsteContact([], NU)).toBeNull()
  })
  it('telOpenTaken: zelfde regel voor account en contact', () => {
    const taken = [{ status: 'open', accountId: 'a', contactId: 'c' }, { status: 'open', accountId: 'a', contactId: null }, { status: 'afgerond', accountId: 'a', contactId: 'c' }]
    expect(telOpenTaken(taken, { accountId: 'a' })).toBe(2)
    expect(telOpenTaken(taken, { contactId: 'c' })).toBe(1)
  })
})

describe('contacten', () => {
  it('primair contact: beslisser, dan champion, dan met telefoon, dan de eerste; vertrokken telt niet', () => {
    expect(primairContact([{ id: '1', rol: 'gebruiker', status: 'actief' }, { id: '2', rol: 'beslisser', status: 'vertrokken' }, { id: '3', rol: 'champion', status: 'actief' }])?.id).toBe('3')
    expect(primairContact([{ id: '1', rol: 'gebruiker', status: 'actief' }, { id: '2', rol: 'onbekend', status: 'actief', telefoon: '+31612345678' }])?.id).toBe('2')
    expect(primairContact([{ id: '1', rol: 'beslisser', status: 'vertrokken' }])).toBeNull()
  })
  it('ontbrekende rollen: vertrokken telt niet', () => {
    expect(ontbrekendeRollen([{ id: '1', rol: 'beslisser', status: 'vertrokken' }, { id: '2', rol: 'champion', status: 'actief' }])).toContain('beslisser')
  })
  it('telefoon naar E.164', () => {
    expect(normaliseerTelefoon('06 1234 5678')).toEqual({ ok: true, e164: '+31612345678' })
    expect(normaliseerTelefoon('0031 30 123 4567')).toEqual({ ok: true, e164: '+31301234567' })
    expect(normaliseerTelefoon('+31 6 12345678')).toEqual({ ok: true, e164: '+31612345678' })
    expect(normaliseerTelefoon('12345').ok).toBe(false)
  })
  it('bel me niet: geen nummer, met reden', () => {
    expect(belNummer({ id: '1', rol: 'beslisser', status: 'actief', mobiel: '+31612345678', belMeNiet: true })).toEqual({ nummer: null, reden: 'Bel me niet' })
    expect(belNummer({ id: '1', rol: 'beslisser', status: 'actief', mobiel: '+31612345678' }, new Set(['+31612345678'])).nummer).toBeNull()
  })
})

describe('ontdubbelen', () => {
  const bestand = [{ id: 'a', name: 'Teeuwen Bouw B.V.', kvk: '12345678', domein: 'teeuwen.nl', city: 'Houten' }]
  it('KvK gelijk is altijd een duplicaat', () => expect(zoekDuplicaat({ name: 'Iets anders', kvk: '12345678' }, bestand)).toMatchObject({ soort: 'zeker', op: 'kvk' }))
  it('domein zonder www. en hoofdletters', () => expect(zoekDuplicaat({ name: 'X', domein: 'https://WWW.Teeuwen.nl/contact' }, bestand)).toMatchObject({ soort: 'zeker', op: 'domein' }))
  it('naam zonder B.V. en Holding', () => {
    expect(normaliseerNaam('Teeuwen Bouw Holding B.V.')).toBe('teeuwen bouw')
    expect(zoekDuplicaat({ name: 'Teeuwen Bouw' }, bestand)).toMatchObject({ soort: 'zeker', op: 'naam' })
  })
  it('grenzen 60 en 80 procent', () => {
    const d = dice('teeuwen bouw', 'teeuwen bouwgroep')
    expect(d).toBeGreaterThan(0.6)
    expect(zoekDuplicaat({ name: 'Volkomen Anders Installaties' }, bestand).soort).toBe('geen')
  })
  it('contact: e-mail hoofdletterongevoelig; zelfde naam bij ander bedrijf is geen duplicaat', () => {
    const b = [{ id: 'c1', accountId: 'a', firstName: 'Jan', lastName: 'Jansen', email: 'Jan@X.nl' }]
    expect(contactDuplicaat({ accountId: 'b', lastName: 'Ander', email: 'jan@x.nl' }, b)?.id).toBe('c1')
    expect(contactDuplicaat({ accountId: 'b', firstName: 'Jan', lastName: 'Jansen' }, b)).toBeNull()
    expect(contactDuplicaat({ accountId: 'a', firstName: 'jan', lastName: 'JANSEN' }, b)?.id).toBe('c1')
  })
})

describe('eigen velden', () => {
  it('valideert per type', () => {
    expect(valideerWaarde({ naam: 'N', type: 'getal', data: {} }, '12,5')).toEqual({ ok: true, waarde: 12.5 })
    expect(valideerWaarde({ naam: 'N', type: 'keuzelijst', data: { opties: [{ waarde: 'a', label: 'A' }] } }, 'b').ok).toBe(false)
    expect(valideerWaarde({ naam: 'N', type: 'janee', data: {} }, 'ja')).toEqual({ ok: true, waarde: true })
    expect(valideerWaarde({ naam: 'N', type: 'datum', data: {} }, '2026-13-40').ok).toBe(false)
    expect(valideerWaarde({ naam: 'N', type: 'tekst', data: {} }, null)).toEqual({ ok: true, waarde: null })
  })
  it('zichtbaar per niveau; gearchiveerd nooit', () => {
    const v = [{ data: { zichtbaarVanaf: 'gevorderd' as const } }, { data: {} }, { data: {}, gearchiveerd: true }]
    expect(veldenVoorNiveau(v, 'beginner')).toHaveLength(1)
    expect(veldenVoorNiveau(v, 'gevorderd')).toHaveLength(2)
  })
  it('sleutel uit naam: accenten en dubbele namen', () => {
    expect(sleutelUitNaam('Aantal monteurs')).toBe('aantal_monteurs')
    expect(sleutelUitNaam('Één café', ['een_cafe'])).toBe('een_cafe_2')
    expect(sleutelUitNaam('123')).toBe('veld_123')
  })
  it('typewissel geeft de afwijkende records', () => {
    expect(typeWisselAfwijkend({ naam: 'N', type: 'getal', data: {} }, [{ id: 'a', waarde: '12' }, { id: 'b', waarde: 'veel' }])).toEqual(['b'])
  })
})

describe('filters en tellers', () => {
  const rij = (id: string, p: Partial<AccountRij>): AccountRij => ({ id, name: id, klasse: null, ownerId: 'u', nbStatus: 'nieuw', score: 0, laatsteContactOp: null, contacten: [], cf: {}, ...p })
  const rijen = [
    rij('a', { klasse: 'A', contacten: [{ rol: 'beslisser', status: 'actief', telefoon: '+316' }] }),
    rij('b', { klasse: 'B' }),
    rij('c', { klasse: 'A', nbStatus: 'in reis', cf: { segment: 'x' } }),
    rij('d', { ownerId: 'ander' }),
  ]
  const ctx = { gebruikerId: 'u', teamIds: [], nu: NU }
  it('teller is gelijk aan het resultaat na klikken, ook in combinatie', () => {
    const f = filtersUitQuery({ klasse: 'A' })
    const t = filterTellers(rijen, f, ctx, { bereikbaarheid: ['zonderBeslisser'], status: ['nieuw', 'in reis'], klasse: ['A', 'B', 'geen'] })
    expect(t.bereikbaarheid!.zonderBeslisser).toBe(pasFiltersToe(rijen, { ...f, bereikbaarheid: ['zonderBeslisser'] }, ctx).length)
    expect(t.status!['in reis']).toBe(1)
    expect(t.klasse!.B).toBe(1)
  })
  it('"Van mij" staat standaard aan', () => {
    expect(pasFiltersToe(rijen, filtersUitQuery({}), ctx).map((r) => r.id)).not.toContain('d')
    expect(pasFiltersToe(rijen, filtersUitQuery({ eigenaar: 'iedereen' }), ctx)).toHaveLength(4)
  })
  it('filters overleven de URL', () => {
    const f = filtersUitQuery({ klasse: 'A,B', 'cf.segment': 'x', eigenaar: 'team' })
    expect(filtersUitQuery(filtersNaarQuery(f))).toEqual(f)
  })
  it('sortering op naam en score', () => {
    expect(sorteer([rij('b', { score: 1 }), rij('a', { score: 9 })], 'naam').map((r) => r.id)).toEqual(['a', 'b'])
    expect(sorteer([rij('b', { score: 1 }), rij('a', { score: 9 })], 'score').map((r) => r.id)).toEqual(['a', 'b'])
  })
})
