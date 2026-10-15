// TOTP (RFC 6238) met HMAC-SHA1, 30 seconden, zes cijfers; één stap speling naar voren en achteren.
import { createHmac, randomBytes } from 'node:crypto'

const ALFABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32(buf: Buffer): string {
  let bits = 0, waarde = 0, uit = ''
  for (const b of buf) { waarde = (waarde << 8) | b; bits += 8; while (bits >= 5) { uit += ALFABET[(waarde >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) uit += ALFABET[(waarde << (5 - bits)) & 31]
  return uit
}
export function vanBase32(s: string): Buffer {
  const t = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, waarde = 0
  const uit: number[] = []
  for (const c of t) { waarde = (waarde << 5) | ALFABET.indexOf(c); bits += 5; if (bits >= 8) { uit.push((waarde >>> (bits - 8)) & 255); bits -= 8 } }
  return Buffer.from(uit)
}

export const nieuwGeheim = () => base32(randomBytes(20))

export function totpCode(geheim: string, tijd: number = Date.now(), stap = 30): string {
  const teller = Math.floor(tijd / 1000 / stap)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(teller))
  const h = createHmac('sha1', vanBase32(geheim)).update(buf).digest()
  const o = h[h.length - 1]! & 15
  const n = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!
  return String(n % 1_000_000).padStart(6, '0')
}

export function verifieerTotp(geheim: string, code: string, tijd: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false
  return [-1, 0, 1].some((d) => totpCode(geheim, tijd + d * 30_000) === code)
}

export const otpauthUri = (geheim: string, email: string) => `otpauth://totp/Dealtrace:${encodeURIComponent(email)}?secret=${geheim}&issuer=Dealtrace&digits=6&period=30`
