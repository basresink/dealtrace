import { describe, expect, it } from 'vitest'
import { DAGQUOTES, dagnummer, quoteVanDeDag } from '../../shared/dagquotes'

describe('Quote van de dag', () => {
  it('minstens 60 unieke, korte quotes zonder gedachtestreepjes', () => {
    expect(DAGQUOTES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(DAGQUOTES).size).toBe(DAGQUOTES.length)
    for (const q of DAGQUOTES) {
      expect(q).not.toMatch(/[—–]/)
      expect(q.length).toBeLessThanOrEqual(90)
      expect(q).toMatch(/^[A-Z].*[.!?]$/)
    }
  })

  it('deterministisch per dag en elke dag een andere', () => {
    expect(quoteVanDeDag('2026-10-17')).toBe(quoteVanDeDag('2026-10-17'))
    expect(quoteVanDeDag('2026-10-17')).not.toBe(quoteVanDeDag('2026-10-18'))
    expect(dagnummer('1970-01-02')).toBe(1)
    expect(dagnummer('2026-10-18') - dagnummer('2026-10-17')).toBe(1)
    // Een hele ronde door de lijst zonder herhaling.
    const ronde = Array.from({ length: DAGQUOTES.length }, (_, i) => quoteVanDeDag(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)))
    expect(new Set(ronde).size).toBe(DAGQUOTES.length)
    expect(quoteVanDeDag('2026-10-17', [])).toBe('')
  })
})
