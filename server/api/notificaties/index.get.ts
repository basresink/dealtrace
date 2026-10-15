// GET /api/notificaties: eigen meldingen, nieuwste eerst, zonder verborgen.
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  // Meldingen zijn van de gebruiker zelf: altijd in de eigen organisatie, ook als
  // de founder in een andere organisatie werkt.
  const { gebruiker } = await vereisSessie(event)
  const organisatie = { id: gebruiker.organisationId! }
  // Tijdens een belblok met "Onderdruk meldingen" blijven nieuwe meldingen vastgehouden tot het einde (gat 37).
  const stil = (gebruiker.data as any)?.stil as { vanaf: string; tot: string } | undefined
  const vasthouden = stil && Date.parse(stil.tot) > Date.now() ? lt(schema.notificaties.op, stil.vanaf) : sql`true`
  return metOrganisatie(organisatie.id, (tx) =>
    tx.select({
      id: schema.notificaties.id, soort: schema.notificaties.soort, titel: schema.notificaties.titel,
      tekst: schema.notificaties.tekst, link: schema.notificaties.link, gelezenOp: schema.notificaties.gelezenOp, op: schema.notificaties.op,
    }).from(schema.notificaties)
      .where(and(eq(schema.notificaties.gebruikerId, gebruiker.id), isNull(schema.notificaties.verborgenOp), vasthouden))
      .orderBy(desc(schema.notificaties.op)).limit(100))
})
