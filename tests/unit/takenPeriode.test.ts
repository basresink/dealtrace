// Filtergroep Periode op /taken: vaste keuzes en een eigen periode, ook in het verleden.
import { describe, expect, it } from 'vitest'
import { inBereik, periodeBereik, taakDag } from '../../shared/takenPeriode'

// Woensdag 14 oktober 2026, 10:00 in Nederland.
const nu = new Date('2026-10-14T08:00:00Z')

describe('periodeBereik', () => {
  it('Morgen, Deze week (maandag tot en met zondag) en Volgende week', () => {
    expect(periodeBereik({ periode: 'morgen' }, nu)).toEqual({ van: '2026-10-15', tot: '2026-10-15', eigen: false })
    expect(periodeBereik({ periode: 'deze-week' }, nu)).toEqual({ van: '2026-10-12', tot: '2026-10-18', eigen: false })
    expect(periodeBereik({ periode: 'volgende-week' }, nu)).toEqual({ van: '2026-10-19', tot: '2026-10-25', eigen: false })
  })

  it('de statkaarten regelen vandaag, week en achterstallig zelf', () => {
    for (const periode of [undefined, 'vandaag', 'week', 'achterstallig', 'onzin']) expect(periodeBereik({ periode }, nu)).toBeNull()
  })

  it('een eigen periode gaat voor, mag open zijn aan een kant, draait om als van na tot ligt en negeert onzin', () => {
    expect(periodeBereik({ periode: 'morgen', van: '2026-09-01', tot: '2026-09-30' }, nu)).toEqual({ van: '2026-09-01', tot: '2026-09-30', eigen: true })
    expect(periodeBereik({ van: '2026-09-01' }, nu)).toEqual({ van: '2026-09-01', tot: null, eigen: true })
    expect(periodeBereik({ van: '2026-09-30', tot: '2026-09-01' }, nu)).toEqual({ van: '2026-09-01', tot: '2026-09-30', eigen: true })
    expect(periodeBereik({ van: 'gisteren', tot: '2026-13-45' }, nu)).toBeNull()
  })
})

describe('inBereik en taakDag', () => {
  it('grenzen tellen mee; zonder datum valt een taak erbuiten', () => {
    const b = { van: '2026-09-01', tot: '2026-09-30', eigen: true }
    expect(inBereik('2026-09-01', b)).toBe(true)
    expect(inBereik('2026-09-30', b)).toBe(true)
    expect(inBereik('2026-10-01', b)).toBe(false)
    expect(inBereik(null, b)).toBe(false)
  })

  it('de dag in Nederland; een afgeronde taak zonder vervaldatum telt op de dag van afronden', () => {
    expect(taakDag({ dueDate: '2026-09-30T22:30:00Z' })).toBe('2026-10-01')
    expect(taakDag({ dueDate: null, status: 'klaar', updatedAt: '2026-09-12T10:00:00Z' })).toBe('2026-09-12')
    expect(taakDag({ dueDate: null, status: 'open', updatedAt: '2026-09-12T10:00:00Z' })).toBeNull()
  })
})
