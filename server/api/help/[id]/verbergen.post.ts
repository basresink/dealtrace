// POST /api/help/:id/verbergen {verborgen}: de beheerder verbergt een platformartikel voor zijn organisatie.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { helpVerborgen } from '../../../utils/help'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'help.verbergen')
  const id = getRouterParam(event, 'id') ?? ''
  const b = await readBody<{ verborgen?: boolean }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select({ id: schema.helpArtikelen.id }).from(schema.helpArtikelen).where(eq(schema.helpArtikelen.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
    const oud = await helpVerborgen(tx)
    const nieuw = b?.verborgen === false ? oud.filter((x) => x !== id) : [...new Set([...oud, id])]
    await tx.insert(schema.orgSettings).values({ organisationId: ctx.organisatie.id, key: 'helpVerborgen', value: nieuw, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value: nieuw, updatedAt: new Date().toISOString() } })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'help.verbergen', resourceType: 'help_artikelen', resourceId: id, changes: { verborgen: b?.verborgen !== false } })
    return { verborgen: b?.verborgen !== false }
  })
})
