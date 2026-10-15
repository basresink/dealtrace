import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gezondheid } from '../../shared/gezondheid'
import { isVerlaging, pakketVerschil } from '../../shared/pakket'
import { geldigeReden, magSchrijvenInOrganisatie, resterendTekst, werkInGeldig, type WerkInInhoud } from '../../shared/werkIn'
import { controleerPlatform } from '../../tools/checks/platform'
import type { Functie } from '../../shared/functies'

const NU = new Date('2026-10-15T12:00:00Z')
const dagenTerug = (d: number) => new Date(NU.getTime() - d * 24 * 3600 * 1000).toISOString()

describe('gezondheid', () => {
  it('0 gebruikers is Leeg, ook met accounts', () => {
    expect(gezondheid({ gebruikers: 0, metLogin: 0, laatstActief: null, accounts: 12 }, NU).stand).toBe('leeg')
  })
  it('niemand met login of nooit activiteit is Risico', () => {
    expect(gezondheid({ gebruikers: 3, metLogin: 0, laatstActief: dagenTerug(1) }, NU).stand).toBe('risico')
    expect(gezondheid({ gebruikers: 3, metLogin: 3, laatstActief: null }, NU).stand).toBe('risico')
  })
  it('grenzen 15 en 30 dagen', () => {
    expect(gezondheid({ gebruikers: 2, metLogin: 2, laatstActief: dagenTerug(14) }, NU).stand).toBe('gezond')
    expect(gezondheid({ gebruikers: 2, metLogin: 2, laatstActief: dagenTerug(15) }, NU).stand).toBe('let_op')
    expect(gezondheid({ gebruikers: 2, metLogin: 2, laatstActief: dagenTerug(30) }, NU).stand).toBe('let_op')
    expect(gezondheid({ gebruikers: 2, metLogin: 2, laatstActief: dagenTerug(31) }, NU).stand).toBe('risico')
  })
  it('Risico gaat boven Let op', () => {
    const g = gezondheid({ gebruikers: 4, metLogin: 1, laatstActief: dagenTerug(40) }, NU)
    expect(g.stand).toBe('risico')
  })
  it('minder dan de helft met login is Let op, met reden', () => {
    const g = gezondheid({ gebruikers: 7, metLogin: 3, laatstActief: dagenTerug(1) }, NU)
    expect(g).toEqual({ stand: 'let_op', redenen: ['3 van 7 gebruikers met login'] })
  })
  it('0 accounts is Risico zodra accounts geteld worden', () => {
    expect(gezondheid({ gebruikers: 2, metLogin: 2, laatstActief: dagenTerug(1), accounts: 0 }, NU).stand).toBe('risico')
  })
})

describe('pakketVerschil', () => {
  const cat = [
    { sleutel: 'a', naam: 'A', pakket: 'starter', rollen: 'iedereen' },
    { sleutel: 'b', naam: 'B', pakket: 'plus', rollen: 'iedereen' },
    { sleutel: 'c', naam: 'C', pakket: 'compleet', rollen: 'iedereen' },
    { sleutel: 'f', naam: 'Founder', pakket: 'compleet', rollen: ['founder'] },
  ] as unknown as Functie[]
  it('gelijk pakket geeft twee lege lijsten', () => {
    expect(pakketVerschil('plus', 'plus', cat)).toEqual({ wint: [], verliest: [] })
  })
  it('verlagen en verhogen', () => {
    expect(pakketVerschil('compleet', 'starter', cat)).toEqual({ wint: [], verliest: ['B', 'C'] })
    expect(pakketVerschil('starter', 'plus', cat)).toEqual({ wint: ['B'], verliest: [] })
    expect(isVerlaging('plus', 'starter')).toBe(true)
    expect(isVerlaging('starter', 'compleet')).toBe(false)
  })
})

describe('werk-in', () => {
  const inhoud: WerkInInhoud = { founderId: 'u-founder', organisatieId: 'org-voltvast', modus: 'meekijken', reden: 'Ticket 1042', start: NU.toISOString(), tot: new Date(NU.getTime() + 8 * 3600_000).toISOString() }
  it('geldig binnen 8 uur voor dezelfde founder', () => {
    expect(werkInGeldig(inhoud, 'u-founder', new Date(NU.getTime() + 3600_000))?.organisatieId).toBe('org-voltvast')
  })
  it('verlopen na 8 uur, ook als tot later staat', () => {
    expect(werkInGeldig(inhoud, 'u-founder', new Date(NU.getTime() + 8 * 3600_000))).toBeNull()
    const lang = { ...inhoud, tot: new Date(NU.getTime() + 48 * 3600_000).toISOString() }
    expect(werkInGeldig(lang, 'u-founder', new Date(NU.getTime() + 9 * 3600_000))).toBeNull()
  })
  it('ongeldig (null) en andere founder', () => {
    expect(werkInGeldig(null, 'u-founder', NU)).toBeNull()
    expect(werkInGeldig(inhoud, 'u-ander', NU)).toBeNull()
  })
  it('magSchrijvenInOrganisatie', () => {
    expect(magSchrijvenInOrganisatie({ werkIn: { modus: 'meekijken' } })).toBe(false)
    expect(magSchrijvenInOrganisatie({ werkIn: { modus: 'wijzigen' } })).toBe(true)
    expect(magSchrijvenInOrganisatie({})).toBe(true)
  })
  it('reden minstens 5 tekens en resterende tijd', () => {
    expect(geldigeReden('1042')).toBe(false)
    expect(geldigeReden(' T 104 ')).toBe(true)
    expect(resterendTekst((7 * 60 + 42) * 60_000)).toBe('nog 7 uur 42')
    expect(resterendTekst(5 * 60_000)).toBe('nog 5 min')
  })
})

describe('check:platform', () => {
  it('vindt een platformendpoint zonder requireFounder en een gewoon scherm dat een platformroute aanroept', () => {
    const fouten = controleerPlatform(join(__dirname, '../fixtures/platform-lek'))
    expect(fouten.some((f) => f.includes('lek.get.ts') && f.includes('requireFounder'))).toBe(true)
    expect(fouten.some((f) => f.includes('gewoon.vue'))).toBe(true)
  })
  it('de echte code is in orde', () => {
    expect(controleerPlatform(join(__dirname, '../..'))).toEqual([])
  })
})
