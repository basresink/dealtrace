// GET /api/meetings/aan-de-beurt: hooguit acht voorstellen wie je nu moet spreken, met vormadvies
// (Gevorderd). Prospects zonder historie of klasse doen mee (gat 33). Elk voorstel heeft een uitleg
// in een zin, een adviescode (belafspraak, online, fysiek of belblok) met label.
import { sql } from 'drizzle-orm'
import { aanDeBeurt, vormAdvies } from '../../../shared/agenda'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.aanDeBeurt')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const accounts = (await tx.execute(sql`select a.id, a.name, a.fase_id, a.nb_status, a.klasse, a.laatste_contact_op, a.city, a.terug_op::text as terug_op, a.data->'reis'->'ritme'->>'volgendeOp' as ritme_op,
      (select x.uitkomst from activiteiten x where x.account_id = a.id and x.uitkomst is not null order by x.op desc limit 1) as laatste_uitkomst
      from accounts a where a.owner_id = ${ctx.gebruiker.id} and a.account_kind = 'prospect'`)).rows as any[]
    const ids = accounts.map((a) => a.id)
    const afspraken = ids.length ? (await tx.execute(sql`select id, account_id, status, start_at from appointments where account_id = any(string_to_array(${ids.join(',')}, ','))`)).rows as any[] : []
    const voorstellen = aanDeBeurt(
      accounts.map((a) => ({ id: a.id, naam: a.name, faseId: a.fase_id, nbStatus: a.nb_status, klasse: a.klasse, laatsteContactOp: a.laatste_contact_op ? new Date(a.laatste_contact_op).toISOString() : null, ritmeVolgendeOp: a.ritme_op, laatsteUitkomst: a.laatste_uitkomst, plaats: a.city, terugOp: a.terug_op })),
      afspraken.map((x) => ({ id: x.id, accountId: x.account_id, status: x.status, start: new Date(x.start_at).toISOString() })), new Date(),
      (a) => vormAdvies(a, { werkplek: ctx.gebruiker.werkplek }, [], new Date()),
    )
    return { voorstellen, leeg: voorstellen.length ? null : 'Niemand is nu aan de beurt. De motor zet nieuwe voorstellen klaar zodra een ritme verloopt.' }
  })
})
