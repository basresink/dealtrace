// POST /api/koppelingen/mail/test {instellingen, wachtwoord?}: test eerst (SPF, DKIM, DMARC en de
// verbinding) zonder iets op te slaan. De fout in gewone taal.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { ontsleutel } from '../../../utils/geheimen'
import { testMail } from '../../../utils/mail'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.mail')
  const b = await readBody<any>(event)
  const i = { modus: b?.instellingen?.modus === 'mock' ? 'mock' : 'smtp', host: String(b?.instellingen?.host ?? ''), poort: Number(b?.instellingen?.poort) || 587, gebruiker: String(b?.instellingen?.gebruiker ?? ''), van: String(b?.instellingen?.van ?? ''), naam: b?.instellingen?.naam ?? null, domein: b?.instellingen?.domein ?? null, dkimSelector: b?.instellingen?.dkimSelector ?? 'default' } as any
  if (i.modus === 'smtp' && (!i.host || !/@/.test(i.van))) throw createError({ statusCode: 400, statusMessage: 'Vul de mailserver en het verzendadres in' })
  const wachtwoord = b?.wachtwoord || (await metOrganisatie(ctx.organisatie.id, async (tx) => ontsleutel(((await tx.execute(sql`select geheimen from koppelingen where soort = 'mail'`)).rows as any[])[0]?.geheimen, 'mail')?.wachtwoord ?? null))
  return testMail(i, wachtwoord)
})
