// Mail versturen (P27, inlogcode). Met RESEND_API_KEY via Resend; anders de mock: de server
// logt dat er een code is verstuurd en bewaart hem in het geheugen voor de ontwikkelmodus
// (GET /api/auth/testcode). Nooit naar echte adressen vanuit tests of seeds (.test).
const laatste = new Map<string, { code: string; op: number }>()

export async function stuurInlogcode(email: string, code: string): Promise<void> {
  const sleutel = process.env.RESEND_API_KEY
  if (sleutel && !email.endsWith('.test')) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${sleutel}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_AFZENDER || 'Dealtrace <inloggen@dealtrace.nl>', to: [email], subject: `Je inlogcode: ${code}`,
        text: `Je code om in te loggen bij Dealtrace is ${code}.\n\nHij is 10 minuten geldig. Heb je geen code aangevraagd? Dan kun je deze mail negeren.`,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Mail niet verstuurd (${res.status})`)
    return
  }
  laatste.set(email.toLowerCase(), { code, op: Date.now() })
  console.log(`[mail-mock] inlogcode verstuurd naar ${email.replace(/^(.).*@/, '$1***@')}`)
}

/** Alleen voor de ontwikkelmodus en tests: de laatst verstuurde code (10 minuten). */
export function laatsteTestcode(email: string): string | null {
  const l = laatste.get(email.toLowerCase())
  return l && Date.now() - l.op < 10 * 60_000 ? l.code : null
}
