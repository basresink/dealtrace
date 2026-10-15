// AI-credits op de server (11.4, P33): de stand van de pot, de reservering vóór elke AI-aanroep,
// boeken of vrijgeven na afloop en de meldingen bij 80 procent en 10 procent over. Elke AI in
// Dealtrace loopt via reserveer/boek (voerAiStapUit) of via metCredits (de assistent).
// Verbruik = de geboekte kosten in agent_runs; een open reservering telt als niet beschikbaar en
// vervalt na 10 minuten. De reservering is atomair: een advisory lock per organisatie.
import { sql } from 'drizzle-orm'
import {
  AI_SOORTEN, creditsStand, creditsVoor, magVragenVoor, meldingNodig, type AiSoort, type CreditsStand,
} from '../../shared/credits'
import { nlMoment, nlTijdstip } from '../../shared/datum'
import type { Pakket } from '../../shared/types'
import { logAgentRun } from './agents/bewaker'
import { gebruikDb, metOrganisatie } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
export const maandVan = (nu: Date) => nlMoment(nu).datum.slice(0, 7)
const maandStart = (nu: Date) => nlTijdstip(`${maandVan(nu)}-01`, 0).toISOString()
export const RESERVERING_VERVALT_MIN = 10

/** Prijzen en credits per pakket van de founder (credit_instellingen); zonder rij de standaard. */
export async function platformCredits(tx: Tx): Promise<{ prijzen: Partial<Record<AiSoort, number>>; perGebruiker: Partial<Record<Pakket, number>> }> {
  const r = await rijen(tx, sql`select sleutel, waarde from credit_instellingen`)
  const prijzen: Partial<Record<AiSoort, number>> = {}
  const perGebruiker: Partial<Record<Pakket, number>> = {}
  for (const x of r) {
    const [soort, naam] = String(x.sleutel).split(':')
    if (soort === 'prijs' && (AI_SOORTEN as readonly string[]).includes(naam!)) prijzen[naam as AiSoort] = Number(x.waarde)
    if (soort === 'pot') perGebruiker[naam as Pakket] = Number(x.waarde)
  }
  return { prijzen, perGebruiker }
}

/** De maandrij: toegekend = credits per gebruiker maal actieve gebruikers, verhoogd als er gebruikers bijkomen, nooit verlaagd. */
async function maandRij(tx: Tx, org: string, nu: Date) {
  // Eerst het slot van de organisatie, dan de maandrij: zo nemen stand() en reserveer() de sloten in
  // dezelfde volgorde en wachten twee transacties nooit op elkaar (deadlock bij de eerste rij van de maand).
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`credits:${org}`}))`)
  const [o] = await rijen(tx, sql`select pakket from organisations where id = ${org}`)
  const pakket = (o?.pakket ?? 'starter') as Pakket
  const { perGebruiker } = await platformCredits(tx)
  const [n] = await rijen(tx, sql`select count(*)::int as n from users where organisation_id = ${org} and status = 'actief' and role <> 'founder'`)
  const nu_ = creditsStand({ pakket, gebruikers: n?.n ?? 0, verbruikt: 0, perGebruiker: perGebruiker[pakket] }).pot
  const maand = maandVan(nu)
  const [r] = await rijen(tx, sql`insert into ai_credits (organisation_id, maand, toegekend) values (${org}, ${maand}, ${nu_})
    on conflict (organisation_id, maand) do update set toegekend = greatest(ai_credits.toegekend, excluded.toegekend) returning *`)
  return { pakket, rij: r!, perGebruiker: perGebruiker[pakket] }
}

/** De stand van de pot deze maand, met open reserveringen. */
export async function stand(tx: Tx, org: string, nu = new Date()): Promise<CreditsStand & { pakket: Pakket; gemeld80: boolean; gemeld10: boolean; extra: number }> {
  const { pakket, rij } = await maandRij(tx, org, nu)
  const [inst] = await rijen(tx, sql`select value from org_settings where organisation_id = ${org} and key = 'aiCredits'`)
  const ai = (inst?.value ?? {}) as { vastePot?: number | null; extra?: number; verbruikt?: number }
  const [v] = await rijen(tx, sql`select coalesce(sum((kosten->>'credits')::int), 0)::int as c from agent_runs where organisation_id = ${org} and kosten is not null and uitkomst = 'uitgevoerd' and op >= ${maandStart(nu)}`)
  const [g] = await rijen(tx, sql`select coalesce(sum(credits), 0)::int as c from ai_reserveringen where organisation_id = ${org} and status = 'gereserveerd' and op > ${new Date(nu.getTime() - RESERVERING_VERVALT_MIN * 60_000).toISOString()}`)
  const extra = Number(rij.extra) + (ai.extra ?? 0)
  const s = creditsStand({ pakket, gebruikers: 0, toegekend: Number(rij.toegekend), extra, vastePot: ai.vastePot ?? null, verbruikt: (v?.c ?? 0) + (ai.verbruikt ?? 0), gereserveerd: g?.c ?? 0 })
  return { ...s, pakket, gemeld80: !!rij.gemeld80, gemeld10: !!rij.gemeld10, extra }
}

/** Wat een gebruiker deze maand zelf vroeg (telt op zijn plafond; automatische AI telt op de organisatie). */
export async function verbruikGebruiker(tx: Tx, org: string, gebruikerId: string, nu = new Date()) {
  const [v] = await rijen(tx, sql`select coalesce(sum((kosten->>'credits')::int), 0)::int as c from agent_runs where organisation_id = ${org} and gebruiker_id = ${gebruikerId} and kosten->>'door' = 'gebruiker' and uitkomst = 'uitgevoerd' and op >= ${maandStart(nu)}`)
  const [r] = await rijen(tx, sql`select coalesce(sum(credits), 0)::int as c from ai_reserveringen where organisation_id = ${org} and gebruiker_id = ${gebruikerId} and not automatisch and status = 'gereserveerd' and op > ${new Date(nu.getTime() - RESERVERING_VERVALT_MIN * 60_000).toISOString()}`)
  const [p] = await rijen(tx, sql`select plafond from ai_credit_plafonds where organisation_id = ${org} and gebruiker_id = ${gebruikerId}`)
  return { verbruikt: (v?.c ?? 0) + (r?.c ?? 0), plafond: p ? Number(p.plafond) : null }
}

export interface Reservering { id: string; org: string; soort: AiSoort; credits: number; gebruikerId: string | null; automatisch: boolean }
export interface ReserveerOpties { soort: AiSoort; gebruikerId?: string | null; automatisch?: boolean; context?: Parameters<typeof creditsVoor>[1] }

/** Reserveer vóór de aanroep. Gooit 402 (op, plafond, agentgrens) of 403 (niet in het pakket). */
export async function reserveer(tx: Tx, org: string, o: ReserveerOpties, nu = new Date()): Promise<Reservering> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`credits:${org}`}))`)
  const { prijzen } = await platformCredits(tx)
  const kosten = creditsVoor(o.soort, { ...(o.context ?? {}), prijzen })
  const s = await stand(tx, org, nu)
  const g = o.gebruikerId && !o.automatisch ? await verbruikGebruiker(tx, org, o.gebruikerId, nu) : { verbruikt: 0, plafond: null }
  const m = magVragenVoor({ stand: s, kosten, automatisch: !!o.automatisch, plafond: g.plafond, verbruiktGebruiker: g.verbruikt, soort: o.soort, pakket: s.pakket })
  if (!m.ja) throw Object.assign(new Error(m.tekst), { statusCode: m.status, statusMessage: m.tekst, data: { reden: m.reden } })
  const [r] = await rijen(tx, sql`insert into ai_reserveringen (organisation_id, gebruiker_id, soort, credits, automatisch, op) values (${org}, ${o.gebruikerId ?? null}, ${o.soort}, ${kosten}, ${!!o.automatisch}, ${nu.toISOString()}) returning id`)
  return { id: r!.id, org, soort: o.soort, credits: kosten, gebruikerId: o.gebruikerId ?? null, automatisch: !!o.automatisch }
}

/** Boek na een geslaagde aanroep: de rij in agent_runs met de kosten, en de meldingen bij 80 en 10 procent. */
export async function boek(tx: Tx, r: Reservering, run: { agent: string; handeling?: string; accountId?: string | null; credits?: number }, nu = new Date()) {
  const voor = await stand(tx, r.org, nu)
  const credits = run.credits ?? r.credits
  await tx.execute(sql`update ai_reserveringen set status = 'geboekt', credits = ${credits}, afgerond_op = now() where id = ${r.id} and status = 'gereserveerd'`)
  const runId = await logAgentRun(tx, r.org, { agent: run.agent, handeling: run.handeling ?? `ai:${r.soort}`, mandaat: 'A', uitkomst: 'uitgevoerd', gebruikerId: r.gebruikerId, accountId: run.accountId ?? null, reden: null, kosten: { soort: r.soort, credits, door: r.automatisch ? 'agent' : 'gebruiker' } as any }, nu)
  const na = await stand(tx, r.org, nu)
  // De reservering telde al mee: vergelijk de stand zonder deze boeking met de stand erna.
  const melding = meldingNodig({ ...voor, verbruikt: voor.verbruikt }, na, voor)
  if (melding) await meld(tx, r.org, melding, na)
  return runId
}

export async function geefVrij(tx: Tx, r: Reservering) {
  await tx.execute(sql`update ai_reserveringen set status = 'vrijgegeven', afgerond_op = now() where id = ${r.id} and status = 'gereserveerd'`)
}

async function meld(tx: Tx, org: string, soort: '80' | '10', s: CreditsStand) {
  const vlag = soort === '80' ? sql`gemeld80` : sql`gemeld10`
  const [r] = await rijen(tx, sql`update ai_credits set ${vlag} = true where organisation_id = ${org} and maand = ${maandVan(new Date())} and ${vlag} = false returning organisation_id`)
  if (!r) return
  const ontvangers = await rijen(tx, sql`select id, role from users where organisation_id = ${org} and status = 'actief' and role <> 'founder'`)
  const voor = soort === '80' ? ontvangers : ontvangers.filter((u) => u.role === 'beheerder')
  const titel = soort === '80' ? 'AI-credits op 80 procent' : 'Nog 10 procent AI-credits over'
  const tekst = soort === '80' ? `${s.verbruikt} van ${s.pot} AI-credits zijn deze maand gebruikt.` : 'Agents en automatische voorbereiding staan stil tot de nieuwe maand of extra credits. Wat gebruikers zelf vragen, gaat door.'
  for (const u of voor) {
    await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${u.id}, 'systeem', ${titel}, ${tekst}, ${u.role === 'beheerder' ? '/instellingen/verbruik' : '/mij'}, now(), '{}'::jsonb)`)
  }
}

/**
 * De verpakking voor een AI-aanroep buiten een lopende transactie (de assistent): reserveer in een
 * korte transactie, roep aan, en boek of geef vrij. Een mislukte aanroep kost niets.
 */
export async function metCredits<T>(org: string, o: ReserveerOpties & { agent: string; accountId?: string | null }, fn: (r: Reservering) => Promise<{ ok: true; waarde: T; credits?: number } | { ok: false; reden: string }>) {
  const r = await metOrganisatie(org, (tx) => reserveer(tx, org, o))
  let uit: Awaited<ReturnType<typeof fn>>
  try { uit = await fn(r) } catch (e) { await metOrganisatie(org, (tx) => geefVrij(tx, r)); throw e }
  if (!uit.ok) { await metOrganisatie(org, (tx) => geefVrij(tx, r)); return { ...uit, credits: 0 } }
  const credits = uit.credits ?? r.credits
  await metOrganisatie(org, (tx) => boek(tx, r, { agent: o.agent, accountId: o.accountId, credits }))
  return { ok: true as const, waarde: uit.waarde, credits }
}

/** Opruimen (dagelijks): vervallen reserveringen en verlopen gesprekken. */
export async function ruimOp(tx: Tx, nu = new Date()) {
  const r = await tx.execute(sql`update ai_reserveringen set status = 'vervallen', afgerond_op = now() where status = 'gereserveerd' and op <= ${new Date(nu.getTime() - RESERVERING_VERVALT_MIN * 60_000).toISOString()}`)
  const c = await tx.execute(sql`delete from ai_chats where verloopt_op <= ${nu.toISOString()}`)
  return { reserveringen: r.rowCount ?? 0, chats: c.rowCount ?? 0 }
}
