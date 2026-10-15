// POST /api/instellingen/gebruikersaanvragen: de beheerder vraagt een gebruiker aan;
// de founder krijgt een melding (gat 48).
import { sql } from 'drizzle-orm'
import { WERKPLEKKEN } from '../../../shared/types'
import { schrijfAudit } from '../../utils/audit'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisBeheerder(event, 'instellingen.gebruikersAanvragen', { nietDoorLeverancier: true })
  const b = await readBody<{ naam?: string; email?: string; rol?: string; niveau?: string; werkplek?: string; teamId?: string | null }>(event)
  const naam = b.naam?.trim()
  const email = b.email?.trim().toLowerCase()
  if (!naam || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'Naam en een geldig e-mailadres zijn verplicht' })
  const rol = ['accountmanager', 'salesmanager', 'beheerder'].includes(b.rol ?? '') ? b.rol! : 'accountmanager'
  const werkplek = (WERKPLEKKEN as readonly string[]).includes(b.werkplek ?? '') ? b.werkplek! : 'binnendienst'
  return metOrganisatie(organisatie.id, async (tx) => {
    const id = crypto.randomUUID()
    await tx.insert(schema.gebruikersaanvragen).values({
      id, organisationId: organisatie.id, aangevraagdDoor: gebruiker.id,
      data: { naam, email, rol, niveau: b.niveau, werkplek, teamId: b.teamId ?? null },
    })
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'gebruiker.aanvragen', resourceType: 'gebruikersaanvragen', resourceId: id, changes: { naam, email, rol } })
    await tx.execute(sql`select dealtrace_meld_founders(${`Gebruikersaanvraag van ${organisatie.naam}`}, ${`${naam} (${email}) als ${rol}.`}, ${`/platform/klanten?klant=${organisatie.id}`})`)
    return { id, status: 'open' }
  })
})
