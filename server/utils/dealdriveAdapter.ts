// DealDrive-koppeling (B21, docs/api/dealdrive-koppeling.md). De interface uit hoofdstuk 7:
// overdragen, zoekAccount, status en ping. Uitvoeringen: 'mock' (de fixtures uit seed/dealdrive-mock,
// standaard lokaal en in tests) en 'http' (P23: ondertekend volgens hoofdstuk 2, met idempotentie).
// Met de stand 'uit' wordt de adapter niet aangeroepen. Logs bewaren geen body, alleen ids en een hash.
import { createHash } from 'node:crypto'
import { normaliseerNaam } from '../../shared/ontdubbelen'
import { foutNaarMelding, isTijdelijk, naarContract, tekenVerzoek } from '../../shared/dealdrive'

export interface DealDriveTreffer { accountId: string; naam: string; soort: 'klant' | 'prospect'; eigenaar?: string; zekerheid: 'kvk' | 'domein' | 'naam'; laatsteContact?: string | null }
export interface ZoekVraag { kvk?: string | null; domein?: string | null; naam?: string | null }

export type DealDriveStand = 'uit' | 'mock' | 'http'
export type OverdrachtAntwoord =
  | { ok: true; status: 200 | 201; accountId: string; dealId: string; url: string; bevestigd: boolean; eigenaar?: string | null }
  | { ok: false; code: 'al_klant'; accountId: string; bericht: string }
  | { ok: false; code: 'fout'; bericht: string; tijdelijk: boolean; foutcode?: string }
export type OverdrachtStand = { gevonden: true; status: string; accountId: string | null; dealId: string | null; url: string | null } | { gevonden: false }
export interface DealDriveKoppeling {
  overdragen(pakket: Record<string, any>): Promise<OverdrachtAntwoord>
  zoekAccount?(q: ZoekVraag): Promise<DealDriveTreffer[]>
  status?(overdrachtId: string): Promise<OverdrachtStand>
  ping?(): Promise<{ ok: true; versie?: string } | { ok: false; melding: string }>
}
export interface DealDriveConfig { basisUrl: string; organisatieId: string; geheim: string }

// ── Mock (fixtures uit seed/dealdrive-mock, hier ingebouwd zodat de serverbundel geen bestanden leest) ──
const MOCK_PROSPECT: DealDriveTreffer = { accountId: 'acc_dd_5520', naam: 'Testbrontsma Installatietechniek', soort: 'prospect', eigenaar: 'eva.dijkstra@voltvast.test', zekerheid: 'kvk', laatsteContact: '2026-06-11' }
const MOCK_KLANT: DealDriveTreffer = { accountId: 'acc_dd_1200', naam: 'Testklant Kabelwerk', soort: 'klant', eigenaar: 'jan.wolters@voltvast.test', zekerheid: 'kvk' }
const MOCK_ANTWOORD = { accountId: 'acc_dd_5520', dealId: 'deal_dd_9041', url: 'https://dealdrive.test/accounts/acc_dd_5520', eigenaar: 'eva.dijkstra@voltvast.test' }

export function mockZoek(q: ZoekVraag): DealDriveTreffer[] {
  const n = q.naam ? normaliseerNaam(q.naam) : ''
  if (q.kvk === '99123456' || n.includes('testbrontsma')) return [{ ...MOCK_PROSPECT, zekerheid: q.kvk === '99123456' ? 'kvk' : 'naam' }]
  if (q.kvk === '99777777' || n.includes('testklant kabelwerk')) return [{ ...MOCK_KLANT, zekerheid: q.kvk === '99777777' ? 'kvk' : 'naam' }]
  return []
}

/** Wat de mock al ontving (per idempotentiesleutel): een tweede verzending geeft 200 en maakt niets nieuws. */
export const mockOntvangen = new Map<string, { accountId: string; dealId: string }>()

/** De mock: kent de klanten van de organisatie (naam en KvK) om al_klant te kunnen geven. */
export function mockKoppeling(klanten: { naam: string; kvk?: string | null }[]): DealDriveKoppeling {
  return {
    async overdragen(p) {
      const body = naarContract(p) as any
      const naam = normaliseerNaam(String(body.account?.naam ?? ''))
      const kvk = body.account?.kvkNummer ?? null
      const klant = klanten.find((k) => (kvk && k.kvk === kvk) || normaliseerNaam(k.naam) === naam)
      if (klant && !body.alsNieuweKansBijKlant) return { ok: false, code: 'al_klant', accountId: MOCK_KLANT.accountId, bericht: foutNaarMelding('al_klant') }
      const sleutel = String(body.overdrachtId)
      const herhaald = mockOntvangen.has(sleutel)
      if (!herhaald) mockOntvangen.set(sleutel, { accountId: MOCK_ANTWOORD.accountId, dealId: MOCK_ANTWOORD.dealId })
      // Bevestigd wordt hij pas met de terugmelding overdracht.verwerkt (of de stand-opvraag).
      return { ok: true, status: herhaald ? 200 : 201, ...MOCK_ANTWOORD, bevestigd: false }
    },
    async zoekAccount(q) { return mockZoek(q) },
    async status(id) { return mockOntvangen.has(id) ? { gevonden: true, status: 'ontvangen', accountId: MOCK_ANTWOORD.accountId, dealId: MOCK_ANTWOORD.dealId, url: MOCK_ANTWOORD.url } : { gevonden: false } },
    async ping() { return { ok: true, versie: 'mock' } },
  }
}

// ── Http (hoofdstuk 2) ──────────────────────────────────────────────────────
/** De basis-URL van DealDrive met het pad van de koppeling; een volledige URL met /v1 blijft zoals hij is. */
export function koppelingsUrl(basisUrl: string): string {
  const b = basisUrl.trim().replace(/\/+$/, '')
  return /\/v\d+$/.test(b) ? b : `${b}/api/koppelingen/dealtrace/v1`
}
export const bodyHash = (body: string) => createHash('sha256').update(body).digest('hex').slice(0, 16)

type Haal = typeof fetch
export function httpKoppeling(cfg: DealDriveConfig, opties: { fetch?: Haal; timeoutMs?: number; nu?: () => Date } = {}): DealDriveKoppeling {
  const basis = koppelingsUrl(cfg.basisUrl)
  const haal = opties.fetch ?? fetch
  async function verzoek(methode: 'GET' | 'POST', pad: string, body?: string, idempotentie?: string): Promise<{ status: number | null; json: any }> {
    const tekst = body ?? ''
    const tijd = Math.floor((opties.nu?.() ?? new Date()).getTime() / 1000)
    const headers: Record<string, string> = {
      'X-Koppeling-Tijd': String(tijd), 'X-Koppeling-Handtekening': tekenVerzoek(tekst, cfg.geheim, tijd), 'X-Koppeling-Organisatie': cfg.organisatieId, accept: 'application/json',
    }
    if (body != null) headers['content-type'] = 'application/json'
    if (idempotentie) headers['Idempotentie-Sleutel'] = idempotentie
    try {
      const r = await haal(`${basis}${pad}`, { method: methode, headers, body: body ?? undefined, signal: AbortSignal.timeout(opties.timeoutMs ?? 10_000) })
      let json: any = null
      try { json = await r.json() } catch { json = null }
      return { status: r.status, json }
    } catch {
      return { status: null, json: null }
    }
  }
  const fout = (r: { status: number | null; json: any }): OverdrachtAntwoord => {
    const code = r.json?.fout?.code ?? (r.status == null ? null : r.status >= 500 ? 'interne_fout' : null)
    const bericht = r.status == null ? 'DealDrive is niet bereikbaar. Dealtrace probeert het later opnieuw.' : foutNaarMelding(code, r.json?.fout?.velden)
    return { ok: false, code: 'fout', bericht, tijdelijk: isTijdelijk(r.status), foutcode: code ?? undefined }
  }
  return {
    async overdragen(p) {
      let body: string
      try { body = JSON.stringify(naarContract(p)) } catch (e: any) { return { ok: false, code: 'fout', bericht: foutNaarMelding('ongeldige_invoer', e?.velden), tijdelijk: false, foutcode: 'ongeldige_invoer' } }
      const r = await verzoek('POST', '/overdrachten', body, String(p.overdrachtId))
      if ((r.status === 200 || r.status === 201) && r.json?.dealdrive?.accountId) {
        const d = r.json.dealdrive
        return { ok: true, status: r.status, accountId: d.accountId, dealId: d.dealId ?? '', url: d.url ?? '', eigenaar: d.eigenaar ?? null, bevestigd: false }
      }
      if (r.status === 409 && r.json?.fout?.code === 'al_klant') return { ok: false, code: 'al_klant', accountId: r.json.fout.accountId ?? '', bericht: foutNaarMelding('al_klant') }
      return fout(r)
    },
    async zoekAccount(q) {
      const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
      const r = await verzoek('GET', `/accounts/zoek?${params}`)
      if (r.status !== 200) throw new Error(r.status == null ? 'DealDrive is niet bereikbaar' : foutNaarMelding(r.json?.fout?.code))
      return (r.json?.treffers ?? []) as DealDriveTreffer[]
    },
    async status(id) {
      const r = await verzoek('GET', `/overdrachten/${encodeURIComponent(id)}`)
      if (r.status === 404) return { gevonden: false }
      if (r.status !== 200) throw new Error(r.status == null ? 'DealDrive is niet bereikbaar' : foutNaarMelding(r.json?.fout?.code))
      return { gevonden: true, status: String(r.json?.status ?? ''), accountId: r.json?.dealdrive?.accountId ?? null, dealId: r.json?.dealdrive?.dealId ?? null, url: r.json?.dealdrive?.url ?? null }
    },
    async ping() {
      const r = await verzoek('GET', '/ping')
      if (r.status === 200 && r.json?.status === 'ok') return { ok: true, versie: r.json.versie }
      return { ok: false, melding: r.status == null ? 'DealDrive is niet bereikbaar op dit adres.' : foutNaarMelding(r.json?.fout?.code) }
    },
  }
}

export function koppelingVoor(stand: DealDriveStand, klanten: { naam: string; kvk?: string | null }[], cfg?: DealDriveConfig | null): DealDriveKoppeling | null {
  if (stand === 'uit') return null
  if (stand === 'mock') return mockKoppeling(klanten)
  if (!cfg?.basisUrl || !cfg.geheim || !cfg.organisatieId) return { async overdragen() { return { ok: false, code: 'fout', bericht: 'De DealDrive-koppeling is niet volledig ingericht. Vraag de founder de basis-URL, het organisatie-id en het geheim in te vullen.', tijdelijk: false } } }
  return httpKoppeling(cfg)
}
