// GET /api/notificaties: eigen meldingen, nieuwste eerst, zonder verborgen.
import { and, desc, eq, isNull } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  return metOrganisatie(organisatie.id, (tx) =>
    tx.select({
      id: schema.notificaties.id, soort: schema.notificaties.soort, titel: schema.notificaties.titel,
      tekst: schema.notificaties.tekst, link: schema.notificaties.link, gelezenOp: schema.notificaties.gelezenOp, op: schema.notificaties.op,
    }).from(schema.notificaties)
      .where(and(eq(schema.notificaties.gebruikerId, gebruiker.id), isNull(schema.notificaties.verborgenOp)))
      .orderBy(desc(schema.notificaties.op)).limit(100))
})
