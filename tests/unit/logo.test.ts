// Logo en website uit het domein (opzet uit DealDrive).
import { describe, expect, it } from 'vitest'
import { accountLogoUrl, domeinUitEmail, logoDomein, websiteUitEmail } from '../../shared/logo'

describe('logo', () => {
  it('haalt het kale domein uit een website', () => {
    expect(logoDomein('https://www.voorbeeld.test/over-ons')).toBe('voorbeeld.test')
    expect(logoDomein('voorbeeld.test')).toBe('voorbeeld.test')
    expect(logoDomein('geen domein')).toBe('')
  })
  it('eigen logo wint, uitgezet geeft leeg, anders het favicon', () => {
    expect(accountLogoUrl({ logoUrl: 'https://x.test/l.png', website: 'y.test' })).toBe('https://x.test/l.png')
    expect(accountLogoUrl({ website: 'y.test', logoUit: true })).toBe('')
    expect(accountLogoUrl({ website: 'https://www.y.test' })).toBe('https://www.google.com/s2/favicons?sz=128&domain=y.test')
    expect(accountLogoUrl({ domein: 'z.test' })).toContain('domain=z.test')
    expect(accountLogoUrl({})).toBe('')
  })
  it('website uit e-mail, niet van een gratis maildienst', () => {
    expect(domeinUitEmail('a@gmail.com')).toBe('')
    expect(websiteUitEmail('a@hotmail.nl', 'b@bedrijf.test')).toBe('https://bedrijf.test')
    expect(websiteUitEmail(null, undefined)).toBeNull()
  })
})
