// Klantflyout van Platformbeheer (pakket C): Data en AVG, AI per klant en de eigen prompts van een klant.
// Alles als dealtrace_platform (binnen alsPlatform): klantdata alleen als getallen via de security-definer-
// functies uit migratie 0075, nooit records, namen of teksten.
import { sql } from 'drizzle-orm'
import { PROMPT_SLOTS } from '../../shared/platform'
import { leesBewaartermijnen } from '../../shared/privacy'
import type { AvgData } from '../../shared/platformAvg'
import type { gebruikDb } from './db'
import { ontsleutel } from './geheimen'
import { vingerafdruk } from './salesdnaWebhook'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as any[]

/** Voert een tellingsfunctie uit; ontbreekt hij (migratie 0075 nog niet toegepast), dan null in plaats van een fout. */
async function veilig<T>(tx: Tx, werk: () => Promise<T>): Promise<T | null> {
  await tx.execute(sql`savepoint platform_avg`)
  try {
    const uit = await werk()
    await tx.execute(sql`release savepoint platform_avg`)
    return uit
  } catch (e: any) {
    await tx.execute(sql`rollback to savepoint platform_avg`)
    if ((e?.cause?.code ?? e?.code) === '42883') return null
    throw e
  }
}

export async function avgTellingen(tx: Tx, org: string) {
  const r = await veilig(tx, async () => (await rijen(tx, sql`select * from dealtrace_platform_avg(${org})`))[0])
  if (!r) return null
  return {
    accounts: r.accounts, prospects: r.prospects, klanten: r.klanten, gedeactiveerd: r.gedeactiveerd,
    contacten: r.contacten, contactenVerrijkt: r.contacten_verrijkt, contactenImport: r.contacten_import,
    leadsOpen: r.leads_open, leadsAfgewezen: r.leads_afgewezen,
    accountsPerBron: (r.accounts_per_bron ?? {}) as Record<string, number>, leadsPerBron: (r.leads_per_bron ?? {}) as Record<string, number>,
    activiteiten: r.activiteiten, verslagen: r.verslagen, transcripten: r.transcripten,
    bijlagen: r.bijlagen, bijlagenBytes: Number(r.bijlagen_bytes ?? 0), opnames: r.opnames,
    onderdrukt: r.onderdrukt, belMeNiet: r.bel_me_niet,
    laatsteExport: r.laatste_export ? new Date(r.laatste_export).toISOString() : null, exports12m: r.exports_12m,
  }
}

/** De bewaartermijnen die de klant koos (org_settings mag de platformrol lezen). */
export async function klantTermijnen(tx: Tx, org: string) {
  const [r] = await rijen(tx, sql`select value, updated_at from org_settings where organisation_id = ${org} and key = 'bewaartermijnen'`)
  return { termijnen: leesBewaartermijnen(r?.value), ingesteld: !!r, bijgewerktOp: r ? new Date(r.updated_at).toISOString() : null }
}

/** Eigen prompts van de klant per slot: alleen versie en datum, nooit de tekst. */
export async function klantPrompts(tx: Tx, org: string) {
  const r = await veilig(tx, () => rijen(tx, sql`select * from dealtrace_platform_prompts(${org})`))
  return PROMPT_SLOTS.map((s) => {
    const e = r?.find((x) => x.slot === s.slot)
    return { slot: s.slot, naam: s.naam, eigen: e ? { versies: e.versies, versie: e.laatste_versie, op: new Date(e.laatste_op).toISOString() } : null, bekend: r !== null }
  })
}

/** De AI-koppeling van de klant: eigen of die van het platform. Sleutel alleen als vingerafdruk. */
export async function klantAi(tx: Tx, org: string) {
  const rij = await rijen(tx, sql`select organisation_id, provider, sleutel, modellen, regio, geen_training, getest_op, op from llm_connections where organisation_id = ${org} or organisation_id is null`)
  const uit = (r: any) => {
    if (!r) return null
    const s = ontsleutel(r.sleutel, 'llm')?.sleutel
    return { provider: r.provider as string, vingerafdruk: s ? vingerafdruk(s) : null, modellen: (r.modellen ?? {}) as Record<string, string>, regio: r.regio as string, geenTraining: !!r.geen_training, getestOp: r.getest_op ? new Date(r.getest_op).toISOString() : null, op: r.op ? new Date(r.op).toISOString() : null }
  }
  const eigen = uit(rij.find((r) => r.organisation_id === org))
  const platform = uit(rij.find((r) => !r.organisation_id))
  return { eigen, platform, modus: (process.env.AI_PROVIDER ?? 'mock') === 'mock' ? 'mock' : 'echt', omgeving: !!process.env.ANTHROPIC_API_KEY }
}

export function leesAvgData(data: unknown): Required<AvgData> {
  const a = ((data as any)?.avg ?? {}) as AvgData
  return { verwerkersovereenkomst: a.verwerkersovereenkomst ?? null, verzoeken: Array.isArray(a.verzoeken) ? a.verzoeken : [], exportGevraagdOp: a.exportGevraagdOp ?? null }
}

/** Vandaag in Nederland als JJJJ-MM-DD. */
export function vandaagNL(nu = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(nu)
}
