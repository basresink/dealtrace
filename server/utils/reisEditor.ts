// De reiseditor op de server (P22, F05). Een wijziging aan een actieve reis gaat altijd in een concept
// (een eigen rij met data.basisId); publiceren schrijft een nieuwe versie (reisversies, alleen toevoegen),
// zet accounts om met de fasemapping via het meldpunt en ruimt het concept op. Fase verwijderen eist een
// vervangende fase en zet overgangen, regels, startactiviteiten en accounts echt om (regel 42).
import { sql } from 'drizzle-orm'
import { blokkeertPublicatie, KIESBARE_GEBEURTENISSEN, droogloop, faseMapping, mappingFouten, schoonReisData, verwijderFase, type DroogAccount } from '../../shared/reisEditor'
import { instapFase, pastInDoelgroep, standaardReisData, valideerReis, type ActiviteitTemplate, type ReisData } from '../../shared/reis'
import { schrijfAudit } from './audit'
import { gebruikDb } from './db'
import { voerAiStapUit } from './llm-provider'
import { alsDoelgroepAccount, zetOmNaarVersie } from './reis'
import { leesStand } from './vvProjectie'
import { PROMPT_REISVOORSTEL } from '../../shared/promptStandaard'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string, data?: unknown): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m, data }) }

export interface Bewerker { id: string; rol: string; manager: boolean }
export async function laadReis(tx: Tx, id: string) {
  const [r] = await rijen(tx, sql`select * from reistemplates where id = ${id}`)
  if (!r) fout(404, 'Reis onbekend')
  return r!
}
const activiteitenVan = async (tx: Tx, reisId: string) => (await rijen(tx, sql`select id, fase_id, data from activiteitstemplates where reistemplate_id = ${reisId} order by id`)).map((a) => ({ ...(a.data as ActiviteitTemplate), faseId: a.fase_id, id: a.id }))

/** Mag deze gebruiker dit concept bewerken? Een Expert alleen zijn eigen concept; een manager elk concept. */
function magBewerken(r: Rij, g: Bewerker) {
  if (r.status !== 'concept') fout(409, 'Een actieve versie wijzig je niet. Maak een concept.')
  if (!g.manager && r.eigenaar_id !== g.id) fout(403, 'Dit concept is van een collega')
}

/** Een nieuwe reis of een concept van een actieve reis: leeg, vanuit de standaard of een bestaande reis. */
export async function maakConcept(tx: Tx, org: string, g: Bewerker, b: { vanuit: 'leeg' | 'standaard' | string; naam?: string | null; doelgroepId?: string | null }) {
  let data: ReisData = { fases: [], overgangen: [] }
  let basisId: string | null = null
  let acts: ActiviteitTemplate[] = []
  let naam = b.naam?.trim() || 'Nieuwe reis'
  if (b.vanuit === 'standaard') {
    const [s] = await rijen(tx, sql`select * from reistemplates where is_standaard`)
    data = s?.data ?? standaardReisData()
    if (s) acts = await activiteitenVan(tx, s.id)
  } else if (b.vanuit !== 'leeg') {
    const bron = await laadReis(tx, b.vanuit)
    data = bron.data
    acts = await activiteitenVan(tx, bron.id)
    // Een concept van een actieve maatwerkreis wordt later diens nieuwe versie; dupliceren van de standaard niet.
    if (!bron.is_standaard && bron.status !== 'concept' && !b.naam) { basisId = bron.id; naam = bron.naam }
    else if (!b.naam) naam = `${bron.naam} (kopie)`
  }
  if (basisId) {
    const [al] = await rijen(tx, sql`select id from reistemplates where status = 'concept' and data->>'basisId' = ${basisId}`)
    if (al) return { id: al.id as string, bestaand: true }
  }
  const id = crypto.randomUUID()
  const [basis] = basisId ? await rijen(tx, sql`select versie, doelgroep_id from reistemplates where id = ${basisId}`) : []
  await tx.execute(sql`insert into reistemplates (id, organisation_id, naam, doelgroep_id, versie, status, is_standaard, eigenaar_id, bron, data)
    values (${id}, ${org}, ${naam.slice(0, 120)}, ${b.doelgroepId ?? basis?.doelgroep_id ?? null}, ${basis ? Number(basis.versie) + 1 : 1}, 'concept', false, ${g.id}, ${JSON.stringify({ vanuit: b.vanuit })}::jsonb, ${JSON.stringify({ ...data, basisId })}::jsonb)`)
  for (const a of acts) await tx.execute(sql`insert into activiteitstemplates (organisation_id, reistemplate_id, fase_id, versie, data) values (${org}, ${id}, ${a.faseId}, 1, ${JSON.stringify({ ...a, id: undefined })}::jsonb)`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'reis.concept', resourceType: 'reistemplates', resourceId: id, changes: { vanuit: b.vanuit, basisId } })
  return { id, bestaand: false }
}

/** Het concept bewaren: naam, doelgroep, fases, overgangen, overschrijvingen en startactiviteiten. */
export async function bewaarConcept(tx: Tx, org: string, g: Bewerker, id: string, b: { naam?: string; doelgroepId?: string | null; data?: unknown; activiteiten?: unknown[] }) {
  const r = await laadReis(tx, id)
  magBewerken(r, g)
  const data = b.data ? { ...schoonReisData(b.data), basisId: r.data?.basisId ?? null } : r.data
  if (b.doelgroepId) {
    const [d] = await rijen(tx, sql`select id from doelgroepen where id = ${b.doelgroepId}`)
    if (!d) fout(422, 'Doelgroep onbekend')
  }
  await tx.execute(sql`update reistemplates set naam = ${b.naam?.trim().slice(0, 120) || r.naam}, doelgroep_id = ${b.doelgroepId === undefined ? r.doelgroep_id : b.doelgroepId}, data = ${JSON.stringify(data)}::jsonb, updated_at = now() where id = ${id}`)
  if (Array.isArray(b.activiteiten)) {
    const fases = new Set((data.fases as any[]).map((f) => f.id))
    await tx.execute(sql`delete from activiteitstemplates where reistemplate_id = ${id}`)
    for (const a of b.activiteiten.slice(0, 200) as any[]) {
      if (!fases.has(a?.faseId) || !String(a?.naam ?? '').trim()) continue
      const schoon: ActiviteitTemplate = { faseId: a.faseId, naam: String(a.naam).trim().slice(0, 80), rol: ['binnendienst', 'buitendienst', 'alle'].includes(a.rol) ? a.rol : 'alle', actiesoort: ['taak', 'bellen', 'mail', 'bezoek', 'briefing', 'pitstop', 'overdracht', 'terugkom'].includes(a.actiesoort) ? a.actiesoort : 'taak', termijnWerkdagen: Math.max(0, Math.min(60, Math.round(Number(a.termijnWerkdagen) || 0))), uitvoerder: 'eigenaar', ...(a.belscript ? { belscript: String(a.belscript) } : {}), ...(a.omschrijving ? { omschrijving: String(a.omschrijving).slice(0, 300) } : {}) }
      await tx.execute(sql`insert into activiteitstemplates (organisation_id, reistemplate_id, fase_id, versie, data) values (${org}, ${id}, ${schoon.faseId}, 1, ${JSON.stringify(schoon)}::jsonb)`)
    }
  }
  return valideerReis(data)
}

/** Fase verwijderen in een concept: vervangende fase verplicht; overgangen en startactiviteiten gaan mee. */
export async function verwijderFaseUitConcept(tx: Tx, g: Bewerker, id: string, faseId: string, vervangendeFaseId: string) {
  const r = await laadReis(tx, id)
  magBewerken(r, g)
  if (!vervangendeFaseId) fout(422, 'Kies een vervangende fase')
  const voor = (r.data.overgangen as any[]).filter((x) => x.vanFaseId === faseId || x.naarFaseId === faseId).length
  const nieuw = verwijderFase(r.data, faseId, vervangendeFaseId)
  const acts = await rijen(tx, sql`update activiteitstemplates set fase_id = ${vervangendeFaseId}, data = jsonb_set(data, '{faseId}', to_jsonb(${vervangendeFaseId}::text)) where reistemplate_id = ${id} and fase_id = ${faseId} returning id`)
  await tx.execute(sql`update reistemplates set data = ${JSON.stringify({ ...nieuw, basisId: r.data?.basisId ?? null, verwijderd: { ...(r.data?.verwijderd ?? {}), [faseId]: vervangendeFaseId } })}::jsonb, updated_at = now() where id = ${id}`)
  return { overgangen: voor, activiteiten: acts.length }
}

const accountsVoor = async (tx: Tx) => (await rijen(tx, sql`select a.id, a.reis_id, a.fase_id, a.owner_id, a.nb_status, a.klasse, a.postcode, a.gebied_id, a.nb_bron, a.vv_branche_id, a.data, a.gedeactiveerd_op, u.werkplek
  from accounts a left join users u on u.id = a.owner_id where a.account_kind = 'prospect' and a.nb_status not in ('overgedragen', 'klant')`))

/** Welke accounts horen bij publicatie in deze reis: die er nu al in zitten, plus die van de doelgroep. */
async function doelAccounts(tx: Tx, r: Rij) {
  const basisId = r.data?.basisId ?? null
  const reisId = basisId ?? r.id
  const alle = await accountsVoor(tx)
  const [d] = r.doelgroep_id ? await rijen(tx, sql`select * from doelgroepen where id = ${r.doelgroep_id}`) : []
  const andere = new Set((await rijen(tx, sql`select id from reistemplates where not is_standaard and status = 'actief' and id <> ${reisId}`)).map((x) => x.id as string))
  const lijst = alle.filter((a) => a.reis_id === reisId || (d && pastInDoelgroep(alsDoelgroepAccount({ klasse: a.klasse, postcode: a.postcode, gebiedId: a.gebied_id, nbBron: a.nb_bron, vvBrancheId: a.vv_branche_id, data: a.data } as any), d as any)))
  return { reisId, andere, gedeactiveerd: new Set(lijst.filter((a) => a.gedeactiveerd_op).map((a) => a.id as string)), accounts: lijst.map((a): DroogAccount => ({ id: a.id, reisId: a.reis_id, faseId: a.fase_id, ownerId: a.owner_id, werkplek: a.werkplek, ritmeActief: !!a.data?.reis?.ritme?.actief, nbStatus: a.nb_status })) }
}

export async function droogloopVoor(tx: Tx, id: string, mapping?: Record<string, string | null>) {
  const r = await laadReis(tx, id)
  // De droogloop rekent zoals de motor: gedeactiveerde prospects doen niet mee.
  const { reisId, andere, accounts: alle, gedeactiveerd } = await doelAccounts(tx, r)
  const accounts = alle.filter((a) => !gedeactiveerd.has(a.id))
  const oud = r.data?.basisId ? (await laadReis(tx, reisId)).data : null
  const map = mapping ?? (oud ? faseMapping(oud, r.data) : faseMapping({ fases: (await rijen(tx, sql`select data from reistemplates where is_standaard`))[0]?.data?.fases ?? [] }, r.data))
  return droogloop(r.data, accounts, await activiteitenVan(tx, id), { reisId, mapping: map, andereReizen: andere })
}

/** De mapping die publicatie nodig heeft: per oude fase met accounts een voorstel en het aantal. */
export async function mappingVoor(tx: Tx, id: string) {
  const r = await laadReis(tx, id)
  const { reisId, andere, accounts } = await doelAccounts(tx, r)
  const nodig = new Map<string, number>()
  for (const a of accounts) {
    if (a.reisId && a.reisId !== reisId && andere.has(a.reisId)) continue
    if (a.reisId === reisId && r.data.fases.some((f: any) => f.id === a.faseId)) continue
    if (a.faseId) nodig.set(a.faseId, (nodig.get(a.faseId) ?? 0) + 1)
  }
  const bronFases = r.data?.basisId ? (await laadReis(tx, reisId)).data.fases : (await rijen(tx, sql`select data from reistemplates where is_standaard`))[0]?.data?.fases ?? []
  const voorstel = faseMapping({ fases: [...bronFases, ...[...nodig.keys()].filter((k) => !bronFases.some((f: any) => f.id === k)).map((k) => ({ id: k, hoofdfase: 'vinden', label: k, volgorde: 99 }))] } as any, r.data)
  const labels = new Map<string, string>(bronFases.map((f: any) => [f.id, f.label]))
  return { rijen: [...nodig].map(([faseId, aantal]) => ({ faseId, label: labels.get(faseId) ?? faseId, aantal, voorstel: voorstel[faseId] ?? null })), instap: instapFase(r.data) }
}

/**
 * Publiceren (salesmanager, beheerder): 422 bij blokkerende validatie of een onvolledige mapping. Schrijft de
 * versie in reisversies, zet de actieve reis op de nieuwe data, zet accounts om en ruimt het concept op.
 */
export async function publiceer(tx: Tx, org: string, door: string, id: string, mapping: Record<string, string | null> = {}, nu = new Date()) {
  const r = await laadReis(tx, id)
  if (r.status !== 'concept') fout(409, 'Alleen een concept publiceer je')
  const v = valideerReis(r.data)
  const blok = blokkeertPublicatie(v)
  if (blok.length) fout(422, blok[0]!, { fouten: blok })
  const m = await mappingVoor(tx, id)
  const volledig = { ...Object.fromEntries(m.rijen.map((x) => [x.faseId, x.voorstel])), ...mapping }
  const mf = mappingFouten(volledig, m.rijen.map((x) => x.faseId), r.data)
  if (mf.length) fout(422, 'Kies voor elke oude fase een nieuwe fase', { mapping: m.rijen, fouten: mf })
  const basisId: string | null = r.data?.basisId ?? null
  const acts = await activiteitenVan(tx, id)
  const data = { fases: r.data.fases, overgangen: r.data.overgangen, ...(r.data.overschrijvingen ? { overschrijvingen: r.data.overschrijvingen } : {}) }
  let reisId = id
  let versie = Number(r.versie)
  if (basisId) {
    const b = await laadReis(tx, basisId)
    versie = Number(b.versie) + 1
    reisId = basisId
    await tx.execute(sql`update reistemplates set data = ${JSON.stringify(data)}::jsonb, versie = ${versie}, naam = ${r.naam}, doelgroep_id = ${r.doelgroep_id}, status = 'actief', updated_at = now() where id = ${basisId}`)
    await tx.execute(sql`delete from activiteitstemplates where reistemplate_id = ${basisId}`)
    await tx.execute(sql`update activiteitstemplates set reistemplate_id = ${basisId}, versie = ${versie} where reistemplate_id = ${id}`)
    await tx.execute(sql`delete from reistemplates where id = ${id}`)
  } else {
    await tx.execute(sql`update reistemplates set data = ${JSON.stringify(data)}::jsonb, status = 'actief', updated_at = now() where id = ${id}`)
  }
  await tx.execute(sql`insert into reisversies (organisation_id, reis_id, versie, naam, data, activiteiten, door) values (${org}, ${reisId}, ${versie}, ${r.naam}, ${JSON.stringify(data)}::jsonb, ${JSON.stringify(acts.map((a) => ({ ...a, id: undefined })))}::jsonb, ${door})`)
  // Regels die aan een verdwenen fase van deze reis hingen, gaan mee naar de gemapte fase.
  for (const [van, naar] of Object.entries(volledig)) if (naar && van !== naar) await tx.execute(sql`update activity_rules set fase_id = ${naar} where reis_id = ${reisId} and fase_id = ${van}`)
  // Accounts omzetten: wie al in de reis zit en een fase heeft die nog bestaat, blijft; de rest via de mapping of de instap.
  const { andere, accounts } = await doelAccounts(tx, { ...r, id: reisId, data: { ...data, basisId: null } })
  const instap = instapFase(data as ReisData)
  let omgezet = 0
  for (const a of accounts) {
    if (a.reisId && a.reisId !== reisId && andere.has(a.reisId)) continue
    const blijft = a.reisId === reisId && data.fases.some((f: any) => f.id === a.faseId)
    if (blijft) continue
    const naar = (a.faseId && volledig[a.faseId]) || instap
    if (!naar) continue
    await zetOmNaarVersie(tx, a.id, reisId, naar, door, `Nieuwe reisversie ${versie}`, nu)
    omgezet++
  }
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'reis.publiceren', resourceType: 'reistemplates', resourceId: reisId, changes: { versie, omgezet, mapping: volledig } })
  await tx.execute(sql`update tasks set status = 'klaar', uitkomst = 'gedaan', updated_at = now() where status = 'open' and data->>'publicatieReisId' = ${id}`)
  return { id: reisId, versie, omgezet }
}

/** Draai terug: de vorige gepubliceerde versie wordt weer de actieve; accounts in een fase die verdwijnt, gaan via de mapping. */
export async function terugdraaien(tx: Tx, org: string, door: string, id: string, mapping: Record<string, string | null> = {}, nu = new Date()) {
  const r = await laadReis(tx, id)
  if (r.status === 'concept') fout(409, 'Een concept heeft geen vorige versie')
  const [vorige] = await rijen(tx, sql`select * from reisversies where reis_id = ${id} and versie < ${r.versie} order by versie desc limit 1`)
  if (!vorige) fout(409, 'Er is geen vorige versie om naar terug te gaan')
  const nodig = (await rijen(tx, sql`select fase_id, count(*)::int as n from accounts where reis_id = ${id} group by 1`)).filter((x) => x.fase_id && !(vorige!.data.fases as any[]).some((f) => f.id === x.fase_id))
  const voorstel = { ...faseMapping(r.data, vorige!.data), ...mapping }
  const mf = mappingFouten(voorstel, nodig.map((x) => x.fase_id), vorige!.data)
  if (mf.length) fout(422, 'Kies voor elke fase die verdwijnt een nieuwe fase', { mapping: nodig.map((x) => ({ faseId: x.fase_id, aantal: x.n, voorstel: voorstel[x.fase_id] ?? null })) })
  const versie = Number(r.versie) + 1
  await tx.execute(sql`update reistemplates set data = ${JSON.stringify(vorige!.data)}::jsonb, versie = ${versie}, updated_at = now() where id = ${id}`)
  await tx.execute(sql`delete from activiteitstemplates where reistemplate_id = ${id}`)
  for (const a of (vorige!.activiteiten ?? []) as any[]) await tx.execute(sql`insert into activiteitstemplates (organisation_id, reistemplate_id, fase_id, versie, data) values (${org}, ${id}, ${a.faseId}, ${versie}, ${JSON.stringify(a)}::jsonb)`)
  await tx.execute(sql`insert into reisversies (organisation_id, reis_id, versie, naam, data, activiteiten, door) values (${org}, ${id}, ${versie}, ${r.naam}, ${JSON.stringify(vorige!.data)}::jsonb, ${JSON.stringify(vorige!.activiteiten ?? [])}::jsonb, ${door})`)
  let omgezet = 0
  for (const a of await rijen(tx, sql`select id, fase_id from accounts where reis_id = ${id}`)) {
    if ((vorige!.data.fases as any[]).some((f) => f.id === a.fase_id)) continue
    await zetOmNaarVersie(tx, a.id, id, voorstel[a.fase_id]!, door, `Teruggedraaid naar versie ${vorige!.versie}`, nu)
    omgezet++
  }
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'reis.terugdraaien', resourceType: 'reistemplates', resourceId: id, changes: { naar: vorige!.versie, versie, omgezet } })
  return { versie, omgezet }
}

/** Fase verwijderen uit een actieve reis kan niet direct: dat gaat via een concept en de mapping bij publiceren. */
export async function zetStatus(tx: Tx, org: string, door: string, id: string, status: 'gepauzeerd' | 'actief' | 'gearchiveerd', reden: string) {
  const r = await laadReis(tx, id)
  if (r.is_standaard) fout(422, 'De standaardreis pauzeer of archiveer je niet')
  if (!reden?.trim()) fout(422, 'Geef een reden')
  if (status === 'gearchiveerd' && (await rijen(tx, sql`select 1 from accounts where reis_id = ${id} limit 1`)).length) fout(409, 'Er zitten nog accounts in deze reis. Verplaats ze eerst of draai terug.')
  await tx.execute(sql`update reistemplates set status = ${status}, updated_at = now() where id = ${id}`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: `reis.${status}`, resourceType: 'reistemplates', resourceId: id, changes: { reden } })
  return { status }
}

/** "Vraag publicatie aan" (Expert): een taak voor de salesmanager(s) en de markering op het concept. */
export async function vraagPublicatieAan(tx: Tx, org: string, g: Bewerker, id: string, nu = new Date()) {
  const r = await laadReis(tx, id)
  magBewerken(r, g)
  const v = valideerReis(r.data)
  const blok = blokkeertPublicatie(v)
  if (blok.length) fout(422, blok[0]!, { fouten: blok })
  const [u] = await rijen(tx, sql`select team_id, name from users where id = ${g.id}`)
  const managers = (await rijen(tx, sql`select unnest(manager_ids) as id from teams where id = ${u?.team_id ?? ''}`)).map((m) => m.id as string)
  const ontvangers = managers.length ? managers : (await rijen(tx, sql`select id from users where role = 'salesmanager' and status = 'actief'`)).map((m) => m.id as string)
  let taskId: string | null = null
  for (const m of ontvangers) {
    taskId = crypto.randomUUID()
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, action_type, title, status, priority, due_date, executor, data) values (${taskId}, ${org}, ${m}, 'taak', ${`Publiceer reis: ${r.naam}`}, 'open', 'middel', ${nu.toISOString()}, 'mens', ${JSON.stringify({ herkomst: 'handmatig', publicatieReisId: id, waarom: `${String(u?.name ?? '').replace(/^Testgebruiker /, '')} vraagt publicatie aan.`, link: `/reizen/${id}` })}::jsonb)`)
  }
  await tx.execute(sql`update reistemplates set data = data || ${JSON.stringify({ publicatieAangevraagd: { door: g.id, op: nu.toISOString() } })}::jsonb where id = ${id}`)
  return { taskId }
}

/** Fases die ergens anders nog naar een verwijderde fase wijzen (regel 42): leeg betekent schoon. */
export async function kaleIds(tx: Tx, reisId: string) {
  const r = await laadReis(tx, reisId)
  const ids = new Set((r.data.fases as any[]).map((f) => f.id))
  const uit: string[] = []
  for (const x of r.data.overgangen as any[]) for (const f of [x.vanFaseId, x.naarFaseId]) if (f && !ids.has(f)) uit.push(`overgang ${x.id}: ${f}`)
  for (const a of await rijen(tx, sql`select id, fase_id from accounts where reis_id = ${reisId}`)) if (a.fase_id && !ids.has(a.fase_id)) uit.push(`account ${a.id}: ${a.fase_id}`)
  for (const a of await rijen(tx, sql`select id, fase_id from activity_rules where reis_id = ${reisId} and fase_id is not null`)) if (!ids.has(a.fase_id)) uit.push(`regel ${a.id}: ${a.fase_id}`)
  for (const a of await rijen(tx, sql`select id, fase_id from activiteitstemplates where reistemplate_id = ${reisId}`)) if (!ids.has(a.fase_id)) uit.push(`startactiviteit ${a.id}: ${a.fase_id}`)
  return uit
}


const REIS_SCHEMA = {
  type: 'object', required: ['fases', 'overgangen'], additionalProperties: false,
  properties: {
    fases: { type: 'array', items: { type: 'object', required: ['id', 'label', 'hoofdfase', 'eind'], additionalProperties: false, properties: {
      id: { type: 'string' }, label: { type: 'string', maxLength: 60 }, hoofdfase: { type: 'string', enum: ['vinden', 'bewerken', 'verbinden', 'overgedragen', 'verloren'] },
      omschrijving: { type: 'string', maxLength: 300 }, accent: { type: 'string', maxLength: 300 }, verwachtVerblijfDagen: { type: 'number' }, instap: { type: 'boolean' }, eind: { type: 'string', enum: ['geen', 'overgedragen', 'verloren'] },
    } } },
    overgangen: { type: 'array', items: { type: 'object', required: ['vanFaseId', 'gebeurtenis', 'naarFaseId'], additionalProperties: false, properties: { vanFaseId: { type: 'string' }, gebeurtenis: { type: 'string' }, naarFaseId: { type: 'string' } } } },
  },
} as const

/** "Stel fases voor" (Expert, de Coach, 20 credits): altijd een concept, nooit een actieve versie; daarna valideerReis. */
export async function stelFasesVoor(tx: Tx, org: string, g: Bewerker & { niveau: string; data?: any }, doelgroepId: string | null, nu = new Date()) {
  const [d] = doelgroepId ? await rijen(tx, sql`select * from doelgroepen where id = ${doelgroepId}`) : []
  if (doelgroepId && !d) fout(422, 'Doelgroep onbekend')
  const stand = await leesStand(tx)
  const r = await voerAiStapUit<any>(tx, org, {
    soort: 'coach', boekAls: 'coach', gebruiker: { id: g.id, niveau: g.niveau as any, data: g.data }, schema: REIS_SCHEMA as any,
    prompt: PROMPT_REISVOORSTEL,
    materiaal: { coach: true, reisVoorstel: true, doelgroep: d ? { naam: d.naam, ...d.data } : null, gebeurtenissen: KIESBARE_GEBEURTENISSEN, fasen: (stand.fasen ?? []).map((f: any) => ({ naam: f.naam, hoofdfase: f.reisHoofdfase ?? null })) },
  }, nu)
  if (!r.ok) fout(502, r.reden ?? 'Er kwam geen voorstel')
  const data = schoonReisData({ fases: (r.antwoord.fases ?? []).map((f: any) => ({ ...f, eind: f.eind === 'geen' ? null : f.eind })), overgangen: (r.antwoord.overgangen ?? []).map((x: any, i: number) => ({ ...x, id: `o-${i + 1}`, vanFaseId: x.vanFaseId === 'instap' ? null : x.vanFaseId, prioriteit: 1 })) })
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into reistemplates (id, organisation_id, naam, doelgroep_id, versie, status, is_standaard, eigenaar_id, bron, data)
    values (${id}, ${org}, ${`Voorstel ${d?.naam ?? 'nieuwe reis'}`.slice(0, 120)}, ${doelgroepId}, 1, 'concept', false, ${g.id}, '{"vanuit": "ai"}'::jsonb, ${JSON.stringify({ ...data, basisId: null })}::jsonb)`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'reis.voorstel', resourceType: 'reistemplates', resourceId: id, changes: { doelgroepId } })
  return { id, validatie: valideerReis(data) }
}
