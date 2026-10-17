// Prospectplanning op de server (F13): de stand uit accounts, activiteiten en instellingen,
// het inplannen van een achterstand in koude belblokken, de terugkomregels met hun opbrengst
// en het verwerken van een teruggekomen verloren deal. Rekenregels in shared/planning.ts.
import { and, eq, inArray, sql } from 'drizzle-orm'
import { volgendVastBlok } from '../../shared/belblokken'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { KANAAL_LABEL, type Kanaal } from '../../shared/nbStatus'
import {
  benaderdDitJaar, hercontactOpTijd, leesPlanning, planningStand, POGING_SOORTEN, potentieVan, spreidOverBlokken, statusVan, vensterVan, verkoopjaar, watKnelt,
  type BlokMoment, type IngedeeldAccount,
} from '../../shared/planning'
import { primairContact } from '../../shared/contactgegevens'
import { klasseCode, type Klasse } from '../../shared/ritmematrix'
import { terugkomDatum, terugkomTekst, type Redenmapping } from '../../shared/verkoopverhaal'
import { schrijfAudit } from './audit'
import { blokkenVan, sessieOp } from './bellen'
import { schema } from './db'
import { eigenTeams } from './gebruikers'
import { afkoelingInstelling, verkoopverhaal } from './reis'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
const fout = (status: number, bericht: string): never => { throw createError({ statusCode: status, statusMessage: bericht }) }

async function instelling(tx: Tx, key: string) {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, key))
  return r?.value as any
}
export async function planInstelling(tx: Tx) {
  return leesPlanning(await instelling(tx, 'prospectplanning'), (await instelling(tx, 'organisatie'))?.verkoopjaarStartmaand)
}

export interface PlanRij {
  id: string; naam: string; klasse: string | null; plaats: string | null; ownerId: string | null; potentie: string | null
  venster: { van: string; tot: string } | null; status: string; pogingen: number; telefoon: string | null; lat: number | null; lng: number | null
  /** Het primaire contact (beslisser, champion, iemand met telefoon), voor de knop + Bel taak. */
  contact: { id: string; naam: string; functie: string | null } | null
}

function primairVan(lijst: { id: string; naam: string; functie: string | null; rol: string; status: string; telefoon: string | null; mobiel: string | null }[]) {
  const c = primairContact(lijst)
  return c ? { id: c.id, naam: c.naam, functie: c.functie } : null
}

/** De jaarplanning voor een lijst eigenaren (scope mij of team). */
export async function jaarplanning(tx: Tx, eigenaren: string[] | null, nu = new Date()) {
  const inst = await planInstelling(tx)
  const jaar = verkoopjaar(nu, inst.startmaand)
  const klassen = ((await instelling(tx, 'klassen')) ?? []) as Klasse[]
  const rijen = await tx.select().from(schema.accounts).where(and(eq(schema.accounts.accountKind, 'prospect'), inArray(schema.accounts.nbStatus, ['nieuw', 'in reis', 'wachtend']), sql`${schema.accounts.gedeactiveerdOp} is null`, eigenaren ? inArray(schema.accounts.ownerId, eigenaren.length ? eigenaren : ['-']) : undefined))
  const ids = rijen.map((r) => r.id)
  const acts = ids.length ? (await tx.execute(sql`select account_id, soort, uitkomst, op from activiteiten where op >= ${jaar.start} and soort in ${[...POGING_SOORTEN]} and account_id in ${ids}`)).rows as any[] : []
  const per = new Map<string, any[]>()
  const cs = ids.length ? await tx.select({ id: schema.contacts.id, accountId: schema.contacts.accountId, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, rol: schema.contacts.rol, status: schema.contacts.status, data: schema.contacts.data }).from(schema.contacts).where(inArray(schema.contacts.accountId, ids)) : []
  const contactenPer = new Map<string, { id: string; naam: string; functie: string | null; rol: string; status: string; telefoon: string | null; mobiel: string | null }[]>()
  for (const c of cs) (contactenPer.get(c.accountId) ?? contactenPer.set(c.accountId, []).get(c.accountId)!).push({ id: c.id, naam: [c.firstName, c.lastName].filter(Boolean).join(' '), functie: c.data?.functie ?? null, rol: c.rol, status: c.status, telefoon: c.data?.telefoon ?? null, mobiel: c.data?.mobiel ?? null })
  for (const r of acts) (per.get(r.account_id) ?? per.set(r.account_id, []).get(r.account_id)!).push({ soort: r.soort, uitkomst: r.uitkomst, op: new Date(r.op).toISOString() })
  const lijst: PlanRij[] = []
  const ingedeeld: IngedeeldAccount[] = []
  for (const a of rijen) {
    // Een handmatige indeling in accounts.data.planning gaat voor de berekende.
    const hand = (a.data as any)?.planning
    const potentie = hand?.jaar === jaar.jaar && hand.potentie ? hand.potentie : potentieVan({ klasse: a.klasse, score: a.score, cf: (a.data as any)?.customFields }, inst, klassen)
    const venster = potentie ? vensterVan(potentie, jaar.start, inst.vensters) : null
    const b = benaderdDitJaar(per.get(a.id) ?? [], jaar)
    const k = klassen.find((x) => x.id === a.klasse)
    ingedeeld.push({ id: a.id, potentie, benaderd: b.benaderd, venster })
    lijst.push({ id: a.id, naam: a.name, klasse: k ? klasseCode(k) : a.klasse, plaats: a.city, ownerId: a.ownerId, potentie, venster, status: statusVan(b), pogingen: b.pogingen, telefoon: (a.data as any)?.telefoon ?? null, lat: a.lat, lng: a.lng, contact: primairVan(contactenPer.get(a.id) ?? []) })
  }
  const stand = planningStand(ingedeeld, jaar, nu)
  return { instelling: inst, jaar, stand, knelt: watKnelt(stand, nu, inst.vensters), accounts: lijst }
}

/** De koude en gemengde blokken van een gebruiker in de komende weken. */
function blokMomenten(u: { werkplek?: string | null; data?: any }, nu: Date, weken = 4): BlokMoment[] {
  const { blokken } = blokkenVan(u)
  const koud = blokken.filter((b) => b.soort === 'koud' || b.soort === 'gemengd')
  const uit: BlokMoment[] = []
  let na = nu
  const eind = nu.getTime() + weken * 7 * 864e5
  for (let i = 0; i < 60; i++) {
    const v = volgendVastBlok(koud, na)
    if (!v || v.start.getTime() > eind) break
    uit.push({ start: v.start.toISOString(), minuten: v.blok.minuten, ...{ blokId: v.blok.id, plek: v.blok.plek, soort: v.blok.soort, verhouding: v.blok.verhouding, scriptId: v.blok.scriptId ?? null } } as any)
    na = new Date(v.start.getTime() + 60_000)
  }
  return uit
}

/**
 * Plan een lijst accounts in de koude blokken van hun eigenaar, binnen het venster (of de
 * komende drie weken bij een achterstand) en zonder het dagplafond te overschrijden. Een
 * account in een lopend ritme wordt niet ingepland. Met proef alleen de verdeling.
 */
export async function inplannen(tx: Tx, org: string, accountIds: string[], opties: { proef?: boolean; door: string; nu?: Date }) {
  const nu = opties.nu ?? new Date()
  const plan = await jaarplanning(tx, null, nu)
  const rijen = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, ownerId: schema.accounts.ownerId, data: schema.accounts.data }).from(schema.accounts).where(inArray(schema.accounts.id, accountIds.length ? accountIds : ['-']))
  const inRitme = rijen.filter((r) => (r.data as any)?.reis?.ritme?.actief).map((r) => r.id)
  const kies = rijen.filter((r) => !inRitme.includes(r.id) && r.ownerId)
  const cap = ((await instelling(tx, 'capaciteit')) as any)?.binnendienst ?? 40
  const perEigenaar = new Map<string, string[]>()
  for (const r of kies) (perEigenaar.get(r.ownerId!) ?? perEigenaar.set(r.ownerId!, []).get(r.ownerId!)!).push(r.id)
  const verdeling: { eigenaar: string; start: string; accountIds: string[] }[] = []
  const over: string[] = []
  for (const [eigenaar, ids] of perEigenaar) {
    const [u] = await tx.select({ id: schema.users.id, werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, eigenaar))
    if (!u) { over.push(...ids); continue }
    const vensterTot = ids.map((id) => plan.accounts.find((a) => a.id === id)?.venster?.tot ?? plan.jaar.eind).sort().at(-1)!
    const tot = [vensterTot, plusDagen(nlMoment(nu).datum, 21)].sort().at(-1)!
    const bestaand = Object.fromEntries(((await tx.execute(sql`select to_char(due_date at time zone 'Europe/Amsterdam', 'YYYY-MM-DD') as dag, count(*)::int n from tasks
      where owner_id = ${eigenaar} and status in ('open', 'bezig') and action_type in ('bellen', 'bezoek') and due_date >= ${nu.toISOString()} group by 1`)).rows as any[]).map((r) => [r.dag, r.n]))
    const momenten = blokMomenten(u, nu)
    const r = spreidOverBlokken(ids, momenten, tot, cap, nu, bestaand)
    over.push(...r.over)
    for (const v of r.verdeling) verdeling.push({ eigenaar, ...v })
    if (opties.proef) continue
    for (const v of r.verdeling) {
      const m = momenten.find((x) => x.start === v.start) as any
      const s = await sessieOp(tx, org, eigenaar, v.start, new Date(Date.parse(v.start) + m.minuten * 60_000).toISOString(), { plek: m.plek, soort: m.soort, verhouding: m.verhouding, scriptId: m.scriptId, gesprekken: [] }, m.blokId)
      if (s.status !== 'gepland') { over.push(...v.accountIds); continue }
      const tijd = new Date().toISOString()
      for (const id of v.accountIds) {
        const [open] = await tx.select({ id: schema.tasks.id }).from(schema.tasks).where(and(eq(schema.tasks.accountId, id), eq(schema.tasks.actionType, 'bellen'), inArray(schema.tasks.status, ['open', 'bezig'])))
        if (open) { await tx.update(schema.tasks).set({ belblokId: s.id, dueDate: v.start, updatedAt: tijd }).where(eq(schema.tasks.id, open.id)); continue }
        const naam = rijen.find((x) => x.id === id)!.naam
        await tx.insert(schema.tasks).values({
          organisationId: org, ownerId: eigenaar, accountId: id, actionType: 'bellen', title: `Poging 1: ${naam}`, priority: 'middel', dueDate: v.start, belblokId: s.id, executor: 'mens',
          onderwerp: `${id}:jaarplanning-${plan.jaar.jaar}`, data: { waarom: 'Aan de beurt in de jaarplanning', herkomst: { bron: 'jaarplanning', actiesoort: 'bellen', uitvoerder: eigenaar }, poging: { n: 1, van: 5, kanaal: 'bellen' }, belblokId: s.id },
          createdAt: tijd, updatedAt: tijd,
        })
      }
    }
  }
  const n = verdeling.reduce((t, v) => t + v.accountIds.length, 0)
  const datums = verdeling.map((v) => v.start.slice(0, 10)).sort()
  if (!opties.proef && n) await schrijfAudit(tx, { organisationId: org, actorId: opties.door, action: 'planning.inplannen', resourceType: 'accounts', resourceId: 'jaarplanning', changes: { ingepland: n, blokken: verdeling.length } })
  return {
    ingepland: n, blokken: verdeling.length, over: over.length, inRitme: inRitme.length, verdeling,
    tekst: n ? `${n} belpogingen in ${verdeling.length} ${verdeling.length === 1 ? 'blok' : 'blokken'} tussen ${datums[0]} en ${datums.at(-1)}` : 'Er zijn geen koude belblokken met ruimte in de komende weken.',
  }
}

/** Het tabblad Terugkomregels: regels in twee lijsten, KPI, opbrengst en wie binnenkort terugkomt. */
export async function terugkomOverzicht(tx: Tx, gebruikerId: string, nu = new Date()) {
  const vv = await verkoopverhaal(tx)
  const vandaag = nu.toISOString().slice(0, 10)
  const met = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, ownerId: schema.accounts.ownerId, terugOp: schema.accounts.terugOp, regelId: schema.accounts.terugRegelId, nbStatus: schema.accounts.nbStatus, data: schema.accounts.data })
    .from(schema.accounts).where(sql`${schema.accounts.terugOp} is not null`)
  const ids = met.map((a) => a.id)
  const acts = ids.length ? (await tx.execute(sql`select account_id, soort, uitkomst, op from activiteiten where soort in ${[...POGING_SOORTEN]} and account_id in ${ids} order by op`)).rows as any[] : []
  const na = (a: { id: string; terugOp: string | null }) => acts.filter((x) => x.account_id === a.id && new Date(x.op).toISOString().slice(0, 10) >= a.terugOp!)
  const kpi = hercontactOpTijd(met.map((a) => ({ terugOp: a.terugOp!, eerstePogingNa: na(a)[0] ? new Date(na(a)[0].op).toISOString() : null })), nu)
  const regels = vv.terugkomregels.map((r) => {
    const acc = met.filter((a) => a.regelId === r.id && a.terugOp! <= vandaag)
    const kp = hercontactOpTijd(acc.map((a) => ({ terugOp: a.terugOp!, eerstePogingNa: na(a)[0] ? new Date(na(a)[0].op).toISOString() : null })), nu)
    return {
      ...r, termijnTekst: r.termijnDagen === 0 ? 'direct' : `${r.termijnDagen} dagen`, klassenTekst: r.klassen?.length ? r.klassen.join(', ') : 'alle klassen',
      opbrengst: { teruggekomen: acc.length, opTijd: kp.opTijd, gesprekken: acc.reduce((t, a) => t + na(a).filter((x) => x.uitkomst && !['geen_reactie', 'voicemail', 'verzonden'].includes(x.uitkomst)).length, 0), afspraken: acc.reduce((t, a) => t + na(a).filter((x) => x.uitkomst === 'afspraak').length, 0) },
    }
  })
  const binnenkort = met.filter((a) => a.ownerId === gebruikerId && a.terugOp! >= vandaag && a.terugOp! <= plusDagen(nlMoment(nu).datum, 30)).sort((a, b) => a.terugOp!.localeCompare(b.terugOp!)).map((a) => {
    const t = (a.data as any)?.terugkom
    const regel = vv.terugkomregels.find((r) => r.id === a.regelId)
    return { id: a.id, naam: a.naam, terugOp: a.terugOp, reden: t?.reden ?? regel?.reden ?? (a.data as any)?.nee?.reden ?? null, kanaal: t?.kanaal ?? regel?.kanaal ?? null, aanpak: t?.aanpak ?? regel?.aanpak ?? null }
  })
  return {
    bron: (vv as any).spiegel ? { soort: 'spiegel', tekst: `Uit SalesDNA · bijgewerkt ${(vv as any).spiegel.op?.slice(0, 10) ?? ''}` } : { soort: 'eigen', tekst: 'Eigen inrichting' },
    leeg: !vv.terugkomregels.length, kpi, verloren: regels.filter((r) => r.lijst === 'verloren'), slapend: regels.filter((r) => r.lijst === 'slapend'), binnenkort,
  }
}

/** Het volgende werkmoment (09:00) op of na een datum. */
function werkmoment(datum: string): string {
  let d = datum
  for (let i = 0; i < 7; i++) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); if (w !== 0 && w !== 6) break; d = plusDagen(d, 1) }
  return nlTijdstip(d, 9, 0).toISOString()
}
const ACTIE_VOOR: Partial<Record<Kanaal, string>> = { bezoek: 'bezoek', mail: 'mail', linkedin: 'linkedin', whatsapp: 'whatsapp', kaart: 'kaart' }

/**
 * Een verloren deal of slapende klant uit DealDrive of het CRM (C.9 geval 5): via de mapping een
 * terugkomregel, de terugkomdatum met de afkoeling als ondergrens en een taak op het eerstvolgende
 * werkmoment met de aanpak als aanleiding. Regiodagen komen met P14.
 */
export async function verwerkTerugkomst(tx: Tx, org: string, accountId: string, g: { bronSoort: Redenmapping['bronSoort']; reden: string; door?: string | null }, nu = new Date()) {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) fout(404, 'Account onbekend')
  const vv = await verkoopverhaal(tx)
  const v = terugkomDatum(g.reden, vv, nu, await afkoelingInstelling(tx), g.bronSoort)
  const tekst = terugkomTekst(v.datum, v.regel)
  const data = { ...(a!.data as any), terugkom: { datum: v.datum, regelId: v.regel?.id ?? null, reden: v.regel?.reden ?? g.reden, aanpak: v.regel?.aanpak ?? null, kanaal: v.kanaal, bron: g.bronSoort, verlorenOp: nu.toISOString().slice(0, 10), verliesReden: g.reden } }
  await tx.update(schema.accounts).set({ terugOp: v.datum, terugRegelId: v.regel?.id ?? null, data, updatedAt: nu.toISOString() }).where(eq(schema.accounts.id, accountId))
  const [sr18] = await tx.select({ id: schema.activityRules.id }).from(schema.activityRules).where(eq(schema.activityRules.code, 'SR18'))
  const tijd = nu.toISOString()
  const [t] = await tx.insert(schema.tasks).values({
    organisationId: org, ownerId: a!.ownerId, accountId, actionType: ACTIE_VOOR[v.kanaal] ?? 'bellen', title: `Terug in beeld: ${a!.name}`, priority: 'middel', dueDate: werkmoment(v.datum), executor: 'mens',
    ruleId: sr18?.id ?? null, onderwerp: `${accountId}:terug-${v.datum}`, data: { waarom: tekst, herkomst: { bron: 'terugkomregel', regelId: v.regel?.id ?? null, actiesoort: ACTIE_VOOR[v.kanaal] ?? 'bellen', uitvoerder: a!.ownerId } }, createdAt: tijd, updatedAt: tijd,
  }).returning({ id: schema.tasks.id })
  return { ...v, tekst, taskId: t!.id }
}

export async function teamLeden(tx: Tx, gebruiker: { id: string; rol: string }): Promise<string[]> {
  if (gebruiker.rol === 'beheerder' || gebruiker.rol === 'founder') return (await tx.select({ id: schema.users.id }).from(schema.users)).map((u) => u.id)
  const teams = await eigenTeams(tx, gebruiker.id)
  return (await tx.select({ id: schema.users.id, teamId: schema.users.teamId }).from(schema.users)).filter((u) => u.id === gebruiker.id || (u.teamId && teams.includes(u.teamId))).map((u) => u.id)
}
