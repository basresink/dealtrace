// Handtekening van SalesDNA-webhooks (P29, 15.3): HMAC-SHA256 over de ruwe body met het geheim van
// de koppeling, als "sha256=<hex>" in X-SalesDNA-Signature. Vergelijken in constante tijd.
// Het geheim komt nooit in een log; de pagina toont alleen de vingerafdruk.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const teken = (rauweBody: string | Buffer, geheim: string) => `sha256=${createHmac('sha256', geheim).update(rauweBody).digest('hex')}`

export function controleerHandtekening(rauweBody: string | Buffer | null | undefined, header: string | null | undefined, geheim: string | null | undefined): boolean {
  if (!geheim || !header || rauweBody == null) return false
  const verwacht = Buffer.from(teken(rauweBody, geheim))
  const gekregen = Buffer.from(header.trim())
  return verwacht.length === gekregen.length && timingSafeEqual(verwacht, gekregen)
}

/** Acht tekens om een geheim te herkennen zonder het te tonen. */
export const vingerafdruk = (geheim: string) => createHash('sha256').update(geheim).digest('hex').slice(0, 8)
export const payloadHash = (rauweBody: string | Buffer) => createHash('sha256').update(rauweBody).digest('hex')
