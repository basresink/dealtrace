// De Verzender als mock (P08): genoeg om mandaat B, de pauzeknop en de Bewaker te
// toetsen. De echte Verzender met SMTP en campagnes komt met P16. Een mail wordt nooit
// echt verstuurd: de mock schrijft alleen een activiteit.
import { and, eq } from 'drizzle-orm'
import { schema } from '../db'
import { laadAgentStand, type Voorstel } from './bewaker'
import { voerGoedgekeurdUit, voerUit } from './uitvoering'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]

export interface Vervolgmail {
  gebruiker: NonNullable<Voorstel['gebruiker']>
  accountId: string
  contactId?: string | null
  /** Binnen een door de salesmanager goedgekeurde campagne (voorwaarde voor B). */
  campagneGoedgekeurd?: boolean
  campaignId?: string | null
  eersteBericht?: boolean
  onderwerp: string
  tekst: string
}

/** Wat de mock "verstuurt": een activiteit met uitvoerder ai. */
const verstuurMock = (org: string, m: Pick<Vervolgmail, 'accountId' | 'contactId' | 'campaignId' | 'onderwerp' | 'tekst'>, mandaat: string, nu: Date) => async (tx: Tx) => {
  await tx.insert(schema.activiteiten).values({
    id: crypto.randomUUID(), organisationId: org, accountId: m.accountId, contactId: m.contactId ?? null, campaignId: m.campaignId ?? null, uitvoerder: 'ai', agent: 'verzender',
    kanaal: 'mail', soort: 'mail', op: nu.toISOString(), data: { mock: true, mandaat, onderwerp: m.onderwerp },
  })
  return { bronnen: [{ onderwerp: m.onderwerp }] }
}

/** Een vervolgmail: langs de Bewaker, dan versturen (A of B), als concept (C) of als taak (D). */
export async function verstuurVervolgmail(tx: Tx, org: string, m: Vervolgmail, nu = new Date()) {
  const stand = await laadAgentStand(tx, org)
  const v: Voorstel = {
    agent: 'verzender', handeling: 'mail.versturen', gebruiker: m.gebruiker, accountId: m.accountId, contactId: m.contactId, kanaal: 'mail', naarBuiten: true,
    binnenKader: !!m.campagneGoedgekeurd, eersteBericht: !!m.eersteBericht,
  }
  return voerUit(tx, org, v, {
    taak: { ownerId: m.gebruiker.id, title: `Mail versturen: ${m.onderwerp}`, actionType: 'mailen', waarom: 'De Verzender heeft een vervolgmail klaargezet.', concept: { onderwerp: m.onderwerp, tekst: m.tekst }, campaignId: m.campaignId },
    uitvoeren: (t) => verstuurMock(org, m, 'B', nu)(t),
  }, nu, stand)
}

/** Een door de mens goedgekeurd mailconcept versturen. */
export async function verstuurGoedgekeurd(tx: Tx, org: string, taskId: string, nu = new Date()) {
  const [t] = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.executorStatus, 'goedgekeurd')))
  if (!t || (t.data as any)?.agent !== 'verzender' || !t.accountId) return null
  const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, t.ownerId!))
  const concept = (t.data as any).concept ?? {}
  return voerGoedgekeurdUit(tx, org, taskId, { agent: 'verzender', handeling: 'mail.versturen', gebruiker: u ? { id: u.id, niveau: u.niveau, data: u.data } : null, accountId: t.accountId, contactId: t.contactId, kanaal: 'mail', naarBuiten: true },
    verstuurMock(org, { accountId: t.accountId, contactId: t.contactId, campaignId: t.campaignId, onderwerp: concept.onderwerp ?? t.title, tekst: concept.tekst ?? '' }, 'C', nu), nu)
}
