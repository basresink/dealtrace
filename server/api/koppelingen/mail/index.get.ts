// GET /api/koppelingen/mail: de mailkoppeling van de organisatie (beheerder). Het wachtwoord gaat nooit
// naar de client; alleen of er een is. Met de ondertekende URL voor inkomende mail (reacties op opvolgreeksen)
// en de laatste tien inkomende mails.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { inkomendUrl, laatsteInkomend } from '../../../utils/mailInkomend'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.mail')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [k] = (await tx.execute(sql`select status, instellingen, geheimen is not null as heeft, getest_op from koppelingen where soort = 'mail'`)).rows as any[]
    return { status: k?.status ?? 'uit', instellingen: k?.instellingen ?? { modus: 'smtp', poort: 587 }, heeftWachtwoord: !!k?.heeft, getestOp: k?.getest_op ?? null, inkomend: { url: inkomendUrl(getRequestURL(event).origin, ctx.organisatie.id), laatste: await laatsteInkomend(tx) } }
  })
})
