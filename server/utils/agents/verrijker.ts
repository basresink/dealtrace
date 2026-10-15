// De Verrijker (P19, F14, mandaat A): vult het dossier aan uit KvK, de website en wat Dealtrace weet.
// Alleen velden met een bron; een patroon zonder bron is een aanname en nooit een nummer of adres (15.1).
// Hebben alle zes criteria een oordeel, dan meldt hij dossier-compleet. Dossier: 10 credits (11.4).
import { sql } from 'drizzle-orm'
import { DOSSIER_CRITERIA, dossierCompleet, verrijkVelden, type DossierCriterium, type Oordeel } from '../../../shared/agents'
import type { JsonSchema } from '../../../shared/aiStap'
import { MOCK_BEDRIJVEN } from '../bronnen/kvkMock'
import { gebruikDb } from '../db'
import { voerAiStapUit } from '../llm-provider'
import { meldGebeurtenis, ReisFout } from '../reis'
import { logAgentRun, toets } from './bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

const OORDEEL: JsonSchema = { type: 'string', enum: ['ja', 'nee', 'onbekend'] }
export const VERRIJKER_SCHEMA: JsonSchema = {
  type: 'object', required: ['velden', 'criteria'], additionalProperties: false,
  properties: {
    velden: { type: 'array', items: { type: 'object', required: ['veld', 'waarde'], additionalProperties: false, properties: { veld: { type: 'string' }, waarde: { type: 'string', maxLength: 300 }, bron: { type: 'string' }, datum: { type: 'string' }, aanname: { type: 'boolean' } } } },
    criteria: { type: 'object', additionalProperties: false, properties: Object.fromEntries(DOSSIER_CRITERIA.map((k) => [k, OORDEEL])) },
  },
}

/** "Laat opnieuw onderzoeken" of de wekelijkse run: het dossier krijgt de datum van vandaag. */
export async function onderzoekAccount(tx: Tx, org: string, accountId: string, opties: { gebruiker?: any; automatisch?: boolean; nu?: Date } = {}) {
  const nu = opties.nu ?? new Date()
  const [a] = await rijen(tx, sql`select * from accounts where id = ${accountId}`)
  if (!a) throw Object.assign(new Error('Account niet gevonden'), { statusCode: 404, statusMessage: 'Account niet gevonden' })
  // De Bewaker vooraf; een automatische run toetst ook de credits (10 procent van de pot).
  const t = await toets(tx, org, { agent: 'verrijker', handeling: 'dossier', accountId, gebruiker: opties.gebruiker ?? null, ai: opties.automatisch ? 'dossier' : null }, nu)
  if (!t.mag) return { ok: false as const, reden: t.reden }
  const kvk = MOCK_BEDRIJVEN.find((b) => b.kvk === a.kvk) ?? null
  const website = kvk?.pagina && kvk.website ? { url: kvk.website, tekst: kvk.pagina } : null
  const [beslisser] = await rijen(tx, sql`select 1 from contacts where account_id = ${accountId} and rol = 'beslisser' and status <> 'vertrokken' limit 1`)
  const [sig] = await rijen(tx, sql`select title from signals where account_id = ${accountId} and status in ('nieuw', 'gelezen') limit 1`)
  const r = await voerAiStapUit<any>(tx, org, {
    soort: 'dossier', schema: VERRIJKER_SCHEMA, accountId, gebruiker: opties.gebruiker ?? null, ...(opties.automatisch ? { agent: 'verrijker' } : { boekAls: 'verrijker' }),
    prompt: 'Vul het dossier aan. Neem alleen een veld op met de bron waar het staat; een afgeleid patroon markeer je als aanname. Nooit een telefoonnummer of adres zonder bron. Geef per criterium ja, nee of onbekend.',
    materiaal: { verrijker: true, kvk: kvk ? { medewerkers: kvk.medewerkers, sbi: kvk.sbi } : null, website, domein: a.domein, branche: a.vv_branche_id, plaats: a.city, leverancier: a.huidige_leverancier_id, aanleiding: sig?.title ?? null, beslisser: !!beslisser },
  } as any, nu)
  if (!r.ok) {
    await logAgentRun(tx, org, { agent: 'verrijker', handeling: 'dossier', mandaat: 'A', uitkomst: 'fout', accountId, reden: r.reden }, nu)
    return { ok: false as const, reden: r.reden }
  }
  const v = verrijkVelden(r.antwoord.velden ?? [])
  const criteria = Object.fromEntries(DOSSIER_CRITERIA.map((k) => [k, { oordeel: r.antwoord.criteria?.[k] ?? 'onbekend', op: nu.toISOString() }])) as Record<DossierCriterium, Oordeel>
  const dossier = { ...(a.data?.dossier ?? {}), op: nu.toISOString(), door: 'verrijker', criteria, kernfeiten: [...new Set([...(a.data?.dossier?.kernfeiten ?? []), ...v.overnemen.filter((x) => x.veld === 'kernfeit').map((x) => x.waarde)])].slice(0, 8), velden: v.overnemen, aannames: v.aannames }
  await tx.execute(sql`update accounts set data = jsonb_set(data, '{dossier}', ${JSON.stringify(dossier)}::jsonb), updated_at = now() where id = ${accountId}`)
  let compleet = false
  if (dossierCompleet(criteria) && a.fase_id === 'gevonden') {
    try { await meldGebeurtenis(tx, { accountId, gebeurtenis: 'dossier-compleet', door: 'motor', nu, zonderMotor: true }); compleet = true } catch (e) { if (!(e instanceof ReisFout)) throw e }
  }
  await logAgentRun(tx, org, { agent: 'verrijker', handeling: 'dossier', mandaat: 'A', uitkomst: 'uitgevoerd', accountId, bronnen: v.overnemen.map((x) => x.bron) }, nu)
  return { ok: true as const, velden: v.overnemen.length, aannames: v.aannames.length, geweigerd: v.geweigerd.length, compleet, criteria }
}
