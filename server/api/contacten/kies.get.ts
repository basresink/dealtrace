// GET /api/contacten/kies?q=&accountId=: snelle keuze van een contactpersoon (Nieuwe taak en Bewerken in het
// taakvenster). Met een account alleen diens contacten, beslisser eerst en daarna op naam, ook zonder
// zoekterm; zonder account vanaf twee tekens over alle contacten. Tien treffers, vertrokken contacten niet.
import { and, asc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().replace(/[%_]/g, '')
  const accountId = query.accountId ? String(query.accountId) : null
  if (!accountId && q.length < 2) return []
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const c = schema.contacts
    const zoek = q ? or(ilike(c.firstName, `%${q}%`), ilike(c.lastName, `%${q}%`), sql`concat_ws(' ', ${c.firstName}, ${c.lastName}) ilike ${`%${q}%`}`, sql`${c.data}->>'functie' ilike ${`%${q}%`}`) : undefined
    const rijen = await tx.select({ id: c.id, voornaam: c.firstName, achternaam: c.lastName, rol: c.rol, data: c.data, accountId: c.accountId, accountNaam: schema.accounts.name })
      .from(c).leftJoin(schema.accounts, eq(schema.accounts.id, c.accountId))
      .where(and(ne(c.status, 'vertrokken'), accountId ? eq(c.accountId, accountId) : undefined, zoek))
      .orderBy(sql`(${c.rol} = 'beslisser') desc`, asc(c.lastName), asc(c.id)).limit(10)
    return rijen.map((r) => ({ id: r.id, naam: `${r.voornaam ?? ''} ${r.achternaam}`.trim(), functie: r.data?.functie ?? null, rol: r.rol, accountId: r.accountId, accountNaam: r.accountNaam }))
  })
})
