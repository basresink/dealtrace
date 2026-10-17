// GET /api/accounts/kies?q=&soort=prospect: snelle keuze van een account (ZoekKiezer: Nieuwe taak, Plan een afspraak,
// Inzicht, kennisbank, campagnes en meer). Zonder zoekterm de eerste dertig, met zoekterm de eerste dertig treffers;
// de kiezer toont er zes en scrolt voor de rest. Volgorde: eigen prospects eerst, dan het meest recent actief
// (laatste contact of laatste wijziging), dan op naam. Met soort=prospect alleen prospects (zoals bij een nieuw
// accountplan: plannen voor klanten horen in DealDrive). Gedeactiveerde accounts (0064) staan er niet tussen.
// Elke treffer heeft `branche` (uit het verkoopverhaal, anders de vrije branche) voor de regel "naam · branche".
import { and, asc, eq, ilike, isNull, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const KIES_LIMIET = 30

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().replace(/[%_]/g, '')
  const alleenProspects = query.soort === 'prospect'
  const a = schema.accounts
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await tx.select({
      id: a.id, naam: a.name, plaats: a.city,
      branche: sql<string | null>`coalesce((select b.naam from vv_branches b where b.extern_id = accounts.vv_branche_id and b.organisation_id = accounts.organisation_id limit 1), accounts.data->>'branche')`,
    }).from(a)
      .where(and(q ? ilike(a.name, `%${q}%`) : undefined, alleenProspects ? eq(a.accountKind, 'prospect') : undefined, isNull(a.gedeactiveerdOp)))
      .orderBy(...[
        sql`(${a.ownerId} = ${ctx.gebruiker.id}) desc nulls last`,
        ...(q ? [sql`(${a.name} ilike ${`${q}%`}) desc`] : []),
        sql`greatest(${a.laatsteContactOp}, ${a.updatedAt}) desc nulls last`,
        asc(a.name), asc(a.id),
      ]).limit(KIES_LIMIET)
    return rijen
  })
})
