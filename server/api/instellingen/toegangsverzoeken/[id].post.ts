// POST /api/instellingen/toegangsverzoeken/:id {besluit}: de beheerder keurt een
// toegangsverzoek van de leverancier goed of af. Goedgekeurd geldt tot 24 uur na aanvraag.
import { and, eq, sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisBeheerder(event, 'instellingen.audit', { nietDoorLeverancier: true })
  const id = getRouterParam(event, 'id')!
  const { besluit } = await readBody<{ besluit?: string }>(event)
  if (besluit !== 'goedkeuren' && besluit !== 'afwijzen') throw createError({ statusCode: 400, statusMessage: 'Besluit is goedkeuren of afwijzen' })
  return metOrganisatie(organisatie.id, async (tx) => {
    const [v] = await tx.select().from(schema.toegangsverzoeken).where(eq(schema.toegangsverzoeken.id, id))
    if (!v) throw createError({ statusCode: 404, statusMessage: 'Verzoek onbekend' })
    if (v.status !== 'open' || Date.parse(v.geldigTot) < Date.now()) throw createError({ statusCode: 409, statusMessage: 'Dit verzoek is al afgehandeld of verlopen' })
    const status = besluit === 'goedkeuren' ? 'goedgekeurd' : 'afgewezen'
    await tx.update(schema.toegangsverzoeken).set({ status, beslotenDoor: gebruiker.id, beslotenOp: new Date().toISOString() })
      .where(and(eq(schema.toegangsverzoeken.id, id), eq(schema.toegangsverzoeken.organisationId, organisatie.id)))
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: `toegangsverzoek.${besluit}`, resourceType: 'toegangsverzoeken', resourceId: id, changes: { founder: v.founderNaam, modus: v.modus, reden: v.reden } })
    await tx.execute(sql`select dealtrace_meld_founders(${`Toegang ${status} door ${organisatie.naam}`}, ${`${gebruiker.naam} heeft je verzoek (${v.reden}) ${status}.`}, ${`/platform/klanten?klant=${organisatie.id}`})`)
    return { status }
  })
})
