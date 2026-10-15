// PUT /api/regels/:id: patch binnen de scope van de gebruiker; 409 bij een versieconflict.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { eigenTeams } from '../../../utils/gebruikers'
import { regelUitRij } from '../../../utils/motor'
import { magRegelSchrijven, regelFouten, schoonRegel } from '../../../utils/regels'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id')!
  const patch = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [rij] = await tx.select().from(schema.activityRules).where(eq(schema.activityRules.id, id))
    if (!rij) throw createError({ statusCode: 404, statusMessage: 'Regel onbekend' })
    const oud = regelUitRij(rij)
    const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
    const m = magRegelSchrijven(ctx, oud, teams, patch)
    if (!m.mag) throw createError({ statusCode: 403, statusMessage: m.reden })
    if (patch.versie !== undefined && patch.versie !== (oud.versie ?? 1)) throw createError({ statusCode: 409, statusMessage: 'De regel is intussen gewijzigd; laad hem opnieuw', data: { versie: oud.versie ?? 1 } })
    // Scope en eigenaar veranderen niet via een patch.
    const nieuw = schoonRegel({ ...patch, scope: oud.scope, teamId: oud.teamId, eigenaarId: oud.eigenaarId, code: oud.code,
      data: patch.data ? { ...patch.data, trigger: patch.data.trigger ? { ...oud.data.trigger, ...patch.data.trigger, parameters: { ...oud.data.trigger.parameters, ...(patch.data.trigger.parameters ?? {}) } } : undefined,
        afbakening: patch.data.afbakening ? { ...oud.data.afbakening, ...patch.data.afbakening } : undefined, gevolg: patch.data.gevolg ? { ...oud.data.gevolg, ...patch.data.gevolg } : undefined } : undefined }, oud)
    if (nieuw.motor === 'ai' && oud.motor !== 'ai' && ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'AI-regels maakt de beheerder' })
    const fouten = regelFouten(nieuw)
    if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
    const [na] = await tx.update(schema.activityRules).set({ ...nieuw, versie: (oud.versie ?? 1) + 1, updatedAt: new Date().toISOString() }).where(eq(schema.activityRules.id, id)).returning()
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regel.wijzigen', resourceType: 'activity_rules', resourceId: id, changes: { van: oud, naar: nieuw } })
    return regelUitRij(na!)
  })
})
