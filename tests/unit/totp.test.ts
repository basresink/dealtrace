// P27: TOTP volgens RFC 6238 (testvector met SHA1) en de speling van één stap.
import { describe, expect, it } from 'vitest'
import { base32, totpCode, vanBase32, verifieerTotp } from '../../server/utils/totp'

const RFC = base32(Buffer.from('12345678901234567890'))
describe('totp', () => {
  it('RFC 6238-vectoren (laatste zes cijfers)', () => {
    expect(totpCode(RFC, 59_000)).toBe('287082')
    expect(totpCode(RFC, 1111111109_000)).toBe('081804')
    expect(totpCode(RFC, 2000000000_000)).toBe('279037')
  })
  it('base32 heen en terug', () => { expect(vanBase32(RFC).toString()).toBe('12345678901234567890') })
  it('één stap speling, twee niet', () => {
    const t = 1_700_000_000_000
    expect(verifieerTotp(RFC, totpCode(RFC, t - 30_000), t)).toBe(true)
    expect(verifieerTotp(RFC, totpCode(RFC, t + 30_000), t)).toBe(true)
    expect(verifieerTotp(RFC, totpCode(RFC, t - 90_000), t)).toBe(false)
    expect(verifieerTotp(RFC, 'abc', t)).toBe(false)
  })
})
