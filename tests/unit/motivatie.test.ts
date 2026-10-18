import { describe, expect, it } from 'vitest'
import { MOTIVATIES, motivatieVanDeDag } from '../../shared/motivatie'

describe('Motiverende zin op Dagstart', () => {
  it('minstens 60 unieke, korte zinnen in je-vorm zonder gedachtestreepjes', () => {
    expect(MOTIVATIES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(MOTIVATIES).size).toBe(MOTIVATIES.length)
    for (const z of MOTIVATIES) {
      expect(z).not.toMatch(/[—–]/)
      expect(z.length).toBeLessThanOrEqual(90)
      expect(z).toMatch(/^[A-Z].*[.!?]$/)
      expect(z).toMatch(/\b(je|jij|jou|jouw|jezelf)\b/i)
    }
  })

  it('zelfde datum geeft dezelfde zin, opeenvolgende dagen verschillen', () => {
    expect(motivatieVanDeDag('2026-10-18')).toBe(motivatieVanDeDag('2026-10-18'))
    expect(motivatieVanDeDag('2026-10-18')).not.toBe(motivatieVanDeDag('2026-10-19'))
    expect(motivatieVanDeDag('2026-12-31')).not.toBe(motivatieVanDeDag('2027-01-01'))
    const ronde = Array.from({ length: MOTIVATIES.length }, (_, i) => motivatieVanDeDag(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)))
    expect(new Set(ronde).size).toBe(MOTIVATIES.length)
    expect(motivatieVanDeDag('2026-10-18', [])).toBe('')
  })
})
