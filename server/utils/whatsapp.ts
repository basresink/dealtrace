// WhatsApp Business (P26, hoofdstuk 12): koppeling, sjablonen en versturen via de Berichtgever.
// Alleen uit een goedgekeurd sjabloon, alleen met opt-in, mandaat C op elk niveau (per stuk
// goedkeuren: alleen een goedgekeurd concept gaat weg), langs de Bewaker (consent, afkoeling,
// werkuren) en daarna magWhatsapp (afkoeling 180 dagen, frequentieplafond). Een opt-out via de
// provider zet de toestemming op nee, met datum en bron.
import { sql } from 'drizzle-orm'
import { normaliseerTelefoon } from '../../shared/contactgegevens'
import { kanaalInstelling, magWhatsapp } from '../../shared/kanalen'
import { logAgentRun, toets } from './agents/bewaker'
import { gebruikDb } from './db'
import { ontsleutel } from './geheimen'
import { ontvangStatus, whatsappAdapter, type WaConfig } from './bronnen/whatsapp'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (statusCode: number, statusMessage: string): never => { throw createError({ statusCode, statusMessage }) }

export interface WaKoppeling { id: string; status: string; modus: 'mock' | 'meta'; optInTekst: string; config: WaConfig; webhookGeheim: string | null; getestOp: string | null }
export const OPT_IN_STANDAARD = 'Mogen we je af en toe een kort bericht via WhatsApp sturen? Antwoord STOP om je af te melden.'

export async function waKoppeling(tx: Tx): Promise<WaKoppeling | null> {
  const [k] = await rijen(tx, sql`select id, status, geheimen, instellingen, getest_op from koppelingen where soort = 'whatsapp'`)
  if (!k) return null
  const g = ontsleutel(k.geheimen, 'whatsapp') ?? {}
  const modus = k.instellingen?.modus === 'meta' ? 'meta' : 'mock'
  return { id: k.id, status: k.status, modus, optInTekst: k.instellingen?.optInTekst ?? OPT_IN_STANDAARD, config: { modus, telefoonId: k.instellingen?.telefoonId, wabaId: k.instellingen?.wabaId, token: g.token }, webhookGeheim: g.webhookGeheim ?? null, getestOp: k.getest_op ? String(k.getest_op) : null }
}

export async function sjablonen(tx: Tx) {
  return rijen(tx, sql`select id, naam, taal, tekst, status, reden, updated_at from whatsapp_sjablonen order by naam, taal`)
}

/** Indienen bij de provider (mock keurt direct goed). Pas met status goedgekeurd is het kiesbaar. */
export async function dienIn(tx: Tx, org: string, id: string) {
  const k = await waKoppeling(tx)
  if (!k || k.status !== 'actief') fout(409, 'Koppel eerst WhatsApp Business')
  const [s] = await rijen(tx, sql`select * from whatsapp_sjablonen where id = ${id}`)
  if (!s) fout(404, 'Sjabloon niet gevonden')
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start) values (${org}, ${k!.id}, 'whatsapp', 'sjabloon', now()) returning id`)
  const r = await whatsappAdapter(k!.config).dienSjabloonIn({ naam: s!.naam, taal: s!.taal, tekst: s!.tekst })
  await tx.execute(sql`update koppeling_runs set eind = now(), geschreven = ${r.ok ? 1 : 0}, fouten = ${JSON.stringify(r.ok ? [] : [r.melding])}::jsonb where id = ${run!.id}`)
  if (!r.ok) fout(502, r.melding)
  const ok = r as Extract<typeof r, { ok: true }>
  await tx.execute(sql`update whatsapp_sjablonen set status = ${ok.status}, extern_id = ${ok.externId}, reden = ${ok.reden ?? null}, updated_at = now() where id = ${id}`)
  return { status: ok.status, reden: ok.reden ?? null }
}

/** Het contact voor WhatsApp bij een account: met mobiel nummer, opt-in eerst, dan de beslisser. */
async function waContact(tx: Tx, accountId: string) {
  const [c] = await rijen(tx, sql`select id, rol, data from contacts where account_id = ${accountId} and status <> 'vertrokken' and coalesce(data->>'mobiel', '') <> ''
    order by (data->'consent'->'whatsapp'->>'status' = 'ja') desc nulls last, (rol = 'beslisser') desc limit 1`)
  return c ?? null
}

/** Wat de knop "Verstuur via WhatsApp" mag: per concept, zonder iets te versturen. */
export async function waStand(tx: Tx, accountId: string | null) {
  const k = await waKoppeling(tx)
  const s = (await rijen(tx, sql`select id, naam from whatsapp_sjablonen where status = 'goedgekeurd' order by naam limit 1`))[0] ?? null
  const c = accountId ? await waContact(tx, accountId) : null
  const consent = c?.data?.consent?.whatsapp?.status ?? 'onbekend'
  return { gekoppeld: !!k && k.status === 'actief', sjabloon: s, contactId: c?.id ?? null, mobiel: !!c, consent }
}

/** POST /api/whatsapp/verstuur: een goedgekeurd WhatsApp-concept via de provider. */
export async function verstuurWhatsapp(tx: Tx, org: string, door: { id: string; rol: string; niveau: string; data?: any }, conceptId: string, nu = new Date()) {
  const [r] = await rijen(tx, sql`select * from concepten where id = ${conceptId}`)
  if (!r || r.concept?.type !== 'whatsapp') fout(404, 'WhatsApp-concept niet gevonden')
  if (r!.gebruiker_id !== door.id) fout(403, 'Alleen de eigenaar verstuurt dit concept')
  if (r!.status === 'verstuurd') return { status: 'verstuurd', tekst: 'Al verstuurd.' }
  if (r!.status !== 'goedgekeurd') fout(409, 'Keur het concept eerst goed')
  const k = await waKoppeling(tx)
  if (!k || k.status !== 'actief') fout(409, 'Er is geen WhatsApp-koppeling. Open het bericht in WhatsApp.')
  const c = await waContact(tx, r!.account_id)
  // De Bewaker: mandaat C (Berichtgever), consent, afkoeling, werkuren. Blokkades worden gelogd.
  const t = await toets(tx, org, { agent: 'berichtgever', handeling: 'whatsapp.versturen', gebruiker: { id: door.id, niveau: door.niveau, data: door.data ?? {} }, accountId: r!.account_id, contactId: c?.id ?? undefined, kanaal: 'whatsapp', naarBuiten: true, eersteBericht: true } as any, nu)
  // Geblokkeerd: geen fout gooien, zodat de logregel van de Bewaker bewaard blijft; het endpoint geeft 403.
  if (!t.mag) return { status: 'geblokkeerd', tekst: t.reden ?? 'Tegengehouden door de Bewaker' }
  if (!c) return { status: 'geblokkeerd', tekst: 'Geen mobiel nummer bekend' }
  const [s] = await rijen(tx, sql`select id, naam, taal, status from whatsapp_sjablonen where status = 'goedgekeurd' order by naam limit 1`)
  const [a] = await rijen(tx, sql`select data from accounts where id = ${r!.account_id}`)
  const [inst] = await rijen(tx, sql`select (select value from org_settings where key = 'afkoeling') as afk, (select value from org_settings where key = 'frequentieplafond') as fp`)
  const ki = kanaalInstelling(inst?.afk, inst?.fp)
  const eerdere = (await rijen(tx, sql`select op from activiteiten where account_id = ${r!.account_id} and kanaal = 'whatsapp' and op > ${new Date(nu.getTime() - 30 * 86_400_000).toISOString()}`)).map((x) => new Date(x.op).toISOString().slice(0, 10))
  const nee = a?.data?.nee
  const m = magWhatsapp({ mobiel: c!.data?.mobiel, consent: c!.data?.consent }, s ? { status: s.status } : null, nu, { neeOp: nee?.op ?? null, afkoelDagen: ki.afkoeling.whatsapp, eerdere, frequentieplafond: ki.frequentieplafond, binnenRitme: !!a?.data?.reis?.ritme?.actief && !!r!.task_id })
  if (!m.mag) {
    await logAgentRun(tx, org, { agent: 'berichtgever', handeling: 'whatsapp.versturen', mandaat: t.mandaat, uitkomst: 'geblokkeerd', gebruikerId: door.id, accountId: r!.account_id, contactId: c!.id, reden: m.reden } as any, nu)
    return { status: 'geblokkeerd', tekst: m.reden }
  }
  const nummer = normaliseerTelefoon(String(c!.data.mobiel))
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start) values (${org}, ${k!.id}, 'whatsapp', 'versturen', ${nu.toISOString()}) returning id`)
  const v = await whatsappAdapter(k!.config).verstuurSjabloon((nummer as any).e164, { naam: s!.naam, taal: s!.taal }, [String(r!.concept.tekst ?? '')])
  await tx.execute(sql`update koppeling_runs set eind = now(), geschreven = ${v.ok ? 1 : 0}, fouten = ${JSON.stringify(v.ok ? [] : [v.melding])}::jsonb where id = ${run!.id}`)
  if (!v.ok) fout(502, v.melding)
  await tx.execute(sql`insert into whatsapp_berichten (organisation_id, concept_id, account_id, contact_id, sjabloon_id, extern_id, door, op) values (${org}, ${conceptId}, ${r!.account_id}, ${c!.id}, ${s!.id}, ${(v as any).externId}, ${door.id}, ${nu.toISOString()})`)
  await tx.execute(sql`update concepten set status = 'verstuurd' where id = ${conceptId}`)
  await tx.execute(sql`insert into activiteiten (organisation_id, account_id, contact_id, soort, kanaal, uitkomst, door, op, data) values (${org}, ${r!.account_id}, ${c!.id}, 'bericht', 'whatsapp', 'verzonden', ${door.id}, ${nu.toISOString()}, ${JSON.stringify({ conceptId, sjabloon: s!.naam })}::jsonb)`)
  if (r!.task_id) await tx.execute(sql`update tasks set executor_status = 'uitgevoerd', updated_at = now() where id = ${r!.task_id}`)
  return { status: 'verstuurd', tekst: 'Verstuurd via WhatsApp.' }
}

/** De webhook van de provider: status per bericht en opt-outs (toestemming op nee, met datum en bron). */
export async function verwerkWebhook(tx: Tx, body: any, nu = new Date()) {
  let statussen = 0; let optOuts = 0
  for (const s of ontvangStatus(body)) {
    if (s.status && s.externId) { await tx.execute(sql`update whatsapp_berichten set status = ${s.status} where extern_id = ${s.externId}`); statussen++ }
    if (s.optOut && s.nummer) {
      const n = normaliseerTelefoon(s.nummer)
      if (!n.ok) continue
      for (const c of await rijen(tx, sql`select id, data from contacts where coalesce(data->>'mobiel', '') <> ''`)) {
        const m = normaliseerTelefoon(String(c.data.mobiel))
        if (!m.ok || m.e164 !== n.e164) continue
        const consent = { ...(c.data.consent ?? {}), whatsapp: { status: 'nee', op: nu.toISOString(), bron: 'opt-out via WhatsApp' } }
        await tx.execute(sql`update contacts set data = jsonb_set(data, '{consent}', ${JSON.stringify(consent)}::jsonb), updated_at = now() where id = ${c.id}`)
        optOuts++
      }
    }
  }
  return { statussen, optOuts }
}
