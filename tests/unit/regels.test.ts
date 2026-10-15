import { describe, expect, it } from 'vitest'
import { feestdagen, isWerkdag, pasen, telWerkdagen, volgendeWerkdag } from '../../shared/datum'
import { magOverschrijven } from '../../shared/herkomst'
import { rolMag, scopeVoor } from '../../shared/permissions'
import { naarVerzendPatch, pasPatchToe } from '../../shared/wisPatch'
import { isVerborgen } from '../../shared/settingKeys'

describe('werkdagen en feestdagen (Bijlage A, gat 15)', () => {
  it('Pasen 2026 is 5 april', () => expect(pasen(2026)).toBe('2026-04-05'))
  it('Koningsdag 2026 (maandag) en Tweede Paasdag zijn geen werkdag', () => {
    expect(isWerkdag('2026-04-27')).toBe(false)
    expect(isWerkdag('2026-04-06')).toBe(false)
  })
  it('Koningsdag op zondag schuift naar zaterdag 26 april', () => {
    expect(feestdagen(2025).find((f) => f.naam === 'Koningsdag')?.datum).toBe('2025-04-26')
  })
  it('telWerkdagen 2026-12-24 tot en met 2027-01-04 telt Kerst en Nieuwjaar niet mee', () => {
    // 24 (do), 28, 29, 30, 31 dec, 4 jan; niet 25, 26 (feest/weekend), 1 jan, weekenden.
    expect(telWerkdagen('2026-12-24', '2027-01-04')).toBe(6)
  })
  it('Bevrijdingsdag alleen in lustrumjaren, tenzij anders ingesteld', () => {
    expect(isWerkdag('2030-05-06')).toBe(true)
    expect(feestdagen(2030).some((f) => f.datum === '2030-05-05')).toBe(true)
    expect(feestdagen(2026).some((f) => f.naam === 'Bevrijdingsdag')).toBe(false)
    expect(isWerkdag('2026-05-05', { bevrijdingsdag: 'altijd' })).toBe(false)
  })
  it('volgende werkdag na Tweede Kerstdag 2026 (zaterdag) is maandag 28 december', () => {
    expect(volgendeWerkdag('2026-12-26')).toBe('2026-12-28')
  })
})

describe('rechtenmatrix (3.3)', () => {
  it('onbekend onderdeel is geen', () => {
    expect(scopeVoor('beheerder', 'bestaatniet', 'lezen')).toBe('geen')
    expect(rolMag('beheerder', 'bestaatniet', 'lezen')).toBe(false)
  })
  it('salesmanager buiten zijn team mag geen gebruiker wijzigen', () => {
    expect(rolMag('salesmanager', 'gebruikers', 'schrijven', { team: false })).toBe(false)
    expect(rolMag('salesmanager', 'gebruikers', 'schrijven', { team: true })).toBe(true)
  })
  it('accountmanager wijzigt alleen zijn eigen profiel; abonnement geen', () => {
    expect(rolMag('accountmanager', 'gebruikers', 'schrijven', { eigen: true })).toBe(true)
    expect(rolMag('accountmanager', 'gebruikers', 'schrijven', { eigen: false })).toBe(false)
    expect(rolMag('accountmanager', 'abonnement', 'lezen')).toBe(false)
  })
  it('founder: platform alles, organisatiedata alleen na instappen', () => {
    expect(rolMag('founder', 'platform', 'beheren')).toBe(true)
    expect(rolMag('founder', 'prospects', 'lezen')).toBe(false)
    expect(rolMag('founder', 'prospects', 'lezen', { ingestapt: true })).toBe(true)
    expect(rolMag('founder', 'prospects', 'schrijven', { ingestapt: true })).toBe(false)
  })
})

describe('herkomst', () => {
  it('lagere bron overschrijft hogere niet; hand wint altijd', () => {
    expect(magOverschrijven('kvk', 'import')).toBe(false)
    expect(magOverschrijven('import', 'kvk')).toBe(true)
    expect(magOverschrijven('kvk', 'kvk')).toBe(true)
    expect(magOverschrijven('hand', 'kvk')).toBe(false)
    expect(magOverschrijven('kvk', 'hand')).toBe(true)
    expect(magOverschrijven(undefined, 'ai')).toBe(true)
  })
})

describe('wisPatch en instellingssleutels', () => {
  it('null en undefined wissen, ontbrekende sleutel laat staan', () => {
    expect(naarVerzendPatch({ a: undefined, b: 1 })).toEqual({ a: null, b: 1 })
    expect(pasPatchToe({ a: 1, b: 2, c: 3 }, { a: null, b: 5 })).toEqual({ b: 5, c: 3 })
  })
  it('leverancierssleutels zijn verborgen', () => {
    expect(isVerborgen('pakket')).toBe(true)
    expect(isVerborgen('werkdagen')).toBe(false)
  })
})
