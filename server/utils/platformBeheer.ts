// Platformbeheer compleet (P24, F23): Stripe-facturen (adapter met mock, webhook idempotent op event-id,
// achterstallig pauzeert alleen AI), Moneybird-synchronisatie, de proefperiode, GitHub-issues voor de
// roadmap (status gestart maar één keer), promptversies (hooguit 10 per slot en laag) en extra credits
// met reden en idempotentie. Lokaal en in tests draait alles op een mock, zonder netwerk.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { MAX_PROMPTVERSIES, controleerPrompt, type PromptSlot } from '../../shared/platform'
import type { gebruikDb } from './db'
import { maandVan, stand } from './credits'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }

// ── Stripe ─────────────────────────────────────────────────────────────────
/** Stripe-Signature: "t=<tijd>,v1=<hmac>" over "<tijd>.<body>" met STRIPE_WEBHOOK_SECRET; hooguit 5 minuten oud. */
export function controleerStripe(rauw: string, header: string | null | undefined, geheim: string | null | undefined, nu = new Date()): boolean {
  if (!geheim || !header) return false
  const delen = Object.fromEntries(header.split(',').map((d) => d.split('=') as [string, string]))
  const t = Number(delen.t)
  if (!delen.v1 || !Number.isFinite(t) || Math.abs(nu.getTime() / 1000 - t) > 300) return false
  const verwacht = Buffer.from(createHmac('sha256', geheim).update(`${t}.${rauw}`).digest('hex'))
  const gekregen = Buffer.from(delen.v1)
  return verwacht.length === gekregen.length && timingSafeEqual(verwacht, gekregen)
}
export const stripeHandtekening = (rauw: string, geheim: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', geheim).update(`${t}.${rauw}`).digest('hex')}`

export interface StripeFactuur { id: string; customer: string; number: string; amount_due: number; tax?: number; status: string; due_date?: number | null; hosted_invoice_url?: string | null; lines?: { description: string; amount: number }[] }
export interface StripeEvent { id: string; type: string; data: { object: StripeFactuur } }

const STATUS: Record<string, 'open' | 'betaald' | 'achterstallig' | 'geannuleerd' | null> = {
  'invoice.finalized': 'open', 'invoice.created': 'open', 'invoice.paid': 'betaald', 'invoice.payment_succeeded': 'betaald', 'invoice.payment_failed': 'achterstallig', 'invoice.voided': 'geannuleerd',
}

/**
 * Eén Stripe-event: dubbel event-id doet niets; de organisatie komt uit de Stripe-klant. Een mislukte
 * incasso pauzeert AI (de app werkt door); na betaling vervalt de pauze als er niets meer openstaat.
 */
export async function verwerkStripeEvent(db: { buiten: (werk: (tx: Tx) => Promise<any>) => Promise<any>; inOrg: <T>(org: string, werk: (tx: Tx) => Promise<T>) => Promise<T> }, e: StripeEvent): Promise<'dubbel' | 'onbekend' | 'verwerkt' | 'genegeerd'> {
  const nieuw = await db.buiten(async (tx) => (await rijen(tx, sql`insert into stripe_events (event_id, soort) values (${e.id}, ${e.type}) on conflict do nothing returning event_id`)).length > 0)
  if (!nieuw) return 'dubbel'
  const status = STATUS[e.type]
  if (!status) return 'genegeerd'
  const f = e.data.object
  const org = await db.buiten(async (tx) => (await rijen(tx, sql`select dealtrace_org_voor_stripe(${f.customer}) as id`))[0]?.id ?? null)
  if (!org) return 'onbekend'
  await db.inOrg(org, async (tx) => {
    await tx.execute(sql`insert into facturen (organisation_id, stripe_invoice_id, nummer, bedrag_cent, btw_cent, status, vervalt_op, betaald_op, pdf_url, regels)
      values (${org}, ${f.id}, ${f.number}, ${f.amount_due}, ${f.tax ?? 0}, ${status}, ${f.due_date ? new Date(f.due_date * 1000).toISOString().slice(0, 10) : null}, ${status === 'betaald' ? new Date().toISOString() : null}, ${f.hosted_invoice_url ?? null}, ${JSON.stringify(f.lines ?? [])}::jsonb)
      on conflict (stripe_invoice_id) do update set status = excluded.status, betaald_op = coalesce(excluded.betaald_op, facturen.betaald_op), pdf_url = coalesce(excluded.pdf_url, facturen.pdf_url)`)
    const [open] = await rijen(tx, sql`select count(*)::int as n from facturen where status = 'achterstallig'`)
    await tx.execute(sql`update organisations set data = jsonb_set(coalesce(data, '{}'::jsonb), '{aiGepauzeerd}', ${JSON.stringify(open!.n > 0)}::jsonb) where id = ${org}`)
    if (status === 'achterstallig') {
      await tx.execute(sql`insert into notificaties (organisation_id, gebruiker_id, soort, titel, tekst, link) select ${org}, id, 'kritiek', 'Factuur niet betaald: AI gepauzeerd', ${`Factuur ${f.number} staat open. AI-functies staan stil tot hij betaald is; de rest werkt gewoon.`}, '/instellingen/abonnement' from users where role = 'beheerder' and status = 'actief'`)
    }
  })
  return 'verwerkt'
}

/** De mock van Stripe: een factuur voor de maand met de seats en de te factureren extra credits. */
export function mockStripeFactuur(o: { customer: string; nummer: string; seats: number; seatCent: number; prijsCent: number; extra: { aantal: number; centPerCredit: number } | null }): StripeFactuur {
  const lines = [{ description: 'Abonnement', amount: o.prijsCent }, { description: `${o.seats} seats`, amount: o.seats * o.seatCent }]
  if (o.extra?.aantal) lines.push({ description: `${o.extra.aantal} extra AI-credits`, amount: Math.round(o.extra.aantal * o.extra.centPerCredit) })
  const netto = lines.reduce((s, l) => s + l.amount, 0)
  return { id: `in_mock_${o.nummer}`, customer: o.customer, number: o.nummer, amount_due: Math.round(netto * 1.21), tax: Math.round(netto * 0.21), status: 'open', due_date: Math.floor(Date.now() / 1000) + 14 * 86400, hosted_invoice_url: `https://betalen.stripe.test/${o.nummer}`, lines }
}

/** Moneybird (job): betaalde facturen zonder Moneybird-id krijgen er een; de mock geeft een vast formaat. */
export async function synchroniseerMoneybird(tx: Tx, org: string, nu = new Date()): Promise<number> {
  const lijst = await rijen(tx, sql`select id, nummer from facturen where status = 'betaald' and moneybird_id is null limit 50`)
  for (const f of lijst) await tx.execute(sql`update facturen set moneybird_id = ${`mb_${f.nummer}`} where id = ${f.id}`)
  if (lijst.length) await tx.execute(sql`insert into koppeling_runs (organisation_id, soort, handeling, start, eind, geschreven) values (${org}, 'moneybird', 'facturen', ${nu.toISOString()}, now(), ${lijst.length})`)
  return lijst.length
}

// ── Proefperiode ───────────────────────────────────────────────────────────
/** Platformjob: 7 dagen vóór het einde een melding; op de einddatum terug naar Starter (proef blijft proef tot een contract). */
export async function proefControle(tx: Tx, nu = new Date()): Promise<{ gemeld: string[]; afgewaardeerd: string[] }> {
  const vandaag = nu.toISOString().slice(0, 10)
  const over7 = new Date(nu.getTime() + 7 * 864e5).toISOString().slice(0, 10)
  const orgs = await rijen(tx, sql`select id, pakket, contract, data from organisations where status <> 'systeem' and contract->>'status' = 'proef' and contract->>'proefTot' is not null`)
  const gemeld: string[] = []
  const afgewaardeerd: string[] = []
  for (const o of orgs) {
    const tot = String(o.contract.proefTot).slice(0, 10)
    if (tot === over7 && o.data?.proefGemeld !== tot) {
      await tx.execute(sql`insert into notificaties (organisation_id, gebruiker_id, soort, titel, tekst, link) select ${o.id}, id, 'systeem', 'Je proefperiode loopt over 7 dagen af', ${`Op ${tot} gaat je organisatie terug naar Starter. Wil je verder met je huidige pakket, vraag dan een upgrade aan.`}, '/instellingen/abonnement' from users where organisation_id = ${o.id} and role = 'beheerder' and status = 'actief'`)
      await tx.execute(sql`update organisations set data = jsonb_set(coalesce(data, '{}'::jsonb), '{proefGemeld}', ${JSON.stringify(tot)}::jsonb) where id = ${o.id}`)
      gemeld.push(o.id)
    }
    if (tot <= vandaag && o.pakket !== 'starter') {
      await tx.execute(sql`update organisations set pakket = 'starter', updated_at = now() where id = ${o.id}`)
      await tx.execute(sql`insert into platform_audit (actor_id, actieve_organisatie, handeling, object, voor, na, reden) values ('systeem', ${o.id}, 'pakket.proefAfgelopen', ${o.id}, ${JSON.stringify({ pakket: o.pakket })}::jsonb, '{"pakket": "starter"}'::jsonb, 'Proefperiode afgelopen')`)
      afgewaardeerd.push(o.id)
    }
  }
  return { gemeld, afgewaardeerd }
}

// ── GitHub (roadmap) ───────────────────────────────────────────────────────
/** Een issue maken met het platformtoken; zonder token de mock. De bouwketen opent altijd een pull request, nooit een merge. */
export async function maakGithubIssue(w: { id: string; titel: string; omschrijving: string; organisaties: number }, haal: typeof fetch = fetch): Promise<string> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo) return `https://github.test/issues/${w.id.slice(0, 8)}`
  const r = await haal(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
    body: JSON.stringify({ title: w.titel, body: `${w.omschrijving}\n\nGevraagd door ${w.organisaties} ${w.organisaties === 1 ? 'organisatie' : 'organisaties'}. Wens ${w.id}.`, labels: ['roadmap'] }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) fout(502, `GitHub antwoordde ${r.status}`)
  return ((await r.json()) as any).html_url as string
}

// ── Promptversies ──────────────────────────────────────────────────────────
/** Een nieuwe versie in een laag; de elfde verdringt de oudste. 422 als de tekst het vaste kader probeert op te heffen. */
export async function bewaarPromptversie(tx: Tx, p: { slot: PromptSlot; laag: 'platform' | 'organisatie'; org: string | null; tekst: string; auteur: string }) {
  const f = controleerPrompt(p.tekst)
  if (f) fout(422, f)
  const orgSql = p.org ? sql`organisation_id = ${p.org}` : sql`organisation_id is null`
  const [m] = await rijen(tx, sql`select coalesce(max(versie), 0)::int as v from prompt_versies where slot = ${p.slot} and laag = ${p.laag} and ${orgSql}`)
  const versie = m!.v + 1
  await tx.execute(sql`insert into prompt_versies (slot, laag, organisation_id, versie, tekst, auteur_id) values (${p.slot}, ${p.laag}, ${p.org}, ${versie}, ${p.tekst.trim()}, ${p.auteur})`)
  await tx.execute(sql`delete from prompt_versies where slot = ${p.slot} and laag = ${p.laag} and ${orgSql} and versie <= ${versie - MAX_PROMPTVERSIES}`)
  return versie
}
export async function promptversies(tx: Tx, slot: PromptSlot, laag: 'platform' | 'organisatie') {
  return (await rijen(tx, sql`select p.versie, p.tekst, p.op, u.name as auteur from prompt_versies p left join users u on u.id = p.auteur_id where p.slot = ${slot} and p.laag = ${laag} order by p.versie desc`))
    .map((r) => ({ versie: r.versie, tekst: r.tekst, op: new Date(r.op).toISOString(), auteur: String(r.auteur ?? '').replace(/^Test(gebruiker|founder) /, '') }))
}

// ── Extra credits ──────────────────────────────────────────────────────────
/** Extra credits voor deze maand met reden; dezelfde sleutel twee keer telt één keer. */
export async function kenExtraToe(tx: Tx, org: string, x: { aantal: number; reden: string; factureren: boolean; sleutel: string; door: string }, nu = new Date()) {
  if (!x.reden?.trim()) fout(422, 'Geef een reden')
  const maand = maandVan(nu)
  const [nieuw] = await rijen(tx, sql`insert into extra_credits_log (organisation_id, maand, aantal, reden, factureren, sleutel, door) values (${org}, ${maand}, ${x.aantal}, ${x.reden.trim()}, ${x.factureren}, ${x.sleutel}, ${x.door})
    on conflict (organisation_id, sleutel) do nothing returning id`)
  await stand(tx, org, nu)
  if (nieuw) await tx.execute(sql`update ai_credits set extra = extra + ${x.aantal} where organisation_id = ${org} and maand = ${maand}`)
  return { dubbel: !nieuw, stand: await stand(tx, org, nu) }
}
