import { describe, expect, it } from 'vitest'
import { leesCsv, schrijfCsv } from '../../shared/csv'
import { dubbelInBestand, importKoppeling, magTerugdraaien, moetControleren, sorensenDice, valideerImportRij } from '../../shared/leadGenerator'
import { normaliseerNaam, zoekDuplicaat } from '../../shared/ontdubbelen'
import { magOverschrijven } from '../../shared/herkomst'

describe('importKoppeling', () => {
  it('herkent kolommen op naam, hoofdletters en spaties maken niet uit', () => {
    expect(importKoppeling(['Bedrijfsnaam', ' KvK-nummer ', 'WOONPLAATS', 'Plaats', 'E-mail', 'Iets anders'])).toEqual(['naam', 'kvk', 'plaats', '', 'contactEmail', ''])
  })
  it('cf: op sleutel en op naam van een eigen veld', () => {
    const v = [{ sleutel: 'aantal_monteurs', naam: 'Aantal monteurs' }, { sleutel: 'segment', naam: 'Segment' }]
    expect(importKoppeling(['cf:aantal_monteurs', 'Segment'], v)).toEqual(['cf:aantal_monteurs', 'cf:segment'])
  })
})

describe('valideerImportRij', () => {
  const k = importKoppeling(['Bedrijfsnaam', 'Postcode', 'Telefoon', 'E-mail', 'Achternaam', 'Aantal monteurs'], [{ sleutel: 'aantal_monteurs', naam: 'Aantal monteurs' }])
  const velden = [{ sleutel: 'aantal_monteurs', naam: 'Aantal monteurs', type: 'getal' as const, data: {} }]
  it('normaliseert postcode zonder spatie en telefoon met +31', () => {
    const r = valideerImportRij(['Test BV', '1234ab', '+31 30 123 4567', 'a@b.test', 'Jansen', '12'], 2, k, velden)
    expect(r.fouten).toEqual([])
    expect(r.account.postcode).toBe('1234 AB')
    expect(r.contact?.telefoon).toBeUndefined()
    expect(r.account.customFields.aantal_monteurs).toBe(12)
  })
  it('fouten in gewone taal; lege naam; eigen veld met verkeerd type', () => {
    const r = valideerImportRij(['', '3512 A', 'abc', 'geen-mail', 'X', 'veel'], 3, k, velden)
    expect(r.fouten.map((f) => f.reden)).toEqual(expect.arrayContaining(['Bedrijfsnaam ontbreekt', 'Postcode 3512 A klopt niet: vier cijfers en twee letters', 'E-mailadres geen-mail klopt niet', 'Aantal monteurs: verwacht een getal']))
  })
  it('vult niets aan dat niet in het bestand staat', () => {
    const r = valideerImportRij(['Test BV', '', '', '', 'Jansen', ''], 2, k, velden)
    expect(r.contact).toEqual({ achternaam: 'Jansen', voornaam: undefined, functie: undefined, telefoon: undefined, mobiel: undefined })
    expect(r.account.customFields).toEqual({})
  })
})

describe('ontdubbelen bij import', () => {
  it('sorensenDice: leeg, één teken, identiek', () => {
    expect(sorensenDice('', '')).toBe(0)
    expect(sorensenDice('a', 'b')).toBe(0)
    expect(sorensenDice('abc', 'abc')).toBe(1)
  })
  it('grenzen 59, 60, 79 en 80 procent (naamregel)', () => {
    // Paren met een berekende gelijkenis rond de grenzen.
    const paren: [string, string][] = [['installatietechniek oost', 'installatietechniek west'], ['jansen installaties', 'jansen installatie zuid'], ['bouwbedrijf de vries', 'bouwbedrijf vries']]
    for (const [a, b] of paren) {
      const g = sorensenDice(a, b)
      const d = zoekDuplicaat({ name: a }, [{ id: '1', name: b }])
      expect(d.soort).toBe(g >= 0.8 ? 'zeker' : g >= 0.6 ? 'mogelijk' : 'geen')
    }
  })
  it('naam plus postcode: zelfde postcode en 80 procent is zeker; andere postcode is geen duplicaat', () => {
    const b = [{ id: '1', name: 'Teeuwen Bouw B.V.', postcode: '3995 AB' }]
    expect(zoekDuplicaat({ name: 'Teeuwen Bouw', postcode: '3995AB' }, b).soort).toBe('zeker')
    expect(zoekDuplicaat({ name: 'Teeuwen Bouw', postcode: '1234AB' }, b).soort).toBe('geen')
    expect(zoekDuplicaat({ name: 'Teeuwen Bouw' }, b).soort).toBe('zeker')
  })
  it('normaliseerNaam: BV, N.V., Holding, Group, leestekens en spaties', () => {
    expect(normaliseerNaam('Teeuwen  Bouw Holding B.V.')).toBe('teeuwen bouw')
    expect(normaliseerNaam('ACME Group N.V.')).toBe('acme')
  })
  it('dubbel in het bestand op KvK, domein en naam plus postcode', () => {
    const r = (rij: number, a: any) => ({ rij, account: { customFields: {}, ...a } })
    expect(dubbelInBestand([r(2, { naam: 'A', kvk: '1' }), r(3, { naam: 'B', kvk: '1' }), r(4, { naam: 'C', domein: 'c.test' }), r(5, { naam: 'D', domein: 'c.test' }), r(6, { naam: 'E bv', postcode: '1234 AB' }), r(7, { naam: 'E', postcode: '1234AB' }), r(8, { naam: 'F' })])).toEqual([[2, 3], [4, 5], [6, 7]])
  })
  it('import overschrijft nooit een veld met een hogere bron', () => {
    expect(magOverschrijven('hand', 'import')).toBe(false)
    expect(magOverschrijven('kvk', 'import')).toBe(false)
    expect(magOverschrijven(undefined, 'import')).toBe(true)
  })
})

describe('terugdraaien en veroudering', () => {
  const batch = { id: 'b1', verwerktOp: '2026-10-01T10:00:00Z' }
  it('de importregel zelf telt niet als activiteit; een notitie wel', () => {
    const a = { data: { importBatchId: 'b1', herkomst: { naam: { bron: 'import', op: '2026-10-01T10:00:00Z' } } } }
    expect(magTerugdraaien(a, [{ soort: 'import', data: { batchId: 'b1' } }], batch)).toBe(true)
    expect(magTerugdraaien(a, [{ soort: 'notitie' }], batch)).toBe(false)
  })
  it('een wijziging met de hand na de import telt als activiteit', () => {
    expect(magTerugdraaien({ data: { importBatchId: 'b1', herkomst: { telefoon: { bron: 'hand', op: '2026-10-02T09:00:00Z' } } } }, [], batch)).toBe(false)
  })
  it('controleren na precies 12 maanden', () => {
    expect(moetControleren({ aangemaaktOp: '2025-10-15T12:00:00Z' }, new Date('2026-10-15T12:00:00Z'))).toBe(true)
    expect(moetControleren({ aangemaaktOp: '2025-10-15T12:00:01Z' }, new Date('2026-10-15T12:00:00Z'))).toBe(false)
  })
})

describe('csv', () => {
  it('puntkomma of komma, aanhalingstekens en regeleinden', () => {
    expect(leesCsv('a;b\n"x;y";"z ""q"""')).toEqual([['a', 'b'], ['x;y', 'z "q"']])
    expect(leesCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(leesCsv(schrijfCsv([['a', 'b;c'], ['1', '2']]))).toEqual([['a', 'b;c'], ['1', '2']])
  })
})
