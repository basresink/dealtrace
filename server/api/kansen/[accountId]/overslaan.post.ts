// POST /api/kansen/:accountId/overslaan {reden}: de kans komt 7 dagen niet terug.
import { sql } from 'drizzle-orm'
import { nlMoment, plusDagen } from '../../../../shared/datum'
import { OVERSLA_REDENEN } from '../../../../shared/route'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'bezoeken.route')
  const accountId = getRouterParam(event, 'accountId')!
  const reden = String((await readBody<{ reden?: string }>(event))?.reden ?? '').trim()
  if (!OVERSLA_REDENEN.includes(reden)) throw createError({ statusCode: 400, statusMessage: 'Kies een reden om over te slaan' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const tot = plusDagen(nlMoment(new Date()).datum, 7)
    await tx.execute(sql`insert into kans_overslaan (organisation_id, gebruiker_id, account_id, tot, reden) values (${ctx.organisatie.id}, ${ctx.gebruiker.id}, ${accountId}, ${tot}, ${reden.slice(0, 200)})`)
    return { ok: true, tot }
  })
})
