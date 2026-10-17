// GET /api/contacten/kies?q=&accountId=: snelle keuze van een contactpersoon (ZoekKiezer: Nieuwe taak, taakvenster,
// Plan een afspraak, kennisbank en meer). Met een account alleen diens contacten, beslisser eerst en daarna op naam.
// Zonder account over alle contacten: contacten bij je eigen prospects eerst, dan het meest recent actief, dan op
// naam. Ook zonder zoekterm (de lijst bij focus). Hooguit dertig treffers, vertrokken contacten niet.
import { and, asc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().replace(/[%_]/g, '')
  const accountId = query.accountId ? String(query.accountId) : null
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const c = schema.contacts
    const a = schema.accounts
    const zoek = q ? or(ilike(c.firstName, `%${q}%`), ilike(c.lastName, `%${q}%`), sql`concat_ws(' ', ${c.firstName}, ${c.lastName}) ilike ${`%${q}%`}`, sql`${c.data}->>'functie' ilike ${`%${q}%`}`) : undefined
    const volgorde = accountId
      ? [sql`(${c.rol} = 'beslisser') desc`, asc(c.lastName), asc(c.id)]
      : [sql`(${a.ownerId} = ${ctx.gebruiker.id}) desc nulls last`, sql`greatest(${a.laatsteContactOp}, ${c.updatedAt}) desc nulls last`, asc(c.lastName), asc(c.id)]
    const rijen = await tx.select({ id: c.id, voornaam: c.firstName, achternaam: c.lastName, rol: c.rol, data: c.data, accountId: c.accountId, accountNaam: a.name })
      .from(c).leftJoin(a, eq(a.id, c.accountId))
      .where(and(ne(c.status, 'vertrokken'), accountId ? eq(c.accountId, accountId) : sql`${a.gedeactiveerdOp} is null`, zoek))
      .orderBy(...volgorde).limit(30)
    return rijen.map((r) => ({ id: r.id, naam: `${r.voornaam ?? ''} ${r.achternaam}`.trim(), functie: r.data?.functie ?? null, rol: r.rol, accountId: r.accountId, accountNaam: r.accountNaam }))
  })
})
