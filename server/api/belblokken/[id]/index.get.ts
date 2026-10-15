// GET /api/belblokken/:id: alles voor de belmodus in één keer (de wachtrij vooraf geladen,
// zodat het volgende gesprek direct opent): kaart, scriptvoorstel, variabelen en bezwaren.
// Een lopend blok gebruikt de scriptversies waarmee het startte.
import { and, eq, inArray } from 'drizzle-orm'
import { bouwBellijst } from '../../../../shared/belblokken'
import { zichtbareScripts, conversieLabel } from '../../../../shared/belscripts'
import { metOrganisatie, schema } from '../../../utils/db'
import { kan } from '../../../utils/accounts'
import { belmodusItems, laadBelKandidaten, laadScripts } from '../../../utils/bellen'
import { scriptResultaten } from '../../../utils/belscripts'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select().from(schema.belblokSessies).where(eq(schema.belblokSessies.id, id))
    if (!s || s.gebruikerId !== ctx.gebruiker.id) throw createError({ statusCode: 404, statusMessage: 'Belblok onbekend' })
    const open = await tx.select({ id: schema.tasks.id }).from(schema.tasks).where(and(eq(schema.tasks.belblokId, id), inArray(schema.tasks.status, ['open', 'bezig'])))
    const ids = new Set(open.map((t) => t.id))
    const kandidaten = (await laadBelKandidaten(tx, ctx.gebruiker.id)).filter((k) => k.taskId && ids.has(k.taskId))
    const wachtrij = bouwBellijst(kandidaten, new Date())
    const scripts = zichtbareScripts(await laadScripts(tx, (s.data as any).scriptVersies ?? null), { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId })
    const items = await belmodusItems(tx, { gebruiker: { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId }, organisatie: ctx.organisatie }, wachtrij as any, { scripts, belblokScriptId: s.data.scriptId ?? null })
    const res = kan(ctx, 'belscript.variant') ? await scriptResultaten(tx) : []
    return {
      sessie: { id: s.id, start: s.startOp, eind: s.eindOp, status: s.status, plek: s.data.plek, soort: s.data.soort, gesprekken: s.data.gesprekken ?? [], resultaat: s.data.resultaat ?? null, stil: !!s.data.stil },
      items, scripts: scripts.map((x) => ({ ...x, conversie: res.length ? conversieLabel(res.find((r) => r.scriptId === x.id && r.versie === x.versie)) : null })),
      kan: { ai: kan(ctx, 'belscript.ai'), handsfree: kan(ctx, 'bellen.handsfree'), variant: kan(ctx, 'belscript.variant') },
    }
  })
})
