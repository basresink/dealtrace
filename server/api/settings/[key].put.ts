// PUT /api/settings/:key: alleen de beheerder; sleutels van de leverancier geven 403,
// onbekende sleutels 400. Elke wijziging is een auditregel.
import { and, eq } from 'drizzle-orm'
import { isSettingKey, isVerborgen } from '../../../shared/settingKeys'
import { rolMag } from '../../../shared/permissions'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  const key = getRouterParam(event, 'key') ?? ''
  if (isVerborgen(key)) throw createError({ statusCode: 403, statusMessage: 'Deze instelling beheert de leverancier' })
  if (!isSettingKey(key)) throw createError({ statusCode: 400, statusMessage: 'Onbekende instelling' })
  if (!rolMag(gebruiker.rol, 'instellingen', 'schrijven')) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder wijzigt instellingen' })
  const { value } = await readBody<{ value: unknown }>(event)
  if (value === undefined) throw createError({ statusCode: 400, statusMessage: 'value ontbreekt' })

  return metOrganisatie(organisatie.id, async (tx) => {
    const [oud] = await tx.select().from(schema.orgSettings).where(and(eq(schema.orgSettings.organisationId, organisatie.id), eq(schema.orgSettings.key, key)))
    await tx.insert(schema.orgSettings)
      .values({ organisationId: organisatie.id, key, value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value, updatedAt: new Date().toISOString() } })
    await schrijfAudit(tx, {
      organisationId: organisatie.id, actorId: gebruiker.id, action: 'instelling.wijzigen',
      resourceType: 'org_settings', resourceId: key, changes: { van: oud?.value ?? null, naar: value },
    })
    return { key, value }
  })
})
