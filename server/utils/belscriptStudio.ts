// Belscript Studio op de server: per prospect de gegevens die de AI krijgt (met bron), de AI-vulling
// via de AI-schil met credits (een concept met bevroren herkomst), de beoordeling en het bewaren als
// versie bij het prospect, en de resultaten per template uit de eigen gesprekken.
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { verwijderNamen, type JsonSchema } from '../../shared/aiStap'
import { soortAanIn } from '../../shared/credits'
import {
  SCRIPT_TEMPLATES, aiBlokkenVan, beslisProspect, prospectConcept, prospectGegevens, prospectSamenvatting, templateResultaat, templateVanScript, zichtbareScripts,
  type Belscript, type ProspectBesluit, type ProspectScriptData,
} from '../../shared/belscripts'
import { schema } from './db'
import { kan } from './accounts'
import { schrijfAudit } from './audit'
import { belmodusItems, laadScripts, type Kandidaat } from './bellen'
import { voerAiStapUit } from './llm-provider'
import { PROMPT_BELSCRIPT_PROSPECT } from '../../shared/promptStandaard'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
export interface StudioCtx { gebruiker: { id: string; naam: string; niveau: string; teamId: string | null; data?: unknown }; organisatie: { id: string; naam: string; pakket: any } }

const SCHEMA: JsonSchema = {
  type: 'object', required: ['blokken'], additionalProperties: false,
  properties: {
    blokken: { type: 'array', items: { type: 'object', required: ['blokId', 'tekst'], additionalProperties: false, properties: {
      blokId: { type: 'string' }, tekst: { type: 'string', maxLength: 500 },
      bronnen: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { soort: { type: 'string' }, citaat: { type: 'string' } } } },
    } } },
  },
}

/** Mag deze gebruiker de AI laten vullen? Zo niet, de reden in gewone taal. */
export function aiStand(ctx: { organisatie: { pakket: any } } & Record<string, any>): { aan: boolean; reden: string | null } {
  if (!soortAanIn('belscript', ctx.organisatie.pakket)) return { aan: false, reden: 'Het script per prospect laten vullen zit niet in jullie pakket. Je belt met de vaste teksten en terugvalzinnen.' }
  if (!kan(ctx, 'belscript.ai')) return { aan: false, reden: 'Het script per prospect laten vullen staat voor jouw niveau nog niet aan.' }
  return { aan: true, reden: null }
}

/** Alles voor het tabblad Per prospect: kaart, gekozen script, gegevens met bron en de bewaarde versies. */
export async function prospectContext(tx: Tx, ctx: StudioCtx, accountId: string, opties: { contactId?: string | null; scriptId?: string | null } = {}) {
  const [a] = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Prospect onbekend' })
  const contacten = await tx.select({ id: schema.contacts.id, rol: schema.contacts.rol }).from(schema.contacts).where(and(eq(schema.contacts.accountId, accountId), sql`${schema.contacts.status} <> 'vertrokken'`))
  const contactId = (opties.contactId && contacten.some((c) => c.id === opties.contactId) ? opties.contactId : null) ?? contacten.find((c) => c.rol === 'beslisser')?.id ?? contacten[0]?.id ?? null
  const scripts = zichtbareScripts(await laadScripts(tx), { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId })
  const k: Kandidaat = { accountId, accountNaam: a.naam, contactId, score: 0, herkomst: 'koud', reden: '' }
  const [item] = await belmodusItems(tx, { gebruiker: { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId }, organisatie: ctx.organisatie }, [k], { scripts })
  const gekozen = scripts.find((s) => s.id === opties.scriptId) ?? scripts.find((s) => s.id === item?.voorstel?.scriptId) ?? scripts[0] ?? null
  const w = item?.waarden ?? {}
  const aanl = item?.kaart.account.aanleiding as { tekst?: string; bron?: string; op?: string } | null
  const gegevens = prospectGegevens({
    aanleiding: aanl?.tekst ? { tekst: w['aanleiding.kort'] ?? aanl.tekst, bron: aanl.bron ?? null, op: aanl.op ?? null } : null,
    branche: { naam: w['account.branche'], kernzin: w['verhaal.kernzin'], algemeen: !w['verhaal.branche'] },
    leverancier: { naam: w['concurrent.naam'] },
    winpunt: { titel: w['winpunt.naam'], argument: w.argument },
    contact: item?.kaart.contact ? { naam: item.kaart.contact.naam, functie: item.kaart.contact.functie, rol: item.kaart.contact.rol } : null,
  })
  const versies = await tx.select({ id: schema.belscriptProspectversies.id, versie: schema.belscriptProspectversies.versie, op: schema.belscriptProspectversies.bewaardOp, door: schema.users.name, gebruikerId: schema.belscriptProspectversies.gebruikerId, samenvatting: schema.belscriptProspectversies.samenvatting, belscriptId: schema.belscriptProspectversies.belscriptId, scriptVersie: schema.belscriptProspectversies.scriptVersie, data: schema.belscriptProspectversies.data })
    .from(schema.belscriptProspectversies).leftJoin(schema.users, eq(schema.users.id, schema.belscriptProspectversies.gebruikerId))
    .where(and(eq(schema.belscriptProspectversies.accountId, accountId), eq(schema.belscriptProspectversies.status, 'bewaard'))).orderBy(desc(schema.belscriptProspectversies.versie))
  return {
    account: { id: a.id, naam: a.naam }, contactId, item: item ?? null, waarden: w,
    script: gekozen, scripts,
    voorstel: item?.voorstel ?? null, gegevens, aiBlokken: gekozen ? aiBlokkenVan(gekozen).length : 0,
    versies: versies.map((v) => ({ ...v, door: (v.door ?? '').replace(/^Testgebruiker\s+/, '') })),
  }
}

/**
 * Vul met AI: één aanroep via de AI-schil (soort belscript, credits van de gebruiker). Alleen de
 * gegevens uit de tabel gaan mee, zonder namen van contacten; het resultaat is een concept dat de
 * gebruiker per blok beoordeelt. De herkomst per blok bepaalt de server en wordt hier bevroren.
 */
export async function vulProspect(tx: Tx, ctx: StudioCtx, i: { accountId: string; contactId?: string | null; scriptId?: string | null }) {
  const p = await prospectContext(tx, ctx, i.accountId, { contactId: i.contactId, scriptId: i.scriptId })
  if (!p.script) throw createError({ statusCode: 409, statusMessage: 'Er is nog geen actief script voor je team' })
  const script = p.script as Belscript
  const aiBlokken = aiBlokkenVan(script)
  if (!aiBlokken.length) throw createError({ statusCode: 422, statusMessage: 'Dit script heeft geen AI-blokken. Zet in Standaardscript een blok op "AI vult aan" of "AI schrijft".' })
  const g = Object.fromEntries(p.gegevens.map((x) => [x.sleutel, x]))
  const namen = (await tx.select({ f: schema.contacts.firstName, l: schema.contacts.lastName }).from(schema.contacts).where(eq(schema.contacts.accountId, i.accountId))).flatMap((c) => [c.f, c.l])
  const materiaal = verwijderNamen({
    perProspect: true,
    blokken: aiBlokken.map((b) => ({ id: b.id, soort: b.soort, tekst: b.tekst, terugval: b.terugval ?? null })),
    gegevens: {
      aanleiding: g.aanleiding?.waarde ?? null, branche: g.branche?.waarde ?? null, kernzin: p.waarden['verhaal.kernzin'] ?? null, leverancier: g.leverancier?.waarde ?? null,
      winpunt: g.winpunt?.waarde ? { titel: g.winpunt.waarde, argument: p.waarden.argument ?? null } : null, rol: g.rol?.waarde ?? null, fase: p.waarden['reis.fase'] ?? null,
    },
  }, namen)
  const uit = await voerAiStapUit<{ blokken: { blokId: string; tekst: string; bronnen?: { soort?: string }[] }[] }>(tx, ctx.organisatie.id, {
    soort: 'belscript', gebruiker: { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data as any }, accountId: i.accountId,
    prompt: PROMPT_BELSCRIPT_PROSPECT,
    schema: SCHEMA, materiaal,
  })
  if (!uit.ok) throw createError({ statusCode: 422, statusMessage: uit.reden ?? 'De AI kon het script niet vullen' })
  const ids = new Set(aiBlokken.map((b) => b.id))
  const ai = Object.fromEntries(uit.antwoord.blokken.filter((x) => ids.has(x.blokId) && x.tekst?.trim()).map((x) => [x.blokId, { tekst: x.tekst.replace(/\s+[—–]\s+/g, ', ').split(/\s+/).slice(0, 60).join(' '), bronnen: (x.bronnen ?? []).map((b) => b.soort ?? '').filter(Boolean) }]))
  const data = prospectConcept(script, p.gegevens, ai)
  const [r] = await tx.insert(schema.belscriptProspectversies).values({ organisationId: ctx.organisatie.id, accountId: i.accountId, contactId: p.contactId, gebruikerId: ctx.gebruiker.id, belscriptId: script.id, scriptVersie: script.versie, status: 'concept', data }).returning({ id: schema.belscriptProspectversies.id })
  return { conceptId: r!.id, data, script: { id: script.id, naam: script.naam, versie: script.versie } }
}

/** Bewaar de beoordeling als nieuwe versie bij het prospect. Elk AI-voorstel moet beoordeeld zijn. */
export async function bewaarProspect(tx: Tx, ctx: StudioCtx, conceptId: string, besluiten: ProspectBesluit[]) {
  const [r] = await tx.select().from(schema.belscriptProspectversies).where(eq(schema.belscriptProspectversies.id, conceptId))
  if (!r || r.gebruikerId !== ctx.gebruiker.id) throw createError({ statusCode: 404, statusMessage: 'Concept onbekend' })
  if (r.status !== 'concept') throw createError({ statusCode: 409, statusMessage: `Dit concept is al bewaard als versie ${r.versie}` })
  const b = beslisProspect(r.data.blokken, besluiten)
  if (b.fouten.length) throw createError({ statusCode: 422, statusMessage: b.fouten[0]! })
  const [m] = (await tx.execute(sql`select coalesce(max(versie), 0)::int as n from belscript_prospectversies where account_id = ${r.accountId} and versie is not null`)).rows as { n: number }[]
  const versie = (m?.n ?? 0) + 1
  const samenvatting = prospectSamenvatting(b.blokken, b.aangepast)
  const data: ProspectScriptData = { ...r.data, blokken: b.blokken }
  const nu = new Date().toISOString()
  await tx.update(schema.belscriptProspectversies).set({ status: 'bewaard', versie, data, samenvatting, bewaardOp: nu }).where(eq(schema.belscriptProspectversies.id, conceptId))
  await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'belscript.prospectversie', resourceType: 'belscript_prospectversies', resourceId: conceptId, changes: { accountId: r.accountId, versie, besluiten: b.blokken.filter((x) => x.voorstel).map((x) => ({ blok: x.id, status: x.status })) } })
  return { id: conceptId, versie, samenvatting, data }
}

/** Resultaten per template uit de eigen gesprekken van de laatste 180 dagen (scripts met dat template of uit de startset). */
export async function templateResultaten(tx: Tx) {
  const scripts = await tx.select({ id: schema.belscripts.id, startset: schema.belscripts.startset, data: schema.belscripts.data }).from(schema.belscripts).where(eq(schema.belscripts.isPersoonlijk, false))
  const perScript = new Map(scripts.map((s) => [s.id, templateVanScript({ startset: s.startset, data: s.data })]))
  const ids = scripts.map((s) => s.id).filter((id) => perScript.get(id))
  const rijen = ids.length ? (await tx.execute(sql`select data->'script'->>'scriptId' as id, count(*)::int as n, count(*) filter (where uitkomst = 'afspraak')::int as afspraken
    from activiteiten where data ? 'script' and op >= ${new Date(Date.now() - 180 * 864e5).toISOString()} and data->'script'->>'scriptId' in ${ids} group by 1`)).rows as { id: string; n: number; afspraken: number }[] : []
  const tel = new Map<string, { gesprekken: number; afspraken: number }>()
  for (const r of rijen) {
    const t = perScript.get(r.id)
    if (!t) continue
    const x = tel.get(t) ?? { gesprekken: 0, afspraken: 0 }
    x.gesprekken += r.n; x.afspraken += r.afspraken
    tel.set(t, x)
  }
  return SCRIPT_TEMPLATES.map((t) => ({ id: t.id, resultaat: templateResultaat(tel.get(t.id)) }))
}

/** De prospects van de belblokken van vandaag (zelfde rangorde als de belmodus), met het aantal versies. */
export async function prospectKeuze(tx: Tx, gebruikerId: string, kandidaten: { accountId: string; accountNaam: string; contactNaam?: string | null; contactRol?: string | null; reden: string; belblokId?: string | null }[]) {
  const ids = [...new Set(kandidaten.map((k) => k.accountId))]
  if (!ids.length) return []
  const accounts = await tx.select({ id: schema.accounts.id, plaats: schema.accounts.city, klasse: schema.accounts.klasse }).from(schema.accounts).where(inArray(schema.accounts.id, ids))
  const versies = (await tx.execute(sql`select account_id, count(*)::int as n, count(*) filter (where gebruiker_id = ${gebruikerId})::int as eigen from belscript_prospectversies where status = 'bewaard' and account_id in ${ids} group by 1`)).rows as { account_id: string; n: number; eigen: number }[]
  return kandidaten.map((k) => ({ ...k, plaats: accounts.find((a) => a.id === k.accountId)?.plaats ?? null, klasse: accounts.find((a) => a.id === k.accountId)?.klasse ?? null, versies: versies.find((v) => v.account_id === k.accountId)?.n ?? 0 }))
}
