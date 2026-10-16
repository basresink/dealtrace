// WhatsApp Business-adapter (P26, hoofdstuk 12, open vraag 11): verstuurSjabloon, dienSjabloonIn en
// ontvangStatus. Modus 'mock' (lokaal, in tests en in de seed: niets verlaat de server) of 'meta'
// (Meta Cloud API, via de provider van de organisatie). Een webhook is ondertekend met HMAC-SHA256
// over de ruwe body (kop x-hub-signature-256: sha256=<hex>), zoals Meta dat doet.
import { createHmac, timingSafeEqual } from 'node:crypto'

export type WaModus = 'mock' | 'meta'
export interface WaConfig { modus: WaModus; telefoonId?: string; wabaId?: string; token?: string }
export type WaAntwoord = { ok: true; externId: string } | { ok: false; melding: string }
export interface WaStatus { externId: string; status: 'verzonden' | 'afgeleverd' | 'gelezen' | 'mislukt' | null; optOut: boolean; nummer: string | null }

/** Wat de mock verstuurde: in het geheugen, alleen voor ontwikkeling en tests. */
export const WA_MOCK_POSTVAK: { nummer: string; sjabloon: string; taal: string; variabelen: string[]; externId: string }[] = []

export interface WhatsappAdapter {
  verstuurSjabloon(nummerE164: string, s: { naam: string; taal: string }, variabelen: string[]): Promise<WaAntwoord>
  dienSjabloonIn(s: { naam: string; taal: string; tekst: string }): Promise<{ ok: true; externId: string; status: 'ingediend' | 'goedgekeurd' | 'afgewezen'; reden?: string } | { ok: false; melding: string }>
  test(): Promise<{ ok: boolean; tekst: string }>
}

const mock: WhatsappAdapter = {
  async verstuurSjabloon(nummer, s, variabelen) {
    const externId = `wamid.mock.${crypto.randomUUID().slice(0, 12)}`
    WA_MOCK_POSTVAK.push({ nummer, sjabloon: s.naam, taal: s.taal, variabelen, externId })
    return { ok: true, externId }
  },
  // De mock keurt direct goed, behalve een tekst met een link naar buiten zonder https (zoals Meta afwijst).
  async dienSjabloonIn(s) {
    const afgewezen = /http:\/\//.test(s.tekst)
    return { ok: true, externId: `tpl.mock.${s.naam}`, status: afgewezen ? 'afgewezen' : 'goedgekeurd', reden: afgewezen ? 'Links moeten met https beginnen' : undefined }
  },
  async test() { return { ok: true, tekst: 'Testverbinding gelukt (mock: er verlaat niets de server).' } },
}

function meta(c: WaConfig): WhatsappAdapter {
  const basis = 'https://graph.facebook.com/v20.0'
  const kop = { authorization: `Bearer ${c.token ?? ''}`, 'content-type': 'application/json' }
  return {
    async verstuurSjabloon(nummer, s, variabelen) {
      try {
        const r = await fetch(`${basis}/${c.telefoonId}/messages`, { method: 'POST', headers: kop, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ messaging_product: 'whatsapp', to: nummer.replace(/^\+/, ''), type: 'template', template: { name: s.naam, language: { code: s.taal }, components: variabelen.length ? [{ type: 'body', parameters: variabelen.map((text) => ({ type: 'text', text })) }] : [] } }) })
        const j: any = await r.json().catch(() => ({}))
        return r.ok && j?.messages?.[0]?.id ? { ok: true, externId: j.messages[0].id } : { ok: false, melding: `De provider weigerde het bericht (${r.status})` }
      } catch { return { ok: false, melding: 'De provider is niet bereikbaar' } }
    },
    async dienSjabloonIn(s) {
      try {
        const r = await fetch(`${basis}/${c.wabaId}/message_templates`, { method: 'POST', headers: kop, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ name: s.naam, language: s.taal, category: 'MARKETING', components: [{ type: 'BODY', text: s.tekst }] }) })
        const j: any = await r.json().catch(() => ({}))
        return r.ok && j?.id ? { ok: true, externId: String(j.id), status: j.status === 'APPROVED' ? 'goedgekeurd' : j.status === 'REJECTED' ? 'afgewezen' : 'ingediend' } : { ok: false, melding: `De provider weigerde het sjabloon (${r.status})` }
      } catch { return { ok: false, melding: 'De provider is niet bereikbaar' } }
    },
    async test() {
      try { const r = await fetch(`${basis}/${c.telefoonId}`, { headers: kop, signal: AbortSignal.timeout(8000) }); return r.ok ? { ok: true, tekst: 'Testverbinding gelukt.' } : { ok: false, tekst: `De provider gaf ${r.status}. Controleer het token en het telefoonnummer-id.` } } catch { return { ok: false, tekst: 'De provider is niet bereikbaar.' } }
    },
  }
}

export const whatsappAdapter = (c: WaConfig): WhatsappAdapter => (c.modus === 'meta' ? meta(c) : mock)

/** Handtekening van een webhook: sha256=<hex> over de ruwe body met het webhookgeheim. */
export function tekenWebhook(body: string, geheim: string) { return `sha256=${createHmac('sha256', geheim).update(body).digest('hex')}` }
export function controleerWebhook(body: string, kop: string | null | undefined, geheim: string | null | undefined): boolean {
  if (!kop || !geheim) return false
  const a = Buffer.from(tekenWebhook(body, geheim)); const b = Buffer.from(kop)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Statussen en opt-outs uit een webhook in het Meta-formaat (entry[].changes[].value). Een STOP-bericht telt als opt-out. */
export function ontvangStatus(body: any): WaStatus[] {
  const uit: WaStatus[] = []
  for (const e of body?.entry ?? []) for (const ch of e?.changes ?? []) {
    const v = ch?.value ?? {}
    for (const s of v.statuses ?? []) uit.push({ externId: String(s.id ?? ''), status: ({ sent: 'verzonden', delivered: 'afgeleverd', read: 'gelezen', failed: 'mislukt' } as const)[s.status as 'sent'] ?? null, optOut: false, nummer: s.recipient_id ? `+${s.recipient_id}` : null })
    for (const m of v.messages ?? []) {
      const tekst = String(m?.text?.body ?? m?.button?.text ?? '').trim().toLowerCase()
      if (/^(stop|afmelden|uitschrijven)$/.test(tekst)) uit.push({ externId: String(m.id ?? ''), status: null, optOut: true, nummer: m.from ? `+${m.from}` : null })
    }
  }
  return uit
}
