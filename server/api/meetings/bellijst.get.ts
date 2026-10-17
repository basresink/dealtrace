// GET /api/meetings/bellijst?datum=: de belprioriteit naast je meetings, gelijk aan de bellijst op
// Bezoeken (functie bezoeken.bellijst, vanaf Gevorderd): dezelfde rangorde als op Belblokken, zonder de
// accounts die je die dag al spreekt in een afspraak. Zonder de functie: kan false en een lege lijst.
import { sql } from 'drizzle-orm'
import { bouwBellijst } from '../../../shared/belblokken'
import { nlMoment, nlTijdstip, plusDagen } from '../../../shared/datum'
import { bellijstNaastBezoeken } from '../../../shared/route'
import { kan } from '../../utils/accounts'
import { laadBelKandidaten } from '../../utils/bellen'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const q = getQuery(event)
  const dag = typeof q.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.datum) ? q.datum : nlMoment(new Date()).datum
  if (!kan(ctx, 'bezoeken.bellijst')) return { kan: false, bellijst: [] }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = (await tx.execute(sql`select distinct account_id from appointments where owner_id = ${ctx.gebruiker.id} and account_id is not null and status <> 'geannuleerd'
      and start_at >= ${nlTijdstip(dag, 0).toISOString()} and start_at < ${nlTijdstip(plusDagen(dag, 1), 0).toISOString()}`)).rows as { account_id: string }[]
    const lijst = bellijstNaastBezoeken(bouwBellijst(await laadBelKandidaten(tx, ctx.gebruiker.id), new Date(), { top: 30 }), new Set(rijen.map((r) => r.account_id)), 10)
    return {
      kan: true,
      bellijst: lijst.map((k) => ({ accountId: k.accountId, accountNaam: k.accountNaam, contactId: k.contactId ?? null, contactNaam: k.contactNaam ?? null, telefoon: k.telefoon ?? null, taskId: k.taskId ?? null, reden: k.reden, score: k.score, openTaken: k.openTaken ?? 0, heet: !!k.heet })),
    }
  })
})
