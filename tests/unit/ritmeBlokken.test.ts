// Blokken van Dagstart en Weekstart: het vulvoorstel voor lege belblokken en de korte mailregels. Fictieve data.
import { describe, expect, it } from 'vitest'
import { belblokStand, ritmeBlokkenMail, vulVoorstellen, type RitmeBlokken, type VulKandidaat } from '../../shared/ritmeBlokken'

const nu = new Date('2026-10-19T06:00:00Z')
const k = (id: string, herkomst: 'koud' | 'opvolging', duur = 8): VulKandidaat => ({ accountId: id, accountNaam: `Test ${id}`, score: 50, herkomst, reden: 'Nog niet gebeld', duur, taskId: `t-${id}` })
const sessie = (id: string, start: string, eind: string, extra: Partial<Parameters<typeof vulVoorstellen>[0][number]> = {}) => ({ id, start, eind, status: 'gepland', soort: 'gemengd' as const, verhouding: null, duren: [] as number[], ...extra })

describe('vulVoorstellen', () => {
  it('stelt voor wat past bij de soort, elke kandidaat in hooguit één blok', () => {
    const uit = vulVoorstellen([
      sessie('b1', '2026-10-19T07:00:00Z', '2026-10-19T08:00:00Z', { soort: 'koud' }),
      sessie('b2', '2026-10-19T12:00:00Z', '2026-10-19T13:00:00Z', { soort: 'koud' }),
    ], [k('a', 'koud'), k('b', 'koud'), k('c', 'opvolging'), k('d', 'koud'), k('e', 'koud'), k('f', 'koud'), k('g', 'koud'), k('h', 'koud')], nu)
    expect(uit).toHaveLength(2)
    expect(uit[0]!.leeg).toBe(true)
    expect(uit[0]!.voorstel.every((v) => v.herkomst === 'koud')).toBe(true)
    const alle = uit.flatMap((b) => b.voorstel.map((v) => v.accountId))
    expect(new Set(alle).size).toBe(alle.length)
    expect(alle).not.toContain('c')
  })

  it('slaat volle, lopende en voorbije blokken over en houdt wie die dag een afspraak heeft eruit', () => {
    const uit = vulVoorstellen([
      sessie('vol', '2026-10-19T07:00:00Z', '2026-10-19T08:00:00Z', { duren: [10, 10, 10, 10, 8] }),
      sessie('loopt', '2026-10-19T08:00:00Z', '2026-10-19T09:00:00Z', { status: 'bezig' }),
      sessie('voorbij', '2026-10-19T04:00:00Z', '2026-10-19T05:00:00Z'),
      sessie('half', '2026-10-19T12:00:00Z', '2026-10-19T13:00:00Z', { duren: [8, 8] }),
    ], [k('a', 'koud'), k('b', 'opvolging')], nu, new Map([['2026-10-19', new Set(['a'])]]))
    expect(uit.map((b) => b.id)).toEqual(['half'])
    expect(uit[0]!.stand).toBe('2 gesprekken, plek voor nog 3')
    expect(uit[0]!.voorstel.map((v) => v.accountId)).toEqual(['b'])
  })

  it('zegt in woorden hoe vol een blok is', () => {
    expect(belblokStand(0, 72)).toBe('Leeg, plek voor ongeveer 9 gesprekken')
    expect(belblokStand(1, 5)).toBe('1 gesprek, vol')
  })
})

describe('ritmeBlokkenMail', () => {
  it('geeft korte regels zonder gedachtestreepjes en laat lege of uitgezette blokken weg', () => {
    const b: RitmeBlokken = {
      periode: 'week',
      belblokken: { blokken: [], voorstellen: [{ datum: '2026-10-20', start: '2026-10-20T08:00:00Z', eind: '2026-10-20T09:00:00Z', uitleg: null }], totaal: 0 },
      belprioriteit: { afspraken: [], lijst: [] },
      kansen: null,
      campagnes: { lopend: [{ id: 'c1', naam: 'Testcampagne', eindOp: null, dagenOver: 3, tempo: null, kaarten: { gedaan: 2, totaal: 5 }, aanDeBeurt: 1, taken: [] }] },
      accountplannen: null,
    }
    const regels = ritmeBlokkenMail(b)
    expect(regels).toContain('Belblokken om te vullen')
    expect(regels).toContain('- Testcampagne: 2 van 5 kaarten gedaan, 1 aan de beurt')
    expect(regels).not.toContain('Bel eerst')
    expect(regels.join('\n')).not.toMatch(/[–—]/)
    expect(ritmeBlokkenMail(null)).toEqual([])
  })
})
