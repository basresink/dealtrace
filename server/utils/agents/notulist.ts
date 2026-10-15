// De Notulist (P19, F09, 8.5.3, mandaat A voor het verslag): na "Rond af" of "Bewaar bezoek" leest hij
// de aantekeningen. Actiepunten worden concepttaken in Concepten; koopsignalen en concurrentnamen worden
// inzichten op het account. Namen uit de aantekeningen gaan niet mee naar de AI (C.9 punt 9). De
// uitkomst kiest de mens. Notulist: 5 credits (11.4); als agent stopt hij onder 10 procent.
import { sql } from 'drizzle-orm'
import type { JsonSchema } from '../../../shared/aiStap'
import { vindConcurrenten } from '../../../shared/bewijs'
import { filterNamen } from '../../../shared/verkoopverhaal'
import { gebruikDb } from '../db'
import { voerAiStapUit } from '../llm-provider'
import { leesStand } from '../vvProjectie'
import { bewaarInzicht } from '../inzichtOpslag'
import { logAgentRun, toets } from './bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const STR = { type: 'array', items: { type: 'string' } } as JsonSchema

export const NOTULIST_SCHEMA: JsonSchema = {
  type: 'object', required: ['perAgendapunt', 'openVragen', 'voorgesteldeUitkomst', 'koopsignalen', 'bezwaren', 'concurrenten'], additionalProperties: false,
  properties: {
    perAgendapunt: { type: 'array', items: { type: 'object', required: ['punt', 'samenvatting'], additionalProperties: false, properties: { punt: { type: 'string' }, samenvatting: { type: 'string', maxLength: 400 } } } },
    openVragen: STR, voorgesteldeUitkomst: { type: 'string' }, koopsignalen: STR, bezwaren: STR, concurrenten: STR, actiepunten: STR,
  },
}

export async function analyseerVerslag(tx: Tx, org: string, afspraakId: string, nu = new Date()) {
  const [ap] = await rijen(tx, sql`select ap.*, m.data as soort_data from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.id = ${afspraakId}`)
  const tekst = String(ap?.data?.verslag?.tekst ?? '').trim()
  if (!ap || !ap.account_id || tekst.length < 20) return null
  const contacten = await rijen(tx, sql`select first_name, last_name, rol from contacts where account_id = ${ap.account_id}`)
  const namen = contacten.map((c) => ({ naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), rol: c.rol === 'beslisser' ? 'de beslisser' : 'de contactpersoon' }))
  const stand = await leesStand(tx)
  const concurrenten = (stand.concurrenten ?? []).map((c: any) => ({ id: c.id, naam: c.naam }))
  const [eigenaar] = await rijen(tx, sql`select id, niveau, data from users where id = ${ap.owner_id}`)
  const t = await toets(tx, org, { agent: 'notulist', handeling: 'verslag', accountId: ap.account_id, ai: 'notulist', gebruiker: eigenaar ? { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data } : null }, nu)
  if (!t.mag) return { ok: false as const, reden: t.reden }
  const r = await voerAiStapUit<any>(tx, org, {
    soort: 'notulist', agent: 'notulist', accountId: ap.account_id, schema: NOTULIST_SCHEMA, gebruiker: eigenaar ? { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data } : null,
    prompt: 'Maak van de aantekeningen een verslag per agendapunt, met open vragen, een voorgestelde uitkomst, koopsignalen, bezwaren, genoemde concurrenten en actiepunten. Geen namen van personen.',
    materiaal: { aantekeningen: filterNamen(tekst, namen), agenda: (ap.soort_data?.agenda ?? []).map((p: any) => p.punt), concurrenten },
  } as any, nu)
  if (!r.ok) return { ok: false as const, reden: r.reden }
  const o = r.antwoord
  await tx.execute(sql`update appointments set data = data || ${JSON.stringify({ notulist: { ...o, op: nu.toISOString() } })}::jsonb where id = ${afspraakId}`)
  // Actiepunten worden concepttaken (de mens keurt goed).
  for (const a of (o.actiepunten ?? []).slice(0, 3)) {
    await tx.execute(sql`insert into concepten (organisation_id, agent, handeling, gebruiker_id, account_id, appointment_id, concept, status) values (${org}, 'notulist', 'taak:uit-verslag', ${ap.owner_id}, ${ap.account_id}, ${afspraakId}, ${JSON.stringify({ type: 'taak', tekst: a, aanleiding: 'Actiepunt uit het verslag' })}::jsonb, 'klaar')`)
  }
  for (const k of (o.koopsignalen ?? []).slice(0, 2)) {
    await bewaarInzicht(tx, org, { accountId: ap.account_id, ownerId: ap.owner_id, agent: 'notulist', type: 'koopsignaal', onderwerp: `verslag:${afspraakId}:koop:${k.slice(0, 40)}`, title: `Koopsignaal: ${k}`, beschrijving: 'Uit het verslag van de afspraak.', relevantie: 70, zekerheid: 70, bron: { soort: 'intern', naam: `Verslag ${new Date(ap.start_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })}` }, evidence: [{ citaat: k, bron: 'Verslag' }] })
  }
  // Concurrenten: wat de AI noemt én wat letterlijk in het verslag staat.
  const genoemd = vindConcurrenten(tekst, concurrenten)
  for (const c of genoemd) {
    await bewaarInzicht(tx, org, { accountId: ap.account_id, ownerId: ap.owner_id, agent: 'notulist', type: 'concurrent', onderwerp: `concurrent:${c.id}`, title: `${c.naam} genoemd in het verslag`, beschrijving: 'De klant noemde deze concurrent in het gesprek.', relevantie: 65, zekerheid: 85, bron: { soort: 'intern', naam: 'Verslag' }, evidence: [{ citaat: filterNamen(c.fragment, namen), bron: 'Verslag' }] })
  }
  await logAgentRun(tx, org, { agent: 'notulist', handeling: 'verslag', mandaat: 'A', uitkomst: 'uitgevoerd', accountId: ap.account_id, bronnen: [`afspraak ${afspraakId}`] }, nu)
  return { ok: true as const, actiepunten: (o.actiepunten ?? []).length, concurrenten: genoemd.map((c) => c.id), voorgesteldeUitkomst: o.voorgesteldeUitkomst }
}
