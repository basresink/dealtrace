// Inzichten opslaan (P19, F06): voor de agents en voor "Inzicht met bron". Een open inzicht met
// hetzelfde onderwerp wordt bijgewerkt zonder terug te gaan naar ongelezen (regel 12).
import { sql } from 'drizzle-orm'
import type { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]

export interface InzichtInvoer {
  accountId: string; ownerId: string; agent: string; type: string; onderwerp: string; title: string; beschrijving: string; relevantie: number; zekerheid: number
  bron: { soort: string; naam: string; url?: string | null; datum?: string | null }; evidence: { citaat: string; bron: string; datum?: string | null; url?: string | null }[]
  winpuntVoorstel?: string | null; taakVoorstel?: string | null; tegengehouden?: string | null
}
/** Een inzicht opslaan of een open inzicht bijwerken zonder het terug op ongelezen te zetten. */
export async function bewaarInzicht(tx: Tx, org: string, i: InzichtInvoer) {
  const data = { agent: i.agent, bron: i.bron, evidence: i.evidence, zekerheid: i.zekerheid, winpuntVoorstel: i.winpuntVoorstel ?? null, waarom: i.beschrijving, bewijs: i.evidence.map((e) => `"${e.citaat}" (${e.bron}${e.datum ? `, ${e.datum}` : ''})`), voorstel: i.taakVoorstel ? { title: i.taakVoorstel, actionType: 'bellen', priority: i.relevantie >= 80 ? 'hoog' : 'middel' } : null, ...(i.tegengehouden ? { tegenhoudReden: i.tegengehouden } : {}) }
  const [open] = (await tx.execute( sql`select id from signals where account_id = ${i.accountId} and onderwerp = ${i.onderwerp} and status in ('nieuw', 'gelezen', 'tegengehouden')`)).rows as any[]
  if (open) {
    await tx.execute(sql`update signals set data = data || ${JSON.stringify(data)}::jsonb, relevance_score = ${i.relevantie}, confidence = ${i.zekerheid / 100}, updated_at = now() where id = ${open.id}`)
    return { id: open.id as string, nieuw: false }
  }
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into signals (id, organisation_id, account_id, owner_id, onderwerp, agent, type, title, relevance_score, confidence, status, bron, data)
    values (${id}, ${org}, ${i.accountId}, ${i.ownerId}, ${i.onderwerp}, ${i.agent}, ${i.type}, ${i.title}, ${i.relevantie}, ${i.zekerheid / 100}, ${i.tegengehouden ? 'tegengehouden' : 'nieuw'}, ${i.bron.soort === 'intern' ? 'intern' : 'extern'}, ${JSON.stringify(data)}::jsonb)`)
  return { id, nieuw: true }
}

