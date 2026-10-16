// Logo en website uit het domein (opzet uit DealDrive).
import { describe, expect, it } from 'vitest'
import { accountLogoUrl, domeinUitEmail, iconLinks, logoDomein, logoOphaalbaar, websiteUitEmail } from '../../shared/logo'

describe('logo', () => {
  it('haalt het kale domein uit een website', () => {
    expect(logoDomein('https://www.voorbeeld.test/over-ons')).toBe('voorbeeld.test')
    expect(logoDomein('voorbeeld.test')).toBe('voorbeeld.test')
    expect(logoDomein('geen domein')).toBe('')
  })
  it('eigen logo wint, uitgezet geeft leeg, anders het favicon via de eigen route (B11)', () => {
    expect(accountLogoUrl({ logoUrl: 'https://x.test/l.png', website: 'y.nl' })).toBe('https://x.test/l.png')
    expect(accountLogoUrl({ website: 'y.nl', logoUit: true })).toBe('')
    expect(accountLogoUrl({ website: 'https://www.voorbeeld.nl' })).toBe('/api/logo?domein=voorbeeld.nl')
    expect(accountLogoUrl({ domein: 'z.nl' })).toBe('/api/logo?domein=z.nl')
    expect(accountLogoUrl({})).toBe('')
    // Nooit naar een dienst van derden.
    expect(accountLogoUrl({ website: 'https://www.voorbeeld.nl' })).not.toMatch(/google|gstatic/)
  })
  it('testdomeinen halen geen logo op: initialen zonder verzoek', () => {
    expect(accountLogoUrl({ website: 'https://www.y.test' })).toBe('')
    expect(accountLogoUrl({ domein: 'bedrijf.example' })).toBe('')
    expect(logoOphaalbaar('bedrijf.localhost')).toBe(false)
    expect(logoOphaalbaar('bedrijf.nl')).toBe(true)
  })
  it('iconLinks: grootste icoon eerst, relatieve paden en geen data-URL', () => {
    const html = '<link rel="icon" href="/f32.png" sizes="32x32"><link rel="apple-touch-icon" href="https://cdn.voorbeeld.nl/a.png"><link rel="icon" href="data:image/png;base64,AA"><link rel="stylesheet" href="/s.css">'
    expect(iconLinks(html, 'https://voorbeeld.nl/')).toEqual(['https://cdn.voorbeeld.nl/a.png', 'https://voorbeeld.nl/f32.png'])
  })
  it('website uit e-mail, niet van een gratis maildienst', () => {
    expect(domeinUitEmail('a@gmail.com')).toBe('')
    expect(websiteUitEmail('a@hotmail.nl', 'b@bedrijf.test')).toBe('https://bedrijf.test')
    expect(websiteUitEmail(null, undefined)).toBeNull()
  })
})
