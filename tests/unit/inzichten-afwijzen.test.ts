// Inzichten: afwijzen met een eigen reden, de historie, de periode Van en Tot en de tekst van een winpunt.
import { describe, expect, it } from 'vitest'
import { EIGEN_REDEN, afwijsData, afwijsTekst, binnenPeriode, inzichtHistorie, leesAfwijsReden, winpuntTekst } from '../../shared/inzichten'

describe('leesAfwijsReden', () => {
  it('neemt een vaste reden zoals hij is', () => {
    expect(leesAfwijsReden('Al bekend')).toEqual({ ok: true, keuze: { reden: 'Al bekend', toelichting: null } })
  })
  it('vraagt bij een eigen reden een tekst van minstens 3 tekens', () => {
    expect(leesAfwijsReden(EIGEN_REDEN, ' x ').ok).toBe(false)
    expect(leesAfwijsReden(EIGEN_REDEN, '  Loopt via   een collega ')).toEqual({ ok: true, keuze: { reden: EIGEN_REDEN, toelichting: 'Loopt via een collega' } })
    const lang = leesAfwijsReden(EIGEN_REDEN, 'a'.repeat(400))
    expect(lang.ok && lang.keuze.toelichting!.length).toBe(300)
  })
  it('weigert een onbekende reden of geen reden', () => {
    expect(leesAfwijsReden('Vind ik niks').ok).toBe(false)
    expect(leesAfwijsReden(undefined).ok).toBe(false)
  })
})

describe('historie en tekst', () => {
  const nu = new Date('2026-10-10T09:00:00Z')
  it('toont de eigen reden in de historie en houdt "Eigen reden" als categorie voor de telling', () => {
    const data = afwijsData({ reden: EIGEN_REDEN, toelichting: 'Loopt via een collega' }, 'u-1', nu)
    expect(data.afwijsReden).toBe(EIGEN_REDEN)
    expect(afwijsTekst(data)).toBe('Loopt via een collega')
    const h = inzichtHistorie({ createdAt: '2026-10-01T08:00:00Z', updatedAt: nu.toISOString(), status: 'afgewezen', bronLabel: 'Waarnemer', data: { ...data, gelezenOp: '2026-10-02T08:00:00Z' } })
    expect(h.map((x) => x.soort)).toEqual(['binnen', 'gelezen', 'afgewezen'])
    expect(h[0]!.tekst).toBe('Binnengekomen via Waarnemer')
    expect(h[2]).toMatchObject({ tekst: 'Afgewezen met een eigen reden', reden: 'Loopt via een collega', op: nu.toISOString() })
  })
  it('een vaste reden staat er zoals hij is', () => {
    const h = inzichtHistorie({ createdAt: '2026-10-01T08:00:00Z', status: 'afgewezen', data: { afwijsReden: 'Te oud' } })
    expect(h.at(-1)).toMatchObject({ tekst: 'Afgewezen', reden: 'Te oud' })
  })
})

describe('binnenPeriode', () => {
  it('rekent met hele Amsterdamse dagen, beide grenzen inclusief', () => {
    // 23:30 UTC op 31 maart is 1 april in Amsterdam (zomertijd).
    expect(binnenPeriode('2026-03-31T23:30:00Z', '2026-04-01', '2026-04-01')).toBe(true)
    expect(binnenPeriode('2026-03-31T21:00:00Z', '2026-04-01')).toBe(false)
    expect(binnenPeriode('2025-06-15T10:00:00Z', '2025-01-01', '2025-12-31')).toBe(true)
    expect(binnenPeriode('2026-01-02T10:00:00Z', undefined, '2026-01-01')).toBe(false)
    expect(binnenPeriode('2026-01-02T10:00:00Z', 'onzin', null)).toBe(true)
  })
})

describe('winpuntTekst', () => {
  it('geeft de titel bij een bekend id en anders de waarde zelf', () => {
    const titels = new Map([['wp-01', 'Projectschouw binnen twee dagen']])
    expect(winpuntTekst('wp-01', titels)).toBe('Projectschouw binnen twee dagen')
    expect(winpuntTekst('Snelle levering', titels)).toBe('Snelle levering')
    expect(winpuntTekst(null, titels)).toBeNull()
  })
})
