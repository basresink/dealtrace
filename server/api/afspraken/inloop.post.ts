// POST /api/afspraken/inloop {id?, accountId, tijd?}: een inloopbezoek (F10, P30): een afspraak
// "Ongepland bezoek" op dit moment, die je daarna in Bezoek afronden vastlegt. Ook via de wachtrij
// (inloop.vastleggen).
import { metOrganisatie } from '../../utils/db'
import { legInloopVast } from '../../utils/onderweg'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'onderweg.inloop')
  const b = await readBody<{ id?: string; accountId?: string; tijd?: string }>(event)
  if (!b?.accountId) throw createError({ statusCode: 400, statusMessage: 'Kies een account' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = await legInloopVast(tx, ctx.organisatie.id, ctx.gebruiker.id, { id: b.id ?? null, accountId: b.accountId!, tijd: b.tijd ?? null })
    return { ...r, tekst: 'Inloopbezoek gestart. Rond het af als je klaar bent.' }
  })
})
