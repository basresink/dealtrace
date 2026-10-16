import { describe, expect, it } from 'vitest'
import { contactFiltersUitQuery, contactTellers, pasContactFiltersToe, sorteerContacten, type ContactFilterRij } from '../../shared/contactFilters'

const rij = (p: Partial<ContactFilterRij>): ContactFilterRij => ({ id: 'x', naam: 'Test', functie: null, bedrijf: 'Testbedrijf', rol: 'onbekend', soort: 'prospect', eigenaarId: 'u-1', email: null, telefoon: null, mobiel: null, belMeNiet: false, consent: {}, laatsteContactOp: null, ...p })
const rijen = [
  rij({ id: 'a', naam: 'Anna Testa', rol: 'beslisser', email: 'a@x.test', telefoon: '+31600000001' }),
  rij({ id: 'b', naam: 'Bram Testb', rol: 'champion', soort: 'klant', eigenaarId: 'u-2', belMeNiet: true, telefoon: '+31600000002' }),
  rij({ id: 'c', naam: 'Cor Testc', rol: 'beslisser', consent: { email: { status: 'nee' } }, email: 'c@x.test', laatsteContactOp: new Date().toISOString() }),
]
const ctx = { gebruikerId: 'u-1' }

describe('contactFilters', () => {
  it('Van mijn accounts staat standaard aan; mijn=0 is iedereen', () => {
    expect(pasContactFiltersToe(rijen, contactFiltersUitQuery({}), ctx).map((r) => r.id)).toEqual(['a', 'c'])
    expect(pasContactFiltersToe(rijen, contactFiltersUitQuery({ mijn: '0' }), ctx)).toHaveLength(3)
  })
  it('oude parameters blijven werken', () => {
    const f = contactFiltersUitQuery({ zonderTelefoon: '1', geenContact: '30', mijn: '0' })
    expect(f.bereikbaarheid).toEqual(['zonderTelefoon'])
    expect(f.laatsteContact).toEqual(['30'])
    expect(pasContactFiltersToe(rijen, f, ctx)).toHaveLength(0)
  })
  it('toestemming en rol als lijst', () => {
    expect(pasContactFiltersToe(rijen, contactFiltersUitQuery({ mijn: '0', toestemming: 'belMeNiet,geenMail' }), ctx).map((r) => r.id)).toEqual(['b', 'c'])
    expect(pasContactFiltersToe(rijen, contactFiltersUitQuery({ mijn: '0', rol: 'champion,beslisser' }), ctx)).toHaveLength(3)
  })
  it('tellers rekenen mee met de andere filters', () => {
    const t = contactTellers(rijen, contactFiltersUitQuery({ mijn: '0', soort: 'prospect' }), ctx)
    expect(t.rol.beslisser).toBe(2)
    expect(t.rol.champion).toBe(0)
    expect(t.soort.klant).toBe(1)
  })
  it('sorteert op rol, dan naam', () => {
    expect(sorteerContacten(rijen, 'rol').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(sorteerContacten(rijen, 'naam').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})
