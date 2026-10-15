// Campagnes op de server (P16, F12). Doelgroep naar accounts, voorbereiden (overslagen met reden,
// kanaaldekking, branchedekking, capaciteit), maken als concept, activeren (startdatum, taken gespreid
// over koude belblokken en regiodagen), kolomwissel met uitkomst via rondAf (gat 38), resultaat en
// de afsluiter. De pure kern staat in shared/campagnes.ts.
import { sql } from 'drizzle-orm'
import { campagneAdvies, campagneResultaat, campagneTempo, KOLOMMEN, capaciteit, isAfgelopen, kanaalDekking, KOLOM_MET_UITKOMST, omvangMelding, overslagen, spreidTaken, taakTitel, type Blok, type Campagnesoort, type Kanaal, type Kolom } from '../../shared/campagnes'
import { regiodagenVoor, type Regio } from '../../shared/gebieden'
import { nlMoment, plusDagen } from '../../shared/datum'
import { afkoelingTot, KANALEN } from '../../shared/nbStatus'
import { blokkenVan } from './bellen'
import { gebruikDb } from './db'
import { leesStand } from './vvProjectie'
import { rondAf } from './taken'
import { voerAiStapUit } from './llm-provider'
import { eigenTeams } from './gebruikers'
import type { JsonSchema } from '../../shared/aiStap'
import { stijlScore } from '../../shared/schrijver'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))
const datum = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))
const fout = (s: number, m: string, extra: object = {}): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m, data: extra }) }
void KANALEN

export async function soorten(tx: Tx): Promise<(Campagnesoort & { id: string; actief: boolean })[]> {
  return (await rijen(tx, sql`select id, sleutel, groep, naam, actief, data from campagnesoorten order by (data->>'startsoort')::boolean desc nulls last, groep, naam`)).map((r) => ({ ...(r.data as Campagnesoort), id: r.id, sleutel: r.sleutel, groep: r.groep, naam: r.naam, actief: r.actief }))
}

export type Bron = { soort: 'doelgroep' | 'fase' | 'importbatch' | 'leadronde' | 'vrij'; id?: string | null; accountIds?: string[] }
/** Accounts uit de gekozen bron: doelgroep, fase in een reis, importbatch, leadronde of een vrije keuze. */
export async function bronAccounts(tx: Tx, b: Bron, eigenaar: string | null): Promise<string[]> {
  const eigen = eigenaar ? sql`and owner_id = ${eigenaar}` : sql``
  switch (b.soort) {
    case 'doelgroep': return (await rijen(tx, sql`select id from accounts where doelgroep_id = ${b.id ?? ''} and account_kind = 'prospect' ${eigen}`)).map((r) => r.id)
    case 'fase': return (await rijen(tx, sql`select id from accounts where fase_id = ${b.id ?? ''} and account_kind = 'prospect' ${eigen}`)).map((r) => r.id)
    case 'importbatch': return (await rijen(tx, sql`select id from accounts where data->>'importBatchId' = ${b.id ?? ''}`)).map((r) => r.id)
    case 'leadronde': return (await rijen(tx, sql`select distinct account_id as id from leads where ronde_id = ${b.id ?? ''} and account_id is not null`)).map((r) => r.id)
    default: return [...new Set(b.accountIds ?? [])].slice(0, 500)
  }
}

/** Kandidaten met wat overslaan en dekking nodig hebben. */
async function kandidaten(tx: Tx, ids: string[]) {
  if (!ids.length) return []
  const l = ids.join(',')
  const rows = await rijen(tx, sql`select a.id, a.name, a.nb_status, a.owner_id, a.gebied_id, a.vv_branche_id, a.data->'nee' as nee, (a.data->'reis'->'ritme'->>'actief')::boolean as ritme, a.data->>'partnerId' as partner, a.data->>'adres' as adres, a.city,
      exists (select 1 from contacts c where c.account_id = a.id and c.status <> 'vertrokken' and coalesce(c.data->>'telefoon', c.data->>'mobiel', '') <> '') or coalesce(a.data->>'telefoon', '') <> '' as telefoon,
      exists (select 1 from contacts c where c.account_id = a.id and c.status <> 'vertrokken' and coalesce(c.email, '') <> '') as email,
      exists (select 1 from contacts c where c.account_id = a.id and c.status <> 'vertrokken' and coalesce(c.data->>'linkedin', '') <> '') as linkedin,
      (select array_agg(ci.campagne_id) from campagne_items ci join campagnes cp on cp.id = ci.campagne_id where ci.account_id = a.id and cp.status in ('wacht', 'actief') and ci.kolom not in ('afspraak', 'geparkeerd', 'afgewezen')) as campagnes
    from accounts a where a.id = any(string_to_array(${l}, ','))`)
  return rows.map((r) => ({ id: r.id as string, naam: r.name as string, nbStatus: r.nb_status, ownerId: r.owner_id, regioId: r.gebied_id, brancheId: r.vv_branche_id, ritmeActief: !!r.ritme, partner: r.partner, campagneIds: (r.campagnes ?? []) as string[], nee: r.nee, telefoon: !!r.telefoon, email: !!r.email, linkedin: !!r.linkedin, adres: !!(r.adres || r.city) }))
}

/** Beschikbare uren per week van de eigenaars: koude belblokken (binnendienst) of regiodagen (buitendienst, 6 uur per dag). */
async function beschikbaar(tx: Tx, eigenaars: string[], kanaal: Kanaal) {
  if (!eigenaars.length) return 0
  const us = await rijen(tx, sql`select id, werkplek, data from users where id = any(string_to_array(${eigenaars.join(',')}, ','))`)
  const [g] = await rijen(tx, sql`select value from org_settings where key = 'gebieden'`)
  const regios = (g?.value ?? []) as Regio[]
  let uren = 0
  for (const u of us) {
    if (kanaal === 'bezoek' || u.werkplek === 'buitendienst') uren += regios.reduce((s, r) => s + r.dagen.filter((d) => d.gebruikerId === u.id).length, 0) * 6
    else uren += blokkenVan(u).blokken.filter((b) => b.soort !== 'opvolging').reduce((s, b) => s + (b.minuten * b.dagen.length * (b.soort === 'gemengd' ? (b.verhouding ?? 70) / 100 : 1)) / 60, 0)
  }
  return Math.round(uren * 10) / 10
}

export interface Invoer { naam?: string; bron: Bron; kanaalVia?: 'direct' | 'partner'; brancheId?: string | null; soort: string; winpuntId?: string | null; scriptId?: string | null; boodschap?: Record<string, string> | null; mailreeks?: { dag: number; onderwerp: string; tekst: string; winpuntId?: string | null }[]; doel?: { type: 'afspraken' | 'procent'; waarde: number } | null; tussendoelen?: string[]; startOp?: string | null; eindOp?: string | null; eigenaarId?: string | null; verdeling?: { wijze: 'gelijk' | 'gebied' | 'capaciteit'; eigenaars: string[] } | null; jaarkeuze?: string | null; varianten?: unknown[]; accountIds?: string[] }

/** Voorbereiden voor de wizard: aantallen, overgeslagen met reden, dekking per kanaal en branche, capaciteit. */
export async function voorbereid(tx: Tx, door: { id: string; rol: string }, inv: Invoer, nu = new Date()) {
  const soort = (await soorten(tx)).find((s) => s.sleutel === inv.soort) ?? null
  const ids = await bronAccounts(tx, inv.bron, ['salesmanager', 'beheerder'].includes(door.rol) ? null : door.id)
  const k = await kandidaten(tx, ids)
  const kanaal: Kanaal = soort?.kanalen[0] ?? 'bellen'
  const metAfkoeling = k.map((a) => ({ ...a, afkoelingTot: a.nee ? afkoelingTot(a.nee, kanaal === 'mail' ? 'mail' : kanaal === 'bezoek' ? 'bezoek' : kanaal === 'linkedin' ? 'linkedin' : 'bellen') : null }))
  const o = overslagen(metAfkoeling, inv.kanaalVia ?? 'direct', nu)
  const dekking = kanaalDekking(k.filter((a) => o.mee.some((m) => m.id === a.id)), kanaal)
  const stand = await leesStand(tx)
  const branche = (stand.branches ?? []).find((b) => b.id === inv.brancheId) as any
  const heeftVerhaal = (stand.teksten ?? []).some((t) => t.brancheId === inv.brancheId && t.sleutel === 'verhaal' && t.tekst.trim())
  const heeftBelofte = (stand.teksten ?? []).some((t) => t.brancheId === inv.brancheId && t.sleutel === 'kernbelofte' && t.tekst.trim())
  const brancheMelding = !inv.brancheId ? 'Kies een branche.' : !heeftVerhaal || !heeftBelofte ? `${branche?.naam ?? 'Deze branche'} heeft nog geen eigen ${!heeftVerhaal && !heeftBelofte ? 'verhaal en belofte' : !heeftVerhaal ? 'verhaal' : 'belofte'}. Het algemene verhaal wordt gebruikt.` : null
  const brancheAdvies = branche && ['toekomst', 'toekomstig'].includes(branche.horizon) && branche.prioriteit === 'hoog' ? 'Eerst referenties en verhaal, dan volume.' : null
  const eigenaars = inv.verdeling?.eigenaars?.length ? inv.verdeling.eigenaars : [inv.eigenaarId ?? door.id]
  const cap = soort ? capaciteit(o.mee.length, soort, await beschikbaar(tx, eigenaars, kanaal)) : null
  return {
    aantal: k.length, mee: o.mee.map((a) => ({ id: a.id, naam: a.naam })), overgeslagen: o.over.map((x) => ({ id: x.account.id, naam: x.account.naam, reden: x.reden })), samenvatting: o.samenvatting,
    dekking, omvang: omvangMelding(o.mee.length), brancheMelding, brancheAdvies, capaciteit: cap, kanaal,
    winpunten: (stand.winpunten ?? []).filter((w) => w.actief).map((w) => ({ id: w.id, titel: w.titel, omschrijving: w.omschrijving })),
  }
}

/** Een campagne maken als concept; een account in een ander ritme of een andere campagne kan er niet in. */
export async function maak(tx: Tx, org: string, door: { id: string; rol: string }, inv: Invoer, nu = new Date()) {
  const soort = (await soorten(tx)).find((s) => s.sleutel === inv.soort && s.actief)
  if (!soort) fout(400, 'Kies een campagnesoort')
  if (!inv.brancheId) fout(400, 'Kies een branche')
  const v = await voorbereid(tx, door, inv, nu)
  const gevraagd = inv.accountIds?.length ? inv.accountIds : v.mee.map((m) => m.id)
  const fout_ = v.overgeslagen.filter((o) => gevraagd.includes(o.id))
  if (fout_.length) fout(400, `${fout_.length} ${fout_.length === 1 ? 'account kan' : 'accounts kunnen'} niet mee: ${fout_.slice(0, 3).map((o) => `${o.naam} (${o.reden})`).join(', ')}`, { overgeslagen: fout_ })
  const ids = gevraagd.filter((id) => v.mee.some((m) => m.id === id))
  const versies = await rijen(tx, sql`select onderdeel, versie from vv_sublagen where status = 'bevestigd'`)
  const id = crypto.randomUUID()
  const eind = inv.eindOp ?? plusDagen(inv.startOp ?? nlMoment(nu).datum, soort!.weken * 7)
  const data = { winpuntId: inv.winpuntId ?? null, scriptId: inv.scriptId ?? null, boodschap: inv.boodschap ?? null, mailreeks: inv.mailreeks ?? [], ritme: { bron: soort!.ritme, pogingen: soort!.pogingen }, tussendoelen: inv.tussendoelen ?? [], doel: inv.doel ?? soort!.standaardDoel, capaciteit: v.capaciteit, verdeling: inv.verdeling ?? null, brancheId: inv.brancheId, jaarkeuze: inv.jaarkeuze ?? null, varianten: inv.varianten ?? [], vvVersies: Object.fromEntries(versies.map((r) => [r.onderdeel, r.versie])), bron: inv.bron, kanaalVia: inv.kanaalVia ?? 'direct', planStart: inv.startOp ?? null }
  await tx.execute(sql`insert into campagnes (id, organisation_id, naam, soort, status, doelgroep_id, eigenaar_id, ends_at, data) values (${id}, ${org}, ${inv.naam?.trim() || `${soort!.naam} ${nlMoment(nu).datum}`}, ${soort!.sleutel}, 'concept', ${inv.bron.soort === 'doelgroep' ? inv.bron.id ?? null : null}, ${inv.eigenaarId ?? door.id}, ${eind}, ${JSON.stringify(data)}::jsonb)`)
  const eigenaars = inv.verdeling?.eigenaars?.length ? inv.verdeling.eigenaars : null
  const ks = await kandidaten(tx, ids)
  for (const [i, a] of ks.entries()) {
    const eigenaar = eigenaars ? (inv.verdeling!.wijze === 'gebied' ? eigenaars.find((e) => e === a.ownerId) ?? eigenaars[i % eigenaars.length]! : eigenaars[i % eigenaars.length]!) : (a.ownerId ?? inv.eigenaarId ?? door.id)
    await tx.execute(sql`insert into campagne_items (organisation_id, campagne_id, account_id, eigenaar_id) values (${org}, ${id}, ${a.id}, ${eigenaar})`)
  }
  return { id, accounts: ks.length, melding: v.omvang }
}

/** Activeren: kanaaldekking (400), capaciteit (403 tenzij salesmanager of bevestigd), startdatum, taken. */
export async function activeerCampagne(tx: Tx, org: string, door: { id: string; rol: string; naam: string }, id: string, opties: { bevestigd?: boolean } = {}, nu = new Date()) {
  const [c] = await rijen(tx, sql`select * from campagnes where id = ${id}`)
  if (!c) fout(404, 'Campagne niet gevonden')
  if (c!.status === 'actief') return { status: 'actief', taken: 0 }
  const soort = (await soorten(tx)).find((s) => s.sleutel === c!.soort)!
  const items = await rijen(tx, sql`select account_id, eigenaar_id from campagne_items where campagne_id = ${id}`)
  const ks = await kandidaten(tx, items.map((i) => i.account_id))
  const d = kanaalDekking(ks, soort.kanalen[0] ?? 'bellen')
  if (!d.mag) fout(400, d.tekst!)
  const eigenaars = [...new Set(items.map((i) => i.eigenaar_id).filter(Boolean))] as string[]
  const cap = capaciteit(items.length, soort, await beschikbaar(tx, eigenaars, soort.kanalen[0] ?? 'bellen'))
  const manager = ['salesmanager', 'beheerder'].includes(door.rol)
  if (cap.boven && !manager && !c!.data?.bevestigdDoor) {
    if (opties.bevestigd) {
      // Vraag de salesmanager om bevestiging: een taak met de capaciteit.
      const [sm] = await rijen(tx, sql`select u.id from users u join teams t on u.id = any(t.manager_ids) join users ik on ik.team_id = t.id where ik.id = ${door.id} limit 1`)
      const [b] = sm ? [sm] : await rijen(tx, sql`select id from users where role in ('salesmanager', 'beheerder') and status = 'actief' order by role desc limit 1`)
      if (b) await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, action_type, title, status, priority, due_date, executor, campaign_id, data) values (${crypto.randomUUID()}, ${org}, ${b.id}, 'taak', ${`Bevestig campagne "${c!.naam}" boven capaciteit`}, 'open', 'hoog', now(), 'mens', ${id}, ${JSON.stringify({ aanleiding: `${door.naam.replace(/^Testgebruiker /, '')} wil een campagne starten: ${cap.tekst}.`, campagneId: id, link: `/campagnes/${id}` })}::jsonb)`)
      await tx.execute(sql`update campagnes set status = 'wacht', updated_at = now() where id = ${id}`)
      return { status: 'wacht', taken: 0, tekst: 'Je salesmanager bevestigt de campagne.' }
    }
    fout(403, `Boven capaciteit: ${cap.tekst}. Vraag je salesmanager om bevestiging.`, { reden: 'capaciteit', capaciteit: cap })
  }
  const start = c!.data?.planStart && c!.data.planStart >= nlMoment(nu).datum ? c!.data.planStart : nlMoment(nu).datum
  const eind = datum(c!.ends_at) && datum(c!.ends_at)! > start ? datum(c!.ends_at)! : plusDagen(start, soort.weken * 7)
  await tx.execute(sql`update campagnes set status = 'actief', started_at = ${start}, ends_at = ${eind}, versie = versie + 1, updated_at = now(), data = data || ${JSON.stringify(cap.boven ? { bevestigdDoor: c!.data?.bevestigdDoor ?? (manager ? door.id : null) } : {})}::jsonb where id = ${id}`)
  const t = await maakTaken(tx, org, id, null, nu)
  return { status: 'actief', taken: t.aantal, tekst: `Campagne gestart. ${t.aantal} ${t.aantal === 1 ? 'taak' : 'taken'} gespreid over ${soort.uitvoerder === 'buitendienst' ? 'de regiodagen' : 'je koude belblokken'}.` }
}

/** Taken voor items zonder open taak: titel, script of concept, eigenaar, gespreid over de looptijd. */
export async function maakTaken(tx: Tx, org: string, id: string, itemIds: string[] | null, nu = new Date()) {
  const [c] = await rijen(tx, sql`select * from campagnes where id = ${id}`)
  if (!c || c.status !== 'actief') fout(409, 'Activeer de campagne eerst')
  const soort = (await soorten(tx)).find((s) => s.sleutel === c!.soort)!
  const items = await rijen(tx, sql`select ci.account_id, ci.eigenaar_id, a.name, a.gebied_id, u.werkplek, u.data as udata from campagne_items ci join accounts a on a.id = ci.account_id left join users u on u.id = ci.eigenaar_id
    where ci.campagne_id = ${id} and ci.kolom not in ('afspraak', 'geparkeerd', 'afgewezen') ${itemIds?.length ? sql`and ci.account_id = any(string_to_array(${itemIds.join(',')}, ','))` : sql``}
    and not exists (select 1 from tasks t where t.campaign_id = ${id} and t.account_id = ci.account_id and t.status in ('open', 'bezig'))`)
  // Spreiden vanaf vandaag (of de latere startdatum) tot de einddatum; nooit in het verleden.
  const vandaag = nlMoment(nu).datum
  const looptijd = { start: datum(c!.started_at)! > vandaag ? datum(c!.started_at)! : vandaag, eind: datum(c!.ends_at)! < vandaag ? vandaag : datum(c!.ends_at)! }
  // Koude belblokken binnen de looptijd, met het aantal plekken (één gesprek per 8 minuten).
  const blokken: Blok[] = []
  const gezien = new Set<string>()
  for (const it of items) {
    if (!it.eigenaar_id || gezien.has(it.eigenaar_id)) continue
    gezien.add(it.eigenaar_id)
    const vast = blokkenVan({ werkplek: it.werkplek, data: it.udata }).blokken.filter((b) => b.soort !== 'opvolging')
    for (let d = looptijd.start; d <= looptijd.eind; d = plusDagen(d, 1)) {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
      for (const b of vast.filter((x) => x.dagen.includes(wd))) blokken.push({ datum: d, start: b.start, plekken: Math.max(1, Math.floor((b.minuten * (b.soort === 'gemengd' ? (b.verhouding ?? 70) / 100 : 1)) / 8)), eigenaarId: it.eigenaar_id })
    }
  }
  const [g] = await rijen(tx, sql`select value from org_settings where key = 'gebieden'`)
  const [w] = await rijen(tx, sql`select value from org_settings where key = 'werkdagen'`)
  const feestdagen = ((w?.value as any)?.feestdagen ?? []) as string[]
  const regiodagen = regiodagenVoor((g?.value ?? []) as Regio[], looptijd.start, Math.max(1, Math.round((Date.parse(looptijd.eind) - Date.parse(looptijd.start)) / 864e5) + 1), feestdagen)
  const plan = spreidTaken(items.map((i) => ({ accountId: i.account_id, eigenaarId: i.eigenaar_id, werkplek: soort.uitvoerder === 'buitendienst' || i.werkplek === 'buitendienst' ? 'buitendienst' : 'binnendienst', regioId: i.gebied_id })), blokken, regiodagen, looptijd, feestdagen)
  const stand = await leesStand(tx)
  const winpunt = (stand.winpunten ?? []).find((x) => x.id === c!.data?.winpuntId)
  const actie = soort.kanalen[0] === 'mail' ? 'mailen' : soort.kanalen[0] === 'bezoek' ? 'bezoek' : soort.kanalen[0] === 'linkedin' ? 'linkedin' : 'bellen'
  for (const it of items) {
    const due = plan.get(it.account_id)!
    const concept = actie === 'mailen' ? (c!.data?.mailreeks?.[0] ? { onderwerp: c!.data.mailreeks[0].onderwerp, tekst: c!.data.mailreeks[0].tekst } : c!.data?.boodschap?.mail ? { onderwerp: c!.naam, tekst: c!.data.boodschap.mail } : null) : null
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, campaign_id, data) values (${crypto.randomUUID()}, ${org}, ${it.eigenaar_id}, ${it.account_id}, ${actie}, ${taakTitel(soort.werkwoord, it.name, c!.naam)}, 'open', 'middel', ${due}, 'mens', ${id},
      ${JSON.stringify({ campagneId: id, herkomst: { bron: 'campagne', campagneId: id }, aanleiding: winpunt ? `Campagne ${c!.naam} · winpunt: ${winpunt.titel}` : `Campagne ${c!.naam}`, scriptId: c!.data?.scriptId ?? null, ...(concept ? { concept, executorStatus: 'concept-klaar' } : {}), poging: { n: 1, van: soort.pogingen, kanaal: soort.kanalen[0] } })}::jsonb)`)
    await tx.execute(sql`update campagne_items set kolom = case when kolom = 'gespot' then 'gespot' else kolom end, volgende_stap = ${taakTitel(soort.werkwoord, it.name, c!.naam)}, volgende_op = ${due}, updated_at = now() where campagne_id = ${id} and account_id = ${it.account_id}`)
  }
  return { aantal: items.length }
}

/** Verdelen over verkopers (salesmanager): gelijk, op gebied (eigenaar van het account) of op capaciteit. */
export async function verdeel(tx: Tx, id: string, v: { wijze: 'gelijk' | 'gebied' | 'capaciteit'; eigenaars: string[] }) {
  if (!v.eigenaars.length) fout(400, 'Kies minstens één verkoper')
  const items = await rijen(tx, sql`select ci.id, a.owner_id from campagne_items ci join accounts a on a.id = ci.account_id where ci.campagne_id = ${id} order by a.name`)
  const gewicht = v.wijze === 'capaciteit' ? await Promise.all(v.eigenaars.map(async (e) => Math.max(1, await beschikbaar(tx, [e], 'bellen')))) : v.eigenaars.map(() => 1)
  const som = gewicht.reduce((s, x) => s + x, 0)
  const quota = gewicht.map((x) => Math.round((x / som) * items.length))
  const telling = v.eigenaars.map(() => 0)
  for (const it of items) {
    let i = v.wijze === 'gebied' ? v.eigenaars.indexOf(it.owner_id) : -1
    if (i < 0) i = telling.findIndex((n, k) => n < quota[k]!) >= 0 ? telling.findIndex((n, k) => n < quota[k]!) : telling.indexOf(Math.min(...telling))
    telling[i]!++
    await tx.execute(sql`update campagne_items set eigenaar_id = ${v.eigenaars[i]} where id = ${it.id}`)
    await tx.execute(sql`update tasks set owner_id = ${v.eigenaars[i]} where campaign_id = ${id} and status in ('open', 'bezig') and account_id = (select account_id from campagne_items where id = ${it.id})`)
  }
  await tx.execute(sql`update campagnes set data = data || ${JSON.stringify({ verdeling: v })}::jsonb, updated_at = now() where id = ${id}`)
  return { verdeeld: items.length }
}

/**
 * Kolomwissel op het bord. Naar Afspraak, Geparkeerd of Afgewezen vraagt een uitkomst; de open taak
 * wordt afgerond via rondAf met dezelfde uitkomst, zodat bord en taak nooit uiteenlopen (gat 38).
 */
export async function kolomWissel(tx: Tx, org: string, door: string, campagneId: string, accountId: string, k: { kolom: Kolom; uitkomst?: string | null; reden?: string | null; toelichting?: string | null; laterOp?: string | null; winpuntUitgevoerd?: boolean | null; sleutel?: string | null }, nu = new Date()) {
  const [it] = await rijen(tx, sql`select * from campagne_items where campagne_id = ${campagneId} and account_id = ${accountId}`)
  if (!it) fout(404, 'Dit account zit niet in de campagne')
  if (KOLOM_MET_UITKOMST.includes(k.kolom) && !k.uitkomst) fout(400, 'Kies de uitkomst')
  if (k.uitkomst === 'geen_interesse' && !k.reden) fout(400, 'Kies een reden')
  const [t] = await rijen(tx, sql`select id from tasks where campaign_id = ${campagneId} and account_id = ${accountId} and status in ('open', 'bezig') order by due_date limit 1`)
  if (k.uitkomst && t) await rondAf(tx, t.id, { uitkomst: k.uitkomst as any, reden: k.reden ?? null, toelichting: k.toelichting ?? null, laterOp: k.laterOp ?? null, sleutel: k.sleutel ?? `kolom:${campagneId}:${accountId}:${k.kolom}` }, door, nu)
  else if (k.uitkomst) await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, kanaal, uitkomst, door, op, data) values (${org}, ${accountId}, 'contact', 'bellen', ${k.uitkomst}, ${door}, ${nu.toISOString()}, ${JSON.stringify({ campagneId, reden: k.reden ?? null })}::jsonb)`)
  // De kolom komt van het bord (de gebruiker koos hem); rondAf zette hem al naar de uitkomst.
  await tx.execute(sql`update campagne_items set kolom = ${k.kolom}, einddoel_gehaald = einddoel_gehaald or ${k.kolom === 'afspraak'}, winpunt_uitgevoerd = coalesce(${k.winpuntUitgevoerd ?? null}::boolean, winpunt_uitgevoerd), updated_at = now() where id = ${it!.id}`)
  if (['afspraak', 'geparkeerd', 'afgewezen'].includes(k.kolom)) await tx.execute(sql`update tasks set status = 'geannuleerd', updated_at = now(), data = data || '{"geannuleerdDoor": "campagnebord"}'::jsonb where campaign_id = ${campagneId} and account_id = ${accountId} and status in ('open', 'bezig')`)
  return { kolom: k.kolom }
}

/** Het resultaat (afgerond of tussenstand). */
export async function resultaat(tx: Tx, id: string) {
  const items = await rijen(tx, sql`select account_id, kolom, winpunt_uitgevoerd from campagne_items where campagne_id = ${id}`)
  const [c] = await rijen(tx, sql`select started_at from campagnes where id = ${id}`)
  const ids = items.map((i) => i.account_id)
  const acts = ids.length ? await rijen(tx, sql`select account_id, soort, uitkomst, data->>'gebeurtenis' as gebeurtenis from activiteiten where account_id = any(string_to_array(${ids.join(',')}, ',')) and op >= ${c?.started_at ?? '1970-01-01'}`) : []
  return campagneResultaat(items.map((i) => ({ accountId: i.account_id, kolom: i.kolom, winpuntUitgevoerd: i.winpunt_uitgevoerd })), acts.map((a) => ({ accountId: a.account_id, soort: a.soort, uitkomst: a.uitkomst, gebeurtenis: a.gebeurtenis })))
}

/** De afsluiter (motor): na de einddatum gaat een actieve campagne naar Afgerond met de samenvatting. */
export async function sluitAf(tx: Tx, nu = new Date()) {
  const actief = await rijen(tx, sql`select id, status, ends_at from campagnes where status = 'actief'`)
  let n = 0
  for (const c of actief) {
    if (!isAfgelopen({ status: c.status, endsAt: datum(c.ends_at) }, nu)) continue
    const r = await resultaat(tx, c.id)
    await tx.execute(sql`update campagnes set status = 'afgerond', data = data || ${JSON.stringify({ resultaat: r, afgerondOp: nu.toISOString() })}::jsonb, updated_at = now() where id = ${c.id}`)
    n++
  }
  return n
}

/** Achterstand per account voor de motorregel SR11 (campagne-achterstand). */
export async function achterstandPerAccount(tx: Tx, nu = new Date()): Promise<Map<string, { id: string; achterstand: number; naam: string }[]>> {
  const cs = await rijen(tx, sql`select id, naam, started_at, ends_at, data->'doel' as doel from campagnes where status = 'actief'`)
  const uit = new Map<string, { id: string; achterstand: number; naam: string }[]>()
  for (const c of cs) {
    const items = await rijen(tx, sql`select account_id, einddoel_gehaald from campagne_items where campagne_id = ${c.id}`)
    const t = campagneTempo({ startedAt: iso(c.started_at), endsAt: iso(c.ends_at), doel: c.doel }, items.map((i) => ({ einddoelGehaald: i.einddoel_gehaald })), nu)
    if (!t) continue
    for (const i of items) uit.set(i.account_id, [...(uit.get(i.account_id) ?? []), { id: c.id, achterstand: t.achterstand, naam: c.naam }])
  }
  return uit
}

// ── AI: winpuntvoorstel en boodschap (Schrijver, mandaat A, soort concept) ───

export const WINPUNT_SCHEMA: JsonSchema = { type: 'object', required: ['winpuntId', 'motivatie'], additionalProperties: false, properties: { winpuntId: { type: 'string' }, motivatie: { type: 'string', maxLength: 320 } } }
export const BOODSCHAP_SCHEMA: JsonSchema = { type: 'object', required: ['tekst', 'stijlscore'], additionalProperties: false, properties: { onderwerp: { type: 'string', maxLength: 120 }, tekst: { type: 'string', maxLength: 1200 }, stijlscore: { type: 'number' } } }
export async function winpuntVoorstel(tx: Tx, org: string, gebruiker: any, faseId: string | null, nu = new Date()) {
  const stand = await leesStand(tx)
  const winpunten = (stand.winpunten ?? []).filter((w) => w.actief)
  const verslagen = (await rijen(tx, sql`select data->>'tekst' as tekst from activiteiten where data->>'tekst' is not null order by op desc limit 20`)).map((r) => r.tekst)
  const r = await voerAiStapUit<{ winpuntId: string; motivatie: string }>(tx, org, { soort: 'concept', prompt: 'Kies uit de bevestigde winpunten het winpunt dat past bij deze fase en de laatste verslagen. Schrijf geen nieuw winpunt. Motivatie hooguit 40 woorden, zonder namen.', schema: WINPUNT_SCHEMA, materiaal: { campagneWinpunt: true, faseId, winpunten: winpunten.map((w) => ({ id: w.id, titel: w.titel, faseId: w.faseId })), verslagen }, gebruiker, boekAls: 'schrijver' }, nu)
  if (!r.ok || !winpunten.some((w) => w.id === r.antwoord.winpuntId)) return null
  return { winpuntId: r.antwoord.winpuntId, motivatie: r.antwoord.motivatie.split(/\s+/).slice(0, 40).join(' ') }
}
export async function boodschap(tx: Tx, org: string, gebruiker: any, k: { kanaal: 'mail' | 'linkedin' | 'kaart'; toon: 'Zakelijk' | 'Persoonlijk' | 'Kort'; winpuntId: string | null; brancheId: string | null }, nu = new Date()) {
  const stand = await leesStand(tx)
  const winpunt = (stand.winpunten ?? []).find((w) => w.id === k.winpuntId)
  const verhaal = (stand.teksten ?? []).find((t) => t.sleutel === 'verhaal' && t.brancheId === k.brancheId)?.tekst ?? (stand.teksten ?? []).find((t) => t.sleutel === 'bedrijfsverhaal' && !t.brancheId)?.kernzin ?? null
  const belofte = (stand.teksten ?? []).find((t) => t.sleutel === 'kernbelofte' && (t.brancheId === k.brancheId || !t.brancheId))?.tekst ?? null
  const materiaal = { campagneBoodschap: true, kanaal: k.kanaal, toon: k.toon, verhaal, belofte, winpunt: winpunt ? { titel: winpunt.titel, omschrijving: winpunt.omschrijving } : null }
  let r = await voerAiStapUit<{ onderwerp?: string; tekst: string; stijlscore: number }>(tx, org, { soort: 'concept', prompt: 'Schrijf een eerste bericht: waarom, hoe, vraag. Eén winpunt met één bewijs. Je-vorm, geen gedachtestreepjes. Geef een stijlscore van 0 tot 10.', schema: BOODSCHAP_SCHEMA, materiaal, gebruiker, boekAls: 'schrijver' }, nu)
  // De stijlscore rekent de Schrijver zelf uit (shared/schrijver.ts, gat 16); onder 7 één keer opnieuw.
  if (r.ok && stijlScore(r.antwoord.tekst).score < 7) r = await voerAiStapUit(tx, org, { soort: 'concept', prompt: `Opnieuw, korter en concreter. Vermijd: ${stijlScore(r.antwoord.tekst).vermeden.join(', ') || 'jargon'}.`, schema: BOODSCHAP_SCHEMA, materiaal, gebruiker, boekAls: 'schrijver' }, nu)
  if (!r.ok) return null
  r.antwoord.stijlscore = stijlScore(r.antwoord.tekst).score
  const versies = await rijen(tx, sql`select onderdeel, versie from vv_sublagen where status = 'bevestigd'`)
  return { ...r.antwoord, vvVersies: Object.fromEntries(versies.map((x) => [x.onderdeel, x.versie])) }
}


// ── Lezen: lijst en bord ─────────────────────────────────────────────────

const campagneUit = (c: Rij, items: { einddoel_gehaald: boolean; kolom: string }[], nu: Date) => {
  const doel = c.data?.doel ?? null
  const tempo = c.status === 'actief' ? campagneTempo({ startedAt: iso(c.started_at), endsAt: iso(c.ends_at), doel }, items.map((i) => ({ einddoelGehaald: i.einddoel_gehaald })), nu) : null
  const eind = datum(c.ends_at)
  return {
    id: c.id, naam: c.naam, soort: c.soort, status: c.status, eigenaarId: c.eigenaar_id, eigenaar: c.eigenaar ?? null, versie: c.versie,
    startOp: datum(c.started_at), eindOp: eind, doel, winpuntId: c.data?.winpuntId ?? null, brancheId: c.data?.brancheId ?? null,
    accounts: items.length, klaar: items.filter((i) => EIND.includes(i.kolom)).length, afspraken: items.filter((i) => i.kolom === 'afspraak').length,
    gehaald: items.filter((i) => i.einddoel_gehaald).length, tempo,
    dagenOver: eind && c.status === 'actief' ? Math.max(0, Math.round((Date.parse(eind) - Date.parse(nlMoment(nu).datum)) / 864e5)) : null,
  }
}
const EIND = ['afspraak', 'geparkeerd', 'afgewezen']

/** De lijst met tempo per campagne. Filters: status, soort, eigenaar (een id of 'mij'). */
export async function lijst(tx: Tx, f: { status?: string | null; soort?: string | null; eigenaar?: string | null }, nu = new Date()) {
  const cs = await rijen(tx, sql`select c.*, u.name as eigenaar from campagnes c left join users u on u.id = c.eigenaar_id
    where (${f.status ?? null}::text is null or c.status = ${f.status ?? null}) and (${f.soort ?? null}::text is null or c.soort = ${f.soort ?? null})
      and (${f.eigenaar ?? null}::text is null or c.eigenaar_id = ${f.eigenaar ?? null} or exists (select 1 from campagne_items ci where ci.campagne_id = c.id and ci.eigenaar_id = ${f.eigenaar ?? null}))
    order by case c.status when 'actief' then 0 when 'wacht' then 1 when 'concept' then 2 when 'gepauzeerd' then 3 else 4 end, c.ends_at nulls last, c.naam`)
  const items = cs.length ? await rijen(tx, sql`select campagne_id, kolom, einddoel_gehaald from campagne_items where campagne_id = any(string_to_array(${cs.map((c) => c.id).join(',')}, ','))`) : []
  const stand = await leesStand(tx)
  const actief = (await rijen(tx, sql`select count(*)::int as n from campagnes where status = 'actief'`))[0]?.n ?? 0
  return {
    actief,
    campagnes: cs.map((c) => ({ ...campagneUit(c, items.filter((i) => i.campagne_id === c.id) as any, nu), winpunt: (stand.winpunten ?? []).find((w) => w.id === c.data?.winpuntId)?.titel ?? null })),
  }
}

/** Het bord: kop, items per kolom met poging en volgende stap, "Begin hier" en bij afgerond de samenvatting. */
export async function bord(tx: Tx, id: string, nu = new Date()) {
  const [c] = await rijen(tx, sql`select c.*, u.name as eigenaar from campagnes c left join users u on u.id = c.eigenaar_id where c.id = ${id}`)
  if (!c) fout(404, 'Campagne niet gevonden')
  const soort = (await soorten(tx)).find((s) => s.sleutel === c!.soort) ?? null
  const items = await rijen(tx, sql`select ci.*, a.name, a.fase_id, a.laatste_contact_op, u.name as eigenaar,
      exists (select 1 from signals s where s.account_id = ci.account_id and s.status in ('nieuw', 'open')) as aanleiding,
      (select t.id from tasks t where t.campaign_id = ci.campagne_id and t.account_id = ci.account_id and t.status in ('open', 'bezig') order by t.due_date limit 1) as taak_id
    from campagne_items ci join accounts a on a.id = ci.account_id left join users u on u.id = ci.eigenaar_id where ci.campagne_id = ${id} order by ci.volgende_op nulls last, a.name`)
  const stand = await leesStand(tx)
  const uit = items.map((i) => ({
    accountId: i.account_id as string, naam: i.name as string, kolom: i.kolom as Kolom, poging: i.poging as number, pogingen: soort?.pogingen ?? 5,
    volgendeStap: i.volgende_stap, volgendeOp: iso(i.volgende_op), eigenaarId: i.eigenaar_id, eigenaar: i.eigenaar, faseId: i.fase_id,
    einddoelGehaald: !!i.einddoel_gehaald, winpuntUitgevoerd: i.winpunt_uitgevoerd, laatsteContactOp: iso(i.laatste_contact_op), aanleiding: !!i.aanleiding, taakId: i.taak_id ?? null,
  }))
  const open = await rijen(tx, sql`select count(*)::int as n from campagne_items ci where ci.campagne_id = ${id} and ci.kolom not in ('afspraak', 'geparkeerd', 'afgewezen') and not exists (select 1 from tasks t where t.campaign_id = ${id} and t.account_id = ci.account_id and t.status in ('open', 'bezig'))`)
  return {
    campagne: { ...campagneUit(c!, items as any, nu), data: c!.data, winpunt: (stand.winpunten ?? []).find((w) => w.id === c!.data?.winpuntId)?.titel ?? null, soortNaam: soort?.naam ?? c!.soort, ritme: soort ? `${soort.ritme}, ${soort.pogingen} pogingen in ${soort.weken} weken` : null, uitvoerder: soort?.uitvoerder ?? 'binnendienst' },
    kolommen: KOLOMMEN.map((k) => ({ kolom: k, items: uit.filter((i) => i.kolom === k) })),
    items: uit,
    beginHier: c!.status === 'actief' ? campagneAdvies(uit.map((i) => ({ ...i, naam: i.naam }))).map((i) => ({ accountId: i.accountId, naam: i.naam, waarom: !i.laatsteContactOp ? 'Nog nooit contact' : i.aanleiding ? 'Stil, met een aanleiding' : 'Langst stil' })) : [],
    zonderTaak: open[0]?.n ?? 0,
    resultaat: c!.status === 'afgerond' ? (c!.data?.resultaat ?? await resultaat(tx, id)) : null,
  }
}

/** Mag deze gebruiker de campagne wijzigen? Eigenaar, salesmanager van het team van de eigenaar, beheerder. */
export async function magWijzigen(tx: Tx, g: { id: string; rol: string }, c: { eigenaar_id?: string | null }) {
  if (g.rol === 'beheerder' || c.eigenaar_id === g.id) return true
  if (g.rol !== 'salesmanager') return false
  const [u] = await rijen(tx, sql`select team_id from users where id = ${c.eigenaar_id ?? ''}`)
  return !u?.team_id || (await eigenTeams(tx, g.id)).includes(u.team_id)
}
export async function laad(tx: Tx, id: string) {
  const [c] = await rijen(tx, sql`select * from campagnes where id = ${id}`)
  if (!c) fout(404, 'Campagne niet gevonden')
  return c!
}

/** Een wijziging (naam, doel, einddatum, winpunt, boodschap, script, status pauzeren of hervatten), met versie. */
export async function wijzig(tx: Tx, id: string, p: { versie?: number; naam?: string; doel?: { type: 'afspraken' | 'procent'; waarde: number }; eindOp?: string; winpuntId?: string | null; scriptId?: string | null; boodschap?: Record<string, string>; mailreeks?: unknown[]; tussendoelen?: string[]; status?: 'gepauzeerd' | 'actief'; accountIds?: string[] }, door: { id: string; rol: string }, org: string, nu = new Date()) {
  const c = await laad(tx, id)
  if (p.versie !== undefined && p.versie !== c.versie) fout(409, 'De campagne is intussen gewijzigd; laad hem opnieuw', { versie: c.versie })
  if (c.status === 'afgerond') fout(409, 'Een afgeronde campagne wijzig je niet meer')
  const data: Rij = {}
  for (const k of ['winpuntId', 'scriptId', 'boodschap', 'mailreeks', 'tussendoelen', 'doel'] as const) if (p[k] !== undefined) data[k] = p[k]
  if (p.boodschap !== undefined) {
    const versies = await rijen(tx, sql`select onderdeel, versie from vv_sublagen where status = 'bevestigd'`)
    data.vvVersies = Object.fromEntries(versies.map((r) => [r.onderdeel, r.versie]))
  }
  const status = p.status && ((p.status === 'gepauzeerd' && c.status === 'actief') || (p.status === 'actief' && c.status === 'gepauzeerd')) ? p.status : c.status
  if (p.eindOp && !/^\d{4}-\d{2}-\d{2}$/.test(p.eindOp)) fout(400, 'Einddatum ongeldig')
  await tx.execute(sql`update campagnes set naam = coalesce(${p.naam?.trim() || null}, naam), ends_at = coalesce(${p.eindOp ?? null}::date, ends_at), status = ${status}, versie = versie + 1, updated_at = now(), data = data || ${JSON.stringify(data)}::jsonb where id = ${id}`)
  let toegevoegd = 0
  if (p.accountIds?.length) {
    // + Accounts: dezelfde controles als in de wizard; een account in een ander ritme of een andere campagne kan niet.
    const k = (await kandidaten(tx, p.accountIds)).filter((a) => !a.campagneIds.includes(id))
    const o = overslagen(k, c.data?.kanaalVia ?? 'direct', nu)
    if (o.over.length) fout(400, `${o.over.length} ${o.over.length === 1 ? 'account kan' : 'accounts kunnen'} niet mee: ${o.over.slice(0, 3).map((x) => `${x.account.naam} (${x.reden})`).join(', ')}`, { overgeslagen: o.over.map((x) => ({ id: x.account.id, naam: x.account.naam, reden: x.reden })) })
    for (const a of k) {
      const r = await tx.execute(sql`insert into campagne_items (organisation_id, campagne_id, account_id, eigenaar_id) values (${org}, ${id}, ${a.id}, ${a.ownerId ?? c.eigenaar_id ?? door.id}) on conflict (campagne_id, account_id) do nothing`)
      toegevoegd += r.rowCount ?? 0
    }
  }
  const na = await laad(tx, id)
  return { id: na.id as string, versie: na.versie as number, status: na.status as string, toegevoegd }
}
