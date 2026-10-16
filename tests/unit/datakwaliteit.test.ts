// Datakwaliteit: elke controle heeft een korte "ontbreekt", eigen velden worden "Zonder <veldnaam>",
// alleen account- en contactvelden tellen mee, de score en de link naar de gefilterde lijst.
import { describe, expect, it } from 'vitest'
import { eigenVeldCategorie, eigenVeldSleutel, filterLink, KWALITEIT_CATEGORIEEN, kwaliteitScore, teltMee } from '../../shared/datakwaliteit'
import { klasseVoorOmvang, OMVANG_EIGEN_VELDEN } from '../../shared/ritmematrix'

describe('datakwaliteit', () => {
  it('elke vaste controle zegt kort wat er ontbreekt', () => {
    for (const c of KWALITEIT_CATEGORIEEN) expect(c.ontbreekt.length).toBeGreaterThan(2)
  })

  it('een accountveld wordt een prospectcontrole, een contactveld een contactcontrole', () => {
    const a = eigenVeldCategorie({ sleutel: 'jaaromzet', naam: 'Jaaromzet', object: 'account', data: { datakwaliteit: true } })
    expect(a).toMatchObject({ sleutel: 'cf.account.jaaromzet', eigenVeld: 'jaaromzet', groep: 'Prospects', titel: 'Zonder Jaaromzet', basis: 'prospects', ontbreekt: 'Jaaromzet' })
    const c = eigenVeldCategorie({ sleutel: 'afdeling', naam: 'Afdeling', object: 'contact', data: { hulp: 'Waar werkt dit contact?' } })
    expect(c).toMatchObject({ sleutel: 'cf.contact.afdeling', groep: 'Contacten', basis: 'contacten', uitleg: 'Waar werkt dit contact?' })
    expect(eigenVeldSleutel({ object: 'contact', sleutel: 'x' })).toBe('cf.contact.x')
  })

  it('alleen aangezette, niet gearchiveerde account- en contactvelden tellen mee', () => {
    const v = (object: string, datakwaliteit: boolean, gearchiveerd = false) => ({ sleutel: 's', naam: 'S', object, gearchiveerd, data: { datakwaliteit } })
    expect(teltMee(v('account', true))).toBe(true)
    expect(teltMee(v('contact', true))).toBe(true)
    expect(teltMee(v('account', false))).toBe(false)
    expect(teltMee(v('account', true, true))).toBe(false)
    expect(teltMee(v('campagne', true))).toBe(false)
  })

  it('een eigen veld zonder filter krijgt geen lijstlink; de score telt de gaten mee', () => {
    const c = eigenVeldCategorie({ sleutel: 'x', naam: 'X', object: 'account' })
    expect(filterLink(c, 'beheerder', true)).toBeNull()
    expect(kwaliteitScore([{ aantal: 5, noemer: 10 }, { aantal: 0, noemer: 10 }])).toBe(75)
  })
})

describe('nieuwe prospect en de accountmatrix', () => {
  it('Aantal monteurs is geen omvangveld meer in het venster; de klasse volgt uit medewerkers', () => {
    expect(OMVANG_EIGEN_VELDEN).toContain('aantal_monteurs')
    const klassen = [{ id: 'kl-a', naam: 'A · Groot' }, { id: 'kl-b', naam: 'B · Middel' }, { id: 'kl-c', naam: 'C · Klein' }]
    expect(klasseVoorOmvang(300, klassen)).toBe('kl-a')
    expect(klasseVoorOmvang(30, klassen)).toBe('kl-c')
    expect(klasseVoorOmvang(null, klassen)).toBeNull()
  })
})
