// Datacollectief-adapter (P15, F02, 12): selecties op doelgroep met contactpersonen en verrijking
// van een bedrijf. Zelfde vorm als kvk.ts. Uitvoeringen 'mock' (standaard, fixtures, geen netwerk)
// en 'http'. De sleutel staat versleuteld in koppelingen; elk opgehaald record telt in
// lead_verbruik (geen AI, buiten de credits) en elke aanroep staat in koppeling_runs. Het plafond
// geldt op de server vóór de aanroep; bij 80 procent krijgt de beheerder één melding per maand.
// Verrijking per KvK-nummer is 30 dagen gecachet per organisatie (kvk_cache met voorvoegsel dc:org:).
import { and, eq, sql } from 'drizzle-orm'
import { DC_KOSTEN_CENT, DC_PER_PAKKET, DC_PLAFOND_TEKST, DC_SLEUTEL_FOUT, DC_TEGOED_OP, GRENZEN, plafondStand, type DcRecord, type DcSelectie } from '../../../shared/leadGenerator'
import type { Pakket } from '../../../shared/types'
import { schema } from '../db'
import { ontsleutel } from '../geheimen'
import { DC_MOCK } from './datacollectiefMock'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]
const MAAND = (nu = new Date()) => nu.toISOString().slice(0, 7)

export class DcFout extends Error {
  constructor(public statusCode: number, bericht: string) { super(bericht) }
}
export const dcModus = (): 'mock' | 'http' => (process.env.DATACOLLECTIEF_MODUS === 'http' ? 'http' : 'mock')
const BASIS = () => process.env.DATACOLLECTIEF_URL || 'https://api.datacollectief.nl'

const mock = {
  test(sleutel: string): { fout: string | null; tegoed?: number } {
    if (/^verlopen/i.test(sleutel)) return { fout: DC_SLEUTEL_FOUT }
    if (/^leeg/i.test(sleutel)) return { fout: DC_TEGOED_OP }
    if (sleutel.trim().length < 8) return { fout: 'Deze Datacollectief-sleutel klopt niet. Kopieer hem opnieuw uit je account bij Datacollectief.' }
    return { fout: null, tegoed: 4800 }
  },
  selectie(s: DcSelectie, max: number): DcRecord[] {
    return DC_MOCK.filter((r) =>
      (!s.sbi.length || (r.sbi ?? []).some((x) => s.sbi.some((w) => x.startsWith(w))))
      && (s.omvang.min == null || (r.medewerkers ?? 0) >= s.omvang.min) && (s.omvang.max == null || (r.medewerkers ?? 0) <= s.omvang.max)
      && (!s.regio.length || s.regio.some((g) => (r.postcode ?? '').startsWith(g) || (r.plaats ?? '').toLowerCase() === g.toLowerCase())),
    ).slice(0, max).map((r) => ({ ...r, contacten: r.contacten }))
  },
  bedrijf(q: { kvk?: string | null; domein?: string | null }): DcRecord | null {
    return DC_MOCK.find((r) => (q.kvk && r.kvk === q.kvk) || (q.domein && r.website?.includes(q.domein))) ?? null
  },
}

async function haal(pad: string, sleutel: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASIS()}${pad}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${sleutel}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) }).catch(() => null)
  if (!res) throw new DcFout(503, 'Datacollectief is nu niet bereikbaar. Probeer het straks opnieuw.')
  if (res.status === 401 || res.status === 403) throw new DcFout(400, DC_SLEUTEL_FOUT)
  if (res.status === 402) throw new DcFout(402, DC_TEGOED_OP)
  if (res.status === 404) return null
  if (!res.ok) throw new DcFout(503, `Datacollectief antwoordde met ${res.status}. Probeer het straks opnieuw.`)
  return res.json()
}
// De echte API wordt afgestemd met het contract (open vraag 5); tot dan dezelfde vorm als de mock.
const http = {
  async test(sleutel: string) { try { const r = await haal('/v1/account', sleutel); return { fout: null, tegoed: r?.tegoed ?? undefined } } catch (e) { return { fout: (e as Error).message } } },
  async selectie(s: DcSelectie, max: number, sleutel: string): Promise<DcRecord[]> { return ((await haal('/v1/selecties', sleutel, { ...s, max }))?.records ?? []) as DcRecord[] },
  async bedrijf(q: { kvk?: string | null; domein?: string | null }, sleutel: string): Promise<DcRecord | null> { return (await haal(`/v1/bedrijven?${new URLSearchParams(q.kvk ? { kvk: q.kvk } : { domein: q.domein ?? '' })}`, sleutel)) as DcRecord | null },
}

export async function testSleutel(sleutel: string) { return dcModus() === 'mock' ? mock.test(sleutel) : http.test(sleutel) }

export interface DcContext { sleutel: string; plafond: number; gebruikt: number; koppelingId: string | null }

/** De stand zonder de sleutel (schermen en GET-endpoints). */
export async function dcStatus(tx: Tx, pakket: Pakket, nu = new Date()) {
  const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'datacollectief'))
  const [v] = await tx.select().from(schema.leadVerbruik).where(and(eq(schema.leadVerbruik.maand, MAAND(nu)), eq(schema.leadVerbruik.soort, 'datacollectief')))
  const pakketPlafond = DC_PER_PAKKET[pakket]
  const plafond = Math.min(pakketPlafond, k?.instellingen?.plafond ?? pakketPlafond)
  const runs = k ? await tx.select({ start: schema.koppelingRuns.start, handeling: schema.koppelingRuns.handeling, gelezen: schema.koppelingRuns.gelezen, geschreven: schema.koppelingRuns.geschreven, fouten: schema.koppelingRuns.fouten })
    .from(schema.koppelingRuns).where(eq(schema.koppelingRuns.soort, 'datacollectief')).orderBy(sql`start desc`).limit(5) : []
  return {
    gekoppeld: !!k?.geheimen && k.status === 'actief' && pakketPlafond > 0, sleutelBestaat: !!k?.geheimen, vingerafdruk: k?.instellingen?.vingerafdruk ?? null,
    status: k?.status ?? 'uit', fout: k?.instellingen?.laatsteFout ?? null, tegoed: k?.instellingen?.tegoed ?? null, getestOp: k?.getestOp ?? null,
    plafond, pakketPlafond, gebruikt: v?.aantal ?? 0, runs,
  }
}

export async function dcContext(tx: Tx, pakket: Pakket): Promise<DcContext | null> {
  const s = await dcStatus(tx, pakket)
  if (!s.gekoppeld) return null
  const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'datacollectief'))
  const sleutel = ontsleutel(k?.geheimen)?.sleutel
  return sleutel ? { sleutel, plafond: s.plafond, gebruikt: s.gebruikt, koppelingId: k?.id ?? null } : null
}

/** Tel records (en kosten) en meld de beheerder één keer bij 80 procent. */
async function tel(tx: Tx, org: string, ctx: DcContext, aantal: number, nu = new Date()) {
  if (!aantal) return
  const voor = plafondStand(ctx.gebruikt, ctx.plafond)
  ctx.gebruikt += aantal
  await tx.execute(sql`insert into lead_verbruik (organisation_id, maand, soort, aantal, kosten_cent) values (${org}, ${MAAND(nu)}, 'datacollectief', ${aantal}, ${aantal * DC_KOSTEN_CENT})
    on conflict (organisation_id, maand, soort) do update set aantal = lead_verbruik.aantal + excluded.aantal, kosten_cent = lead_verbruik.kosten_cent + excluded.kosten_cent`)
  const na = plafondStand(ctx.gebruikt, ctx.plafond)
  if (na.waarschuwen && !voor.waarschuwen) {
    const beheerders = (await tx.execute(sql`select id from users where role = 'beheerder' and status = 'actief'`)).rows as { id: string }[]
    for (const b of beheerders) await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${b.id}, 'systeem', 'Datacollectief op 80 procent', ${`${ctx.gebruikt} van ${ctx.plafond} Datacollectief-records zijn deze maand gebruikt.`}, '/leadgenerator?tab=koppelingen', now(), '{}'::jsonb)`)
  }
}
async function log(tx: Tx, org: string, ctx: DcContext | null, handeling: string, gelezen: number, geschreven: number, fout?: string) {
  await tx.insert(schema.koppelingRuns).values({ organisationId: org, koppelingId: ctx?.koppelingId ?? null, soort: 'datacollectief', handeling, eind: new Date().toISOString(), gelezen, geschreven, fouten: fout ? [fout] : [] })
}

/** Een selectie: hooguit wat er binnen het plafond past (en hooguit 25 per ronde); elk record telt. */
export async function dcSelectie(tx: Tx, org: string, ctx: DcContext, s: DcSelectie): Promise<DcRecord[]> {
  const rest = ctx.plafond - ctx.gebruikt
  if (rest <= 0) throw new DcFout(429, DC_PLAFOND_TEKST)
  const max = Math.min(rest, GRENZEN.bedrijvenPerRonde)
  try {
    const r = dcModus() === 'mock' ? mock.selectie(s, max) : await http.selectie(s, max, ctx.sleutel)
    await tel(tx, org, ctx, r.length)
    await log(tx, org, ctx, 'selectie', r.length, 0)
    return r
  } catch (e) { await log(tx, org, ctx, 'selectie', 0, 0, (e as Error).message); throw e }
}

/** Contactpersonen van één bedrijf (op KvK-nummer of domein); elk contact is een record, uit de cache kost niets. */
export async function dcBedrijf(tx: Tx, org: string, ctx: DcContext, q: { kvk?: string | null; domein?: string | null }, max = 5): Promise<DcRecord | null> {
  // Per organisatie: gekochte gegevens gaan nooit gratis naar een andere klant.
  const sleutel = q.kvk ? `dc:${org}:${q.kvk}` : q.domein ? `dc:${org}:${q.domein}` : null
  if (sleutel) {
    const [c] = await tx.select().from(schema.kvkCache).where(eq(schema.kvkCache.kvk, sleutel))
    if (c && Date.now() - Date.parse(c.opgehaaldOp) < GRENZEN.kvkCacheDagen * 864e5) return c.profiel as unknown as DcRecord
  }
  if (ctx.gebruikt >= ctx.plafond) throw new DcFout(429, DC_PLAFOND_TEKST)
  try {
    const r = dcModus() === 'mock' ? mock.bedrijf(q) : await http.bedrijf(q, ctx.sleutel)
    // Elk contactrecord kost tegoed; hooguit max.
    const aantal = r ? Math.max(1, Math.min(max, r.contacten.length)) : 0
    if (aantal && ctx.gebruikt + aantal > ctx.plafond) throw new DcFout(429, DC_PLAFOND_TEKST)
    if (r) r.contacten = r.contacten.slice(0, max)
    await tel(tx, org, ctx, aantal)
    await log(tx, org, ctx, 'bedrijf', aantal, 0)
    if (r && sleutel) await tx.insert(schema.kvkCache).values({ kvk: sleutel, profiel: r as any, opgehaaldOp: new Date().toISOString() }).onConflictDoUpdate({ target: schema.kvkCache.kvk, set: { profiel: r as any, opgehaaldOp: new Date().toISOString() } })
    return r
  } catch (e) { await log(tx, org, ctx, 'bedrijf', 0, 0, (e as Error).message); throw e }
}
