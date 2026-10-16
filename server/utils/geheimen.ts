// Geheimen van koppelingen (12): AES-256-GCM met een sleutel uit GEHEIMEN_SLEUTEL, anders
// afgeleid (HKDF) van het sessiegeheim. Ontsleutelde waarden blijven op de server en gaan
// nooit naar de client of een log; GET-endpoints melden alleen of een sleutel bestaat.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'

/** Eén sleutel per doel (15.3): agenda-tokens delen hun geheim niet met koppelingen of AI-sleutels. */
export type GeheimDoel = 'koppelingen' | 'agenda' | 'mail' | 'afmelden' | 'crm' | 'dealdrive' | 'llm' | 'whatsapp'
function sleutel(doel: GeheimDoel = 'koppelingen'): Buffer {
  // AI-sleutels hebben een eigen geheim (LLM_KEY_SECRET, regel 49); de rest leidt per doel af.
  const eigen = (doel === 'llm' && process.env.LLM_KEY_SECRET) || process.env.GEHEIMEN_SLEUTEL
  const basis = eigen || process.env.SESSIE_GEHEIM || 'lokaal-ontwikkelgeheim-niet-voor-productie-gebruiken'
  return Buffer.from(hkdfSync('sha256', basis, 'dealtrace', doel, 32))
}

export function versleutel(waarde: Record<string, string>, doel: GeheimDoel = 'koppelingen'): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', sleutel(doel), iv)
  const data = Buffer.concat([c.update(JSON.stringify(waarde), 'utf8'), c.final()])
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${data.toString('base64')}`
}

export function ontsleutel(tekst: string | null | undefined, doel: GeheimDoel = 'koppelingen'): Record<string, string> | null {
  if (!tekst) return null
  try {
    const [v, iv, tag, data] = tekst.split('.')
    if (v !== 'v1' || !iv || !tag || !data) return null
    const d = createDecipheriv('aes-256-gcm', sleutel(doel), Buffer.from(iv, 'base64'))
    d.setAuthTag(Buffer.from(tag, 'base64'))
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'))
  } catch {
    return null
  }
}

/** Een ondertekende waarde (bijvoorbeeld de afmeldlink): HMAC met een eigen sleutel per doel. */
export function onderteken(waarde: string, doel: GeheimDoel = 'afmelden'): string {
  return createHmac('sha256', sleutel(doel)).update(waarde).digest('base64url').slice(0, 32)
}
