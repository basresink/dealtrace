// PUT /api/platform/features {functie, niveau, aan, organisatieId?}: één cel zetten, direct
// werkend en met een regel in de platformaudit (founder met tweestapsverificatie).
import { eq } from 'drizzle-orm'
import type { Niveau } from '../../../../shared/types'
import { schema } from '../../../utils/db'
import { celObject, isNiveaucel, leesCel, zetCel } from '../../../utils/features'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'
import { vergeetOrganisaties } from '../../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await requireFounder(event)
  const b = await readBody<{ functie?: string; niveau?: string; aan?: boolean; organisatieId?: string | null }>(event)
  if (!b?.functie || !b.niveau || !isNiveaucel(b.functie, b.niveau) || typeof b.aan !== 'boolean') throw createError({ statusCode: 422, statusMessage: 'Onbekende functie of niveau' })
  const org = b.organisatieId || null
  return alsPlatform(async (tx) => {
    if (org) {
      const [o] = await tx.select({ id: schema.organisations.id }).from(schema.organisations).where(eq(schema.organisations.id, org))
      if (!o) throw createError({ statusCode: 404, statusMessage: 'Organisatie onbekend' })
    }
    const voor = await leesCel(tx, b.functie!, b.niveau as Niveau, org)
    await zetCel(tx, b.functie!, b.niveau as Niveau, org, b.aan!, ctx.gebruiker.id)
    await platformAudit(tx, event, ctx, { organisatieId: org, handeling: 'feature.zetten', object: celObject(b.functie!, b.niveau!, org), voor, na: { aan: b.aan } })
    return { functie: b.functie, niveau: b.niveau, aan: b.aan, organisatieId: org }
  })
})
