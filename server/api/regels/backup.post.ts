// POST /api/regels/backup {terugzetten?: boolean}: back-up van alle regels in de
// instellingen, of de laatste back-up terugzetten (beheerder).
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { regelUitRij } from '../../utils/motor'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'regels.beheer')
  const b = await readBody<{ terugzetten?: boolean }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const nu = new Date().toISOString()
    if (b?.terugzetten) {
      const [rij] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'regelsBackup'))
      const backup = rij?.value as { op: string; regels: any[] } | undefined
      if (!backup?.regels?.length) throw createError({ statusCode: 404, statusMessage: 'Er is nog geen back-up' })
      await tx.delete(schema.activityRules)
      await tx.insert(schema.activityRules).values(backup.regels.map(({ id, versie, ...r }: any) => ({ ...r, id, organisationId: ctx.organisatie.id })))
      await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regels.backupTerug', resourceType: 'activity_rules', changes: { op: backup.op, aantal: backup.regels.length } })
      return { op: backup.op, aantal: backup.regels.length }
    }
    const regels = (await tx.select().from(schema.activityRules)).map(regelUitRij)
    await tx.insert(schema.orgSettings).values({ organisationId: ctx.organisatie.id, key: 'regelsBackup', value: { op: nu, regels }, updatedAt: nu })
      .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value: { op: nu, regels }, updatedAt: nu } })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regels.backup', resourceType: 'activity_rules', changes: { aantal: regels.length } })
    return { op: nu, aantal: regels.length }
  })
})
