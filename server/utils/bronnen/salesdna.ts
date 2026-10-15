// Adapter voor SalesDNA (P29, 13.5). Echt en mock met dezelfde interface: ping, haalSublagen,
// haalSublaag. Het adres "mock" (of "mock:testgevallen") gebruikt de fixtures uit seed/webhooks;
// lokaal en in tests is er geen SalesDNA-omgeving en geen netwerk nodig.
// Route aan de kant van SalesDNA (voorstel, af te stemmen): GET {adres}/api/koppelingen/dealtrace/
// sublagen[/:onderwerpId] en /ping, met X-Dealtrace-Tijd en een HMAC over "tijd\npad".
import { createHmac } from 'node:crypto'
import l01 from '../../../seed/webhooks/L0.1-bedrijfsverhaal.bevestigd.json'
import l02 from '../../../seed/webhooks/L0.2-ambitie-visie.bevestigd.json'
import l04 from '../../../seed/webhooks/L0.4-waarde-belofte.bevestigd.json'
import l06 from '../../../seed/webhooks/L0.6-branches.bevestigd.json'
import l08 from '../../../seed/webhooks/L0.8-concurrenten.bevestigd.json'
import l08v from '../../../seed/webhooks/L0.8-concurrenten.verouderd.json'
import l21 from '../../../seed/webhooks/L2.1-winpunten.bevestigd.json'
import l314 from '../../../seed/webhooks/L3.14-hercontact-ritme.bevestigd.json'
import l04v3 from '../../../seed/webhooks/testgevallen/L0.4-waarde-belofte-v3-blok.bevestigd.json'
import l06v2 from '../../../seed/webhooks/testgevallen/L0.6-branches-v2-hernoemd.bevestigd.json'

export interface SublaagBericht { eventId: string; soort: string; tijd?: string; onderwerpId: string; titel?: string; versie: number; status?: string; verouderd?: boolean; verouderdDoor?: unknown; bevestigdOp?: string; bijgewerktOp?: string; inhoud?: any; context?: any; reden?: string }
export interface SalesdnaBron {
  ping(): Promise<{ ok: true } | { ok: false; reden: string }>
  haalSublagen(): Promise<SublaagBericht[]>
  haalSublaag(onderwerpId: string): Promise<SublaagBericht | null>
}

const body = (f: any) => structuredClone(f.body) as SublaagBericht
/** De basisset (Bijlage C) en de testset met br-02 hernoemd en een gewijzigd blok in L0.4. */
export const MOCK_FIXTURES = {
  basis: [l01, l02, l04, l06, l08, l21, l314].map(body),
  testgevallen: [l01, l02, l04v3, l06v2, l08, l21, l314].map(body),
  verouderd: { l08: body(l08v) },
  los: { l04v3: body(l04v3), l06v2: body(l06v2) },
}
/** Mock-overrides voor tests: per onderwerp een andere versie, of null voor "bestaat niet". */
export const mockOverrides = new Map<string, SublaagBericht | null>()

function mock(set: 'basis' | 'testgevallen'): SalesdnaBron {
  const alle = () => {
    const lijst = MOCK_FIXTURES[set].map((b) => mockOverrides.has(b.onderwerpId) ? mockOverrides.get(b.onderwerpId)! : b).filter(Boolean) as SublaagBericht[]
    for (const [k, v] of mockOverrides) if (v && !lijst.some((b) => b.onderwerpId === k)) lijst.push(v)
    return lijst.map((b) => structuredClone(b))
  }
  return {
    ping: async () => ({ ok: true }),
    haalSublagen: async () => alle(),
    haalSublaag: async (id) => alle().find((b) => b.onderwerpId === id) ?? null,
  }
}

function echt(adres: string, geheim: string): SalesdnaBron {
  const basis = adres.replace(/\/+$/, '')
  async function haal(pad: string) {
    const tijd = new Date().toISOString()
    const r = await fetch(`${basis}${pad}`, {
      headers: { 'X-Dealtrace-Tijd': tijd, 'X-Dealtrace-Signature': `sha256=${createHmac('sha256', geheim).update(`${tijd}\n${pad}`).digest('hex')}`, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (r.status === 401 || r.status === 403) throw new Error('SalesDNA weigert de handtekening. Controleer het geheim en koppel opnieuw.')
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`SalesDNA antwoordt met fout ${r.status}. Probeer het later opnieuw.`)
    return r.json()
  }
  return {
    async ping() {
      try { const j: any = await haal('/api/koppelingen/dealtrace/ping'); return j?.soort === 'ping' || j?.ok ? { ok: true } : { ok: false, reden: 'SalesDNA antwoordde, maar niet met ping. Klopt het adres?' } } catch (e: any) {
        return { ok: false, reden: /fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(String(e?.message ?? e)) ? 'SalesDNA is niet bereikbaar op dit adres.' : String(e?.message ?? 'Onbekende fout') }
      }
    },
    async haalSublagen() { const j: any = await haal('/api/koppelingen/dealtrace/sublagen'); return (j?.sublagen ?? j ?? []) as SublaagBericht[] },
    async haalSublaag(id) { return (await haal(`/api/koppelingen/dealtrace/sublagen/${encodeURIComponent(id)}`)) as SublaagBericht | null },
  }
}

export const isMockAdres = (adres: string) => /^mock(:|$)/.test(adres.trim())
export function salesdnaBron(adres: string, geheim: string): SalesdnaBron {
  if (isMockAdres(adres)) return mock(adres.trim() === 'mock:testgevallen' ? 'testgevallen' : 'basis')
  return echt(adres, geheim)
}
