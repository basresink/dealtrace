// POST /api/belscripts/invullen {scriptId, accountId, contactId?}: AI vult de blokken met
// "AI vult aan" of "AI schrijft" voor dit account (Schrijver, mandaat A, via de Bewaker en
// de AI-schil). Eén aanroep per gesprek, 24 uur gecachet per account en scriptversie. Zonder
// credits of op Starter: { ok: false } en het script werkt met de vaste teksten.
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { verwijderNamen, type JsonSchema } from '../../../shared/aiStap'
import { soortAanIn } from '../../../shared/credits'
import { kiesWinpunt, kernzinVoor } from '../../../shared/verkoopverhaal'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { laadScripts } from '../../utils/bellen'
import { voerAiStapUit } from '../../utils/llm-provider'
import { verkoopverhaal } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'

const SCHEMA: JsonSchema = {
  type: 'object', required: ['blokken'], additionalProperties: false,
  properties: {
    blokken: { type: 'array', items: { type: 'object', required: ['blokId', 'tekst'], additionalProperties: false, properties: {
      blokId: { type: 'string' }, tekst: { type: 'string', maxLength: 400 },
      bronnen: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { soort: { type: 'string' }, url: { type: 'string' }, datum: { type: 'string' }, citaat: { type: 'string' } } } },
    } } },
    gekozenWinpuntId: { type: 'string' }, argumentRef: { type: 'string' },
  },
}

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const b = await readBody<{ scriptId?: string; accountId?: string; contactId?: string | null; versie?: number }>(event)
  if (!b?.scriptId || !b?.accountId) throw createError({ statusCode: 400, statusMessage: 'scriptId en accountId zijn verplicht' })
  if (!kan(ctx, 'belscript.ai') || !soortAanIn('belscript', ctx.organisatie.pakket)) return { ok: false, reden: 'Belscript-invulling zit niet in je pakket; het script werkt met vaste teksten.' }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const script = (await laadScripts(tx, b.versie ? { [b.scriptId!]: b.versie } : null)).find((s) => s.id === b.scriptId)
    if (!script) throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
    const aiBlokken = script.data.blokken.filter((x) => x.invulwijze !== 'vast')
    if (!aiBlokken.length) return { ok: true, ai: {}, bron: 'geen' }
    const contactId = b.contactId ?? ''
    const [cache] = await tx.select().from(schema.belscriptInvullingen).where(and(eq(schema.belscriptInvullingen.belscriptId, script.id), eq(schema.belscriptInvullingen.versie, script.versie), eq(schema.belscriptInvullingen.accountId, b.accountId!), eq(schema.belscriptInvullingen.contactId, contactId), gte(schema.belscriptInvullingen.op, new Date(Date.now() - 864e5).toISOString())))
    if (cache) return { ok: true, ai: cache.data, bron: 'cache' }
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, b.accountId!))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const contacten = await tx.select({ f: schema.contacts.firstName, l: schema.contacts.lastName }).from(schema.contacts).where(eq(schema.contacts.accountId, a.id))
    const inzichten = await tx.select({ titel: schema.signals.title, op: schema.signals.createdAt, waarom: sql<string>`${schema.signals.data}->>'waarom'` }).from(schema.signals).where(and(eq(schema.signals.accountId, a.id), gte(schema.signals.createdAt, new Date(Date.now() - 90 * 864e5).toISOString()), inArray(schema.signals.status, ['nieuw', 'gelezen', 'omgezet']))).orderBy(desc(schema.signals.relevanceScore)).limit(5)
    const notities = (await tx.select({ data: schema.activiteiten.data }).from(schema.activiteiten).where(and(eq(schema.activiteiten.accountId, a.id), eq(schema.activiteiten.soort, 'notitie'))).orderBy(desc(schema.activiteiten.op)).limit(5)).map((x) => (x.data as any)?.tekst).filter(Boolean)
    const vv = await verkoopverhaal(tx)
    const wp = vv.winpunten ? kiesWinpunt(vv.winpunten, { faseId: a.faseId }) : null
    const materiaal = verwijderNamen({
      blokken: aiBlokken.map((x) => ({ id: x.id, soort: x.soort, tekst: x.tekst })), account: { naam: a.name, plaats: a.city, branche: a.vvBrancheId, fase: a.faseId },
      aanleiding: (a.data as any)?.aanleiding ?? null, inzichten, notities, kernzin: kernzinVoor(vv, a.vvBrancheId).tekst,
      winpunt: wp ? { id: wp.id, titel: wp.titel, omschrijving: wp.omschrijving } : null,
    }, contacten.flatMap((c) => [c.f, c.l]))
    const uit = await voerAiStapUit<{ blokken: { blokId: string; tekst: string; bronnen?: any[] }[] }>(tx, ctx.organisatie.id, {
      soort: 'belscript', agent: 'schrijver', gebruiker: { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data as any }, accountId: a.id,
      prompt: 'Vul de blokken van dit belscript in voor dit account. Elke zin heeft een bron uit het materiaal; geen feiten buiten het materiaal; hooguit 60 woorden per blok.', schema: SCHEMA, materiaal,
    })
    if (!uit.ok) return { ok: false, reden: uit.reden }
    const ids = new Set(aiBlokken.map((x) => x.id))
    const ai = Object.fromEntries(uit.antwoord.blokken.filter((x) => ids.has(x.blokId) && x.tekst.trim() && (x.bronnen?.length ?? 0) > 0).map((x) => [x.blokId, { tekst: x.tekst.split(/\s+/).slice(0, 60).join(' '), bronnen: x.bronnen }]))
    await tx.insert(schema.belscriptInvullingen).values({ organisationId: ctx.organisatie.id, belscriptId: script.id, versie: script.versie, accountId: a.id, contactId, data: ai })
      .onConflictDoUpdate({ target: [schema.belscriptInvullingen.belscriptId, schema.belscriptInvullingen.versie, schema.belscriptInvullingen.accountId, schema.belscriptInvullingen.contactId], set: { data: ai, op: new Date().toISOString() } })
    return { ok: true, ai, bron: 'ai' }
  })
})
