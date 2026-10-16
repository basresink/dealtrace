// Een telefoonnummer belt op elke telefoon: alleen cijfers en een plus aan het begin in de tel-link.
import { describe, expect, it } from 'vitest'
import { telLink } from '../../app/utils/accountWeergave'

describe('telLink', () => {
  it('laat een E.164-nummer staan', () => expect(telLink('+31612345678')).toBe('tel:+31612345678'))
  it('haalt spaties, streepjes en haakjes weg', () => {
    expect(telLink('030-200 13 70')).toBe('tel:0302001370')
    expect(telLink('(06) 1234 5678')).toBe('tel:0612345678')
    expect(telLink(' +31 6 1234 5678 ')).toBe('tel:+31612345678')
  })
  it('houdt alleen een plus aan het begin', () => expect(telLink('06+12')).toBe('tel:0612'))
})
