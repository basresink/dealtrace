// POST /api/belscripts {naam, doel, data}: een nieuw script als concept (salesmanager, beheerder).
// Een onbekende variabele geeft 422 met de naam.
import { SCRIPT_DOELEN, STARTSET_SCRIPTS } from '../../../shared/belscripts'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { schoonData, valideerVoorOrg } from '../../utils/belscripts'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.beheer')
  const b = await readBody<any>(event)
  const doel = SCRIPT_DOELEN.includes(b?.doel) ? b.doel : 'koud'
  const basis = STARTSET_SCRIPTS.find((s) => s.doel === doel) ?? STARTSET_SCRIPTS[0]!
  const data = schoonData(b?.data ?? {}, b?.data ? undefined : basis.data)
  const naam = String(b?.naam ?? '').trim().slice(0, 120)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const v = await valideerVoorOrg(tx, { naam, doel, data })
    if (v.fouten.length) throw createError({ statusCode: 422, statusMessage: v.fouten[0]!, data: v })
    const [r] = await tx.insert(schema.belscripts).values({ organisationId: ctx.organisatie.id, naam, doel, status: 'concept', versie: 0, eigenaarId: ctx.gebruiker.id, data }).returning()
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'belscript.maken', resourceType: 'belscripts', resourceId: r!.id, changes: { naam, doel } })
    return { id: r!.id, waarschuwingen: v.waarschuwingen }
  })
})
