// KvK-adapter (12, Bijlage B): zoeken, basisprofiel, vestigingsprofiel en mutaties.
// Uitvoeringen: 'mock' (vaste fixtures, standaard lokaal en in tests, geen netwerk) en
// 'http' (KvK API met de sleutel als header). De sleutel komt eerst van de organisatie
// (koppelingen, versleuteld), anders van het platform (open vraag 6), met het plafond per
// pakket. Elke aanroep staat in koppeling_runs en telt in lead_verbruik; het basisprofiel
// is 30 dagen gecachet per KvK-nummer.
import { and, eq, sql } from 'drizzle-orm'
import { GRENZEN, KVK_PER_PAKKET } from '../../../shared/leadGenerator'
import type { Pakket } from '../../../shared/types'
import { schema } from '../db'
import { ontsleutel } from '../geheimen'
import { MOCK_BEDRIJVEN, type MockBedrijf } from './kvkMock'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]

export interface KvkProfiel {
  kvk: string; naam: string; plaats: string | null; postcode: string | null; adres: string | null; lat: number | null; lng: number | null
  sbi: { code: string; omschrijving: string }[]; medewerkers: number | null; website: string | null; telefoon: string | null
}
export interface KvkResultaat { kvk: string; naam: string; plaats: string | null; postcode: string | null }
export interface KvkVraag { naam?: string; kvk?: string; plaats?: string; postcode?: string; sbi?: string[] }
export interface KvkMutatie { kvk: string; tekst: string; op: string }

export class KvkFout extends Error {
  constructor(public statusCode: number, bericht: string) { super(bericht) }
}

export const kvkModus = (): 'mock' | 'http' => (process.env.KVK_MODUS === 'http' ? 'http' : 'mock')
const BASIS = () => process.env.KVK_URL || 'https://api.kvk.nl/api'
const MAAND = (nu = new Date()) => nu.toISOString().slice(0, 7)

// ── Uitvoeringen ──────────────────────────────────────────────────────────────

const profielVan = (m: MockBedrijf): KvkProfiel => ({ kvk: m.kvk, naam: m.naam, plaats: m.plaats, postcode: m.postcode, adres: m.adres, lat: m.lat, lng: m.lng, sbi: m.sbi, medewerkers: m.medewerkers, website: m.website, telefoon: m.telefoon })
const schoon = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const mock = {
  test(sleutel: string): string | null {
    if (/^verlopen/i.test(sleutel)) return 'De KvK-sleutel is verlopen. Vraag een nieuwe aan bij KvK en plak hem hier.'
    if (sleutel.trim().length < 8) return 'Deze KvK-sleutel klopt niet. Kopieer hem opnieuw uit het KvK-portaal.'
    return null
  },
  zoek(q: KvkVraag): KvkResultaat[] {
    return MOCK_BEDRIJVEN.filter((m) =>
      (!q.kvk || m.kvk === q.kvk.replace(/\D/g, ''))
      && (!q.naam || schoon(m.naam).includes(schoon(q.naam)))
      && (!q.plaats || schoon(m.plaats) === schoon(q.plaats))
      && (!q.postcode || m.postcode.replace(/\s/g, '').startsWith(q.postcode.replace(/\s/g, '').toUpperCase()))
      && (!q.sbi?.length || m.sbi.some((s) => q.sbi!.some((w) => s.code.startsWith(w)))),
    ).map((m) => ({ kvk: m.kvk, naam: m.naam, plaats: m.plaats, postcode: m.postcode }))
  },
  basisprofiel(kvk: string): KvkProfiel | null {
    const m = MOCK_BEDRIJVEN.find((x) => x.kvk === kvk)
    return m ? profielVan(m) : null
  },
  mutaties(kvks: string[], sinds: Date): KvkMutatie[] {
    return MOCK_BEDRIJVEN.filter((m) => m.mutatie && kvks.includes(m.kvk)).map((m) => ({ kvk: m.kvk, tekst: m.mutatie!, op: new Date(sinds.getTime() + 864e5).toISOString() }))
  },
}

async function haal(pad: string, sleutel: string): Promise<any> {
  const res = await fetch(`${BASIS()}${pad}`, { headers: { apikey: sleutel }, signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!res) throw new KvkFout(503, 'KvK is nu niet bereikbaar. Probeer het straks opnieuw.')
  if (res.status === 401 || res.status === 403) throw new KvkFout(400, 'De KvK-sleutel is verlopen of klopt niet. Vraag een nieuwe aan bij KvK en plak hem hier.')
  if (res.status === 404) return null
  if (!res.ok) throw new KvkFout(503, `KvK antwoordde met ${res.status}. Probeer het straks opnieuw.`)
  return res.json()
}
const http = {
  async test(sleutel: string) {
    try { await haal('/v2/zoeken?naam=test&resultatenPerPagina=1', sleutel); return null } catch (e) { return (e as Error).message }
  },
  async zoek(q: KvkVraag, sleutel: string): Promise<KvkResultaat[]> {
    const p = new URLSearchParams({ resultatenPerPagina: '25' })
    if (q.naam) p.set('naam', q.naam)
    if (q.kvk) p.set('kvkNummer', q.kvk.replace(/\D/g, ''))
    if (q.plaats) p.set('plaats', q.plaats)
    if (q.postcode) p.set('postcode', q.postcode.replace(/\s/g, ''))
    const r = await haal(`/v2/zoeken?${p}`, sleutel)
    return (r?.resultaten ?? []).map((x: any) => ({ kvk: x.kvkNummer, naam: x.naam, plaats: x.adres?.binnenlandsAdres?.plaats ?? null, postcode: x.adres?.binnenlandsAdres?.postcode ?? null }))
  },
  async basisprofiel(kvk: string, sleutel: string): Promise<KvkProfiel | null> {
    const r = await haal(`/v1/basisprofielen/${kvk}?geoData=true`, sleutel)
    if (!r) return null
    const adres = r._embedded?.hoofdvestiging?.adressen?.[0]
    return {
      kvk: r.kvkNummer, naam: r.naam, plaats: adres?.plaats ?? null, postcode: adres?.postcode ?? null,
      adres: adres ? [adres.straatnaam, adres.huisnummer].filter(Boolean).join(' ') : null,
      lat: adres?.geoData?.gpsLatitude ?? null, lng: adres?.geoData?.gpsLongitude ?? null,
      sbi: (r.sbiActiviteiten ?? []).map((s: any) => ({ code: s.sbiCode, omschrijving: s.sbiOmschrijving })),
      medewerkers: r.totaalWerkzamePersonen ?? null, website: r._embedded?.hoofdvestiging?.websites?.[0] ? `https://${String(r._embedded.hoofdvestiging.websites[0]).replace(/^https?:\/\//, '')}` : null, telefoon: null,
    }
  },
}

// ── Sleutel, plafond, log en verbruik ─────────────────────────────────────────

export interface KvkContext { sleutel: string; bron: 'organisatie' | 'platform'; plafond: number; gebruikt: number; koppelingId: string | null }

/** De stand van de KvK-koppeling zonder de sleutel zelf (voor schermen en GET-endpoints). */
export async function kvkStatus(tx: Tx, pakket: Pakket, nu = new Date()) {
  const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'kvk'))
  const [v] = await tx.select().from(schema.leadVerbruik).where(and(eq(schema.leadVerbruik.maand, MAAND(nu)), eq(schema.leadVerbruik.soort, 'kvk')))
  const eigen = !!k?.geheimen && k.status === 'actief'
  const platform = !!process.env.KVK_PLATFORM_SLEUTEL
  const pakketPlafond = KVK_PER_PAKKET[pakket]
  const plafond = Math.min(pakketPlafond, k?.instellingen?.plafond ?? pakketPlafond)
  return {
    gekoppeld: (eigen || platform) && pakketPlafond > 0, sleutelBestaat: !!k?.geheimen, bron: eigen ? 'organisatie' as const : platform ? 'platform' as const : null,
    status: k?.status ?? 'uit', fout: k?.instellingen?.laatsteFout ?? null, getestOp: k?.getestOp ?? null, plafond, pakketPlafond, gebruikt: v?.aantal ?? 0,
  }
}

export async function kvkContext(tx: Tx, pakket: Pakket): Promise<KvkContext | null> {
  const s = await kvkStatus(tx, pakket)
  if (!s.gekoppeld) return null
  const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'kvk'))
  const eigen = s.bron === 'organisatie' ? ontsleutel(k?.geheimen)?.sleutel : null
  const sleutel = eigen ?? process.env.KVK_PLATFORM_SLEUTEL
  if (!sleutel) return null
  return { sleutel, bron: eigen ? 'organisatie' : 'platform', plafond: s.plafond, gebruikt: s.gebruikt, koppelingId: k?.id ?? null }
}

async function tel(tx: Tx, org: string, aantal: number, nu = new Date()) {
  if (!aantal) return
  await tx.execute(sql`insert into lead_verbruik (organisation_id, maand, soort, aantal) values (${org}, ${MAAND(nu)}, 'kvk', ${aantal})
    on conflict (organisation_id, maand, soort) do update set aantal = lead_verbruik.aantal + excluded.aantal`)
}
async function log(tx: Tx, org: string, ctx: KvkContext | null, handeling: string, gelezen: number, fout?: string) {
  await tx.insert(schema.koppelingRuns).values({ organisationId: org, koppelingId: ctx?.koppelingId ?? null, soort: 'kvk', handeling, eind: new Date().toISOString(), gelezen, fouten: fout ? [fout] : [] })
}

/** Telt één bevraging en weigert boven het plafond. */
async function bevraging(tx: Tx, org: string, ctx: KvkContext) {
  if (ctx.gebruikt >= ctx.plafond) throw new KvkFout(429, 'Het KvK-plafond van deze maand is bereikt.')
  ctx.gebruikt++
  await tel(tx, org, 1)
}

export async function testSleutel(sleutel: string): Promise<string | null> {
  return kvkModus() === 'mock' ? mock.test(sleutel) : http.test(sleutel)
}

export async function kvkZoek(tx: Tx, org: string, ctx: KvkContext, q: KvkVraag): Promise<KvkResultaat[]> {
  await bevraging(tx, org, ctx)
  try {
    const r = kvkModus() === 'mock' ? mock.zoek(q) : await http.zoek(q, ctx.sleutel)
    await log(tx, org, ctx, 'zoeken', r.length)
    return r.slice(0, GRENZEN.bedrijvenPerRonde)
  } catch (e) { await log(tx, org, ctx, 'zoeken', 0, (e as Error).message); throw e }
}

/** Basisprofiel uit de cache (30 dagen) of van KvK; een cachetreffer kost geen bevraging. */
export async function kvkProfiel(tx: Tx, org: string, ctx: KvkContext, kvk: string): Promise<KvkProfiel | null> {
  const nr = kvk.replace(/\D/g, '')
  const [c] = await tx.select().from(schema.kvkCache).where(eq(schema.kvkCache.kvk, nr))
  if (c && Date.now() - Date.parse(c.opgehaaldOp) < GRENZEN.kvkCacheDagen * 864e5) return c.profiel
  await bevraging(tx, org, ctx)
  try {
    const p = kvkModus() === 'mock' ? mock.basisprofiel(nr) : await http.basisprofiel(nr, ctx.sleutel)
    await log(tx, org, ctx, 'basisprofiel', p ? 1 : 0)
    if (p) await tx.insert(schema.kvkCache).values({ kvk: nr, profiel: p, opgehaaldOp: new Date().toISOString() }).onConflictDoUpdate({ target: schema.kvkCache.kvk, set: { profiel: p, opgehaaldOp: new Date().toISOString() } })
    return p
  } catch (e) { await log(tx, org, ctx, 'basisprofiel', 0, (e as Error).message); throw e }
}

/** Wijzigingen in het register sinds een datum, voor accounts in reis (SR23). */
export async function kvkMutaties(tx: Tx, org: string, ctx: KvkContext, kvks: string[], sinds: Date): Promise<KvkMutatie[]> {
  if (!kvks.length) return []
  await bevraging(tx, org, ctx)
  // De echte mutatieservice is een abonnement bij KvK; tot dat besloten is vergelijkt http het profiel.
  const r = kvkModus() === 'mock' ? mock.mutaties(kvks, sinds) : []
  await log(tx, org, ctx, 'mutaties', r.length)
  return r
}
