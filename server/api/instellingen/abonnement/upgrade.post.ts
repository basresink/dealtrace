// POST /api/instellingen/abonnement/upgrade {pakket}: "Upgrade aanvragen"; de founder krijgt een melding.
import { sql } from 'drizzle-orm'
import { PAKKETTEN } from '../../../../shared/types'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisBeheerder(event, 'instellingen.abonnement', { nietDoorLeverancier: true })
  const { pakket } = await readBody<{ pakket?: string }>(event)
  if (!PAKKETTEN.includes(pakket as any)) throw createError({ statusCode: 400, statusMessage: 'Onbekend pakket' })
  await metOrganisatie(organisatie.id, async (tx) => {
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'abonnement.upgradeAanvragen', resourceType: 'organisations', resourceId: organisatie.id, changes: { van: organisatie.pakket, naar: pakket } })
    await tx.execute(sql`select dealtrace_meld_founders(${`Upgrade aangevraagd door ${organisatie.naam}`}, ${`Van ${organisatie.pakket} naar ${pakket}, door ${gebruiker.naam}.`}, ${`/platform/klanten?klant=${organisatie.id}`})`)
  })
  return { ok: true }
})
