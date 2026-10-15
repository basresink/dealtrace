// POST /api/regels: nieuwe regel. Expert: persoonlijk (eigen accounts); salesmanager:
// teamregel voor zijn teams; beheerder: alles. 422 bij onbekende variabele of zonder trigger.
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { regelUitRij } from '../../utils/motor'
import { magRegelSchrijven, regelFouten, schoonRegel } from '../../utils/regels'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const b = await readBody<any>(event)
  if (!b?.data?.trigger?.patroon) throw createError({ statusCode: 422, statusMessage: 'Kies een triggerpatroon' })
  const r = schoonRegel(b)
  if (ctx.gebruiker.rol === 'accountmanager') { r.scope = 'persoonlijk'; r.eigenaarId = ctx.gebruiker.id }
  if (ctx.gebruiker.rol === 'salesmanager' && r.scope !== 'team') r.scope = 'team'
  if (r.motor === 'ai' && ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'AI-regels maakt de beheerder' })
  const fouten = regelFouten(r)
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
    if (r.scope === 'team' && !r.teamId) r.teamId = teams[0] ?? null
    const m = magRegelSchrijven(ctx, r, teams)
    if (!m.mag) throw createError({ statusCode: 403, statusMessage: m.reden })
    const [rij] = await tx.insert(schema.activityRules).values({ organisationId: ctx.organisatie.id, ...r, code: null }).returning()
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regel.maken', resourceType: 'activity_rules', resourceId: rij!.id, changes: r })
    return regelUitRij(rij!)
  })
})
