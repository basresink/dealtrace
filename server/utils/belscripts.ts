// Belscripts op de server (F08): opslaan, activeren als nieuwe versie, persoonlijke varianten,
// resultaten per versie en de AI-invulling per account (via de Bewaker en de AI-schil).
import { eq, sql } from 'drizzle-orm'
import { uitkomstNaarCode, type KnopSleutel } from '../../shared/belblokken'
import { valideerScript, variabelenVan, type Belscript, type ScriptData } from '../../shared/belscripts'
import { schema } from './db'
import { verkoopverhaal } from './reis'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = typeof schema.belscripts.$inferSelect

export function naarScript(r: Rij): Belscript & { controleren: boolean; startset: string | null; bijgewerktOp: string } {
  return { id: r.id, naam: r.naam, doel: r.doel as any, status: r.status as any, versie: r.versie, eigenaarId: r.eigenaarId, basisScriptId: r.basisScriptId, isPersoonlijk: r.isPersoonlijk, gebruikerId: r.gebruikerId, data: r.data, controleren: r.controleren, startset: r.startset, bijgewerktOp: r.updatedAt }
}

/** Validatie met de winpunten en concurrenten van de organisatie. */
export async function valideerVoorOrg(tx: Tx, s: Pick<Belscript, 'naam' | 'doel' | 'data'>, activeren = false) {
  const vv = await verkoopverhaal(tx)
  return valideerScript(s, { activeren, winpuntIds: (vv.winpunten ?? []).filter((w) => w.actief).map((w) => w.id), concurrentIds: vv.concurrenten.map((c) => c.id) })
}

/** Normaliseert wat uit de editor komt: alleen bekende velden, variabelen afgeleid. */
export function schoonData(d: any, basis?: ScriptData): ScriptData {
  const lijst = (x: unknown) => (Array.isArray(x) ? x.map(String).slice(0, 50) : [])
  const data: ScriptData = {
    reisfaseIds: lijst(d?.reisfaseIds ?? basis?.reisfaseIds), doelgroepIds: d?.doelgroepIds === 'alle' || d?.doelgroepIds === undefined ? (basis?.doelgroepIds ?? 'alle') : lijst(d.doelgroepIds),
    teamIds: d?.teamIds === 'alle' || d?.teamIds === undefined ? (basis?.teamIds ?? 'alle') : lijst(d.teamIds), contactRollen: lijst(d?.contactRollen ?? basis?.contactRollen),
    kanaal: ['vast', 'mobiel', 'beide'].includes(d?.kanaal) ? d.kanaal : basis?.kanaal ?? 'beide',
    standaardVoor: { campagnesoorten: lijst(d?.standaardVoor?.campagnesoorten ?? basis?.standaardVoor.campagnesoorten), belblokIds: lijst(d?.standaardVoor?.belblokIds ?? basis?.standaardVoor.belblokIds) },
    blokken: (Array.isArray(d?.blokken) ? d.blokken : basis?.blokken ?? []).slice(0, 30).map((b: any, i: number) => ({
      id: String(b.id || `b${i + 1}`), soort: b.soort, titel: b.titel ? String(b.titel).slice(0, 80) : undefined, tekst: String(b.tekst ?? '').slice(0, 2000),
      invulwijze: ['vast', 'ai_aanvullen', 'ai_schrijven'].includes(b.invulwijze) ? b.invulwijze : 'vast', veldKoppeling: b.veldKoppeling ?? null, terugval: b.terugval ? String(b.terugval).slice(0, 500) : null,
    })),
    bezwaren: (Array.isArray(d?.bezwaren) ? d.bezwaren : basis?.bezwaren ?? []).slice(0, 30).map((z: any, i: number) => ({ id: String(z.id || `bz${i + 1}`), bezwaar: String(z.bezwaar ?? '').slice(0, 300), antwoord: String(z.antwoord ?? '').slice(0, 1000), wedervraag: z.wedervraag ? String(z.wedervraag).slice(0, 300) : undefined, argumentRef: z.argumentRef ?? null })),
    opmerking: d?.opmerking ? String(d.opmerking).slice(0, 1000) : basis?.opmerking,
  }
  data.variabelen = variabelenVan(data)
  if (d?.basisVersie != null || (basis as any)?.basisVersie != null) (data as any).basisVersie = d?.basisVersie ?? (basis as any)?.basisVersie
  return data
}

/** Activeer: een nieuwe versie; lopende blokken houden de versie waarmee ze startten. */
export async function activeer(tx: Tx, id: string, door: string) {
  const [r] = await tx.select().from(schema.belscripts).where(eq(schema.belscripts.id, id))
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
  const v = await valideerVoorOrg(tx, naarScript(r), true)
  if (v.fouten.length) throw createError({ statusCode: 422, statusMessage: v.fouten[0]!, data: v })
  const versie = r.versie + 1
  await tx.insert(schema.belscriptVersies).values({ organisationId: r.organisationId, belscriptId: id, versie, naam: r.naam, doel: r.doel, data: r.data, geactiveerdDoor: door })
  await tx.update(schema.belscripts).set({ status: 'actief', versie, controleren: v.controleren, updatedAt: new Date().toISOString() }).where(eq(schema.belscripts.id, id))
  return { id, versie, waarschuwingen: v.waarschuwingen, controleren: v.controleren }
}

/** Per script en versie: gesprekken, bereikt, afspraken en gemiddelde duur (laatste 90 dagen). */
export async function scriptResultaten(tx: Tx, dagen = 90) {
  const rijen = (await tx.execute(sql`select data->'script'->>'scriptId' as script_id, (data->'script'->>'versie')::int as versie, data->>'belknop' as knop, uitkomst, (data->>'duurSec')::int as duur
    from activiteiten where data ? 'script' and op >= ${new Date(Date.now() - dagen * 864e5).toISOString()}`)).rows as { script_id: string; versie: number; knop: string | null; uitkomst: string | null; duur: number | null }[]
  const per = new Map<string, { scriptId: string; versie: number; gesprekken: number; bereikt: number; afspraken: number; duur: number }>()
  for (const r of rijen) {
    const k = `${r.script_id}|${r.versie}`
    const x = per.get(k) ?? { scriptId: r.script_id, versie: r.versie, gesprekken: 0, bereikt: 0, afspraken: 0, duur: 0 }
    x.gesprekken++
    if (r.knop ? uitkomstNaarCode(r.knop as KnopSleutel)?.bereikt : ['afspraak', 'later', 'niet_geschikt', 'geen_interesse'].includes(r.uitkomst ?? '')) x.bereikt++
    if (r.uitkomst === 'afspraak') x.afspraken++
    x.duur += r.duur ?? 0
    per.set(k, x)
  }
  return [...per.values()].map((x) => ({ ...x, gemiddeldeDuurSec: x.gesprekken ? Math.round(x.duur / x.gesprekken) : 0 }))
}

/** Gebruikt in 30 dagen per script (alle versies). */
export async function gebruikt30(tx: Tx): Promise<Map<string, number>> {
  const rijen = (await tx.execute(sql`select data->'script'->>'scriptId' as id, count(*)::int as n from activiteiten where data ? 'script' and op >= ${new Date(Date.now() - 30 * 864e5).toISOString()} group by 1`)).rows as { id: string; n: number }[]
  return new Map(rijen.map((r) => [r.id, r.n]))
}
