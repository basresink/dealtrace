// Vandaag-dashboard: de kop en duiding, en de tellers van Door AI agents gedaan.
import { describe, expect, it } from 'vitest'
import { agentTellers, dashboardKop, type DashboardStand } from '../../shared/vandaag'

const basis: DashboardStand = { prospects: 40, zonderContact: 0, inzichtenOpen: 0, verlopen: 0, afsprakenMaand: 0, tempo: { stand: 'achter', pogingen: 10 }, conversie: { waarde: 0, noemer: 0 } }

describe('dashboardKop', () => {
  it('meer dan vijf open inzichten gaat voor', () => {
    expect(dashboardKop({ ...basis, inzichtenOpen: 12, tempo: { stand: 'op schema', pogingen: 120 } }).kop).toBe('12 inzichten wachten. Er ligt ruimte om op te pakken.')
  })
  it('op schema, dan afspraken, dan prospects', () => {
    expect(dashboardKop({ ...basis, tempo: { stand: 'op schema', pogingen: 1 }, afsprakenMaand: 1 }).kop).toBe('Op schema: 1 poging deze week en 1 afspraak deze maand.')
    expect(dashboardKop({ ...basis, afsprakenMaand: 3 }).kop).toMatch(/^3 afspraken deze maand\./)
    expect(dashboardKop(basis).kop).toMatch(/^40 prospects in je lijst\./)
  })
  it('duiding: verlopen taken, dan conversie boven de norm, dan prospects zonder contact', () => {
    expect(dashboardKop({ ...basis, verlopen: 1 }).duiding).toMatch(/^1 taak staat over tijd/)
    expect(dashboardKop({ ...basis, conversie: { waarde: 0.2, noemer: 10 } }).duiding).toMatch(/20% van je gesprekken/)
    expect(dashboardKop({ ...basis, zonderContact: 4 }).duiding).toMatch(/^4 prospects hebben nog geen eerste contactmoment/)
  })
})

describe('agentTellers', () => {
  it('toont taken, inzichten en tegengehouden altijd, de rest alleen als ze voorkomen', () => {
    expect(agentTellers({ verrijkt: 2, taak: 1 })).toEqual([
      { soort: 'taak', aantal: 1, label: 'taak klaargezet' }, { soort: 'inzicht', aantal: 0, label: 'inzichten' },
      { soort: 'verrijkt', aantal: 2, label: 'verrijkt' }, { soort: 'tegengehouden', aantal: 0, label: 'tegengehouden' },
    ])
  })
})
