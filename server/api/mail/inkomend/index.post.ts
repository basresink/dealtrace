// POST /api/mail/inkomend?o=<organisatie>&t=<token>: de webhook voor inkomende mail. De mailprovider van de
// organisatie stuurt elk antwoord door (velden van Postmark, Resend, SendGrid of Mailgun, of {van, onderwerp, tekst,
// berichtId}). Een antwoord van een contact met een lopende opvolgreeks stopt die reeks en maakt een taak "bel terug
// binnen twee uur". Geen sessie: de URL is per organisatie ondertekend (zie /instellingen/mail). Elke mail telt één keer.
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { gebruikDb, metOrganisatie } from '../../../utils/db'
import { inkomendToken, leesWebhook, verwerkInkomend } from '../../../utils/mailInkomend'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const org = typeof q.o === 'string' ? q.o : ''
  const t = typeof q.t === 'string' ? q.t : ''
  const goed = org ? inkomendToken(org) : ''
  if (!org || !t || t.length !== goed.length || !timingSafeEqual(Buffer.from(t), Buffer.from(goed))) throw createError({ statusCode: 401, statusMessage: 'Ongeldige ondertekening' })
  const bestaat = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return ((await tx.execute(sql`select 1 from organisations where id = ${org} and status <> 'systeem'`)).rows as unknown[]).length > 0
  })
  if (!bestaat) throw createError({ statusCode: 404, statusMessage: 'Organisatie onbekend' })
  const m = leesWebhook(await readBody<any>(event).catch(() => null))
  if (!m) throw createError({ statusCode: 422, statusMessage: 'Geen afzender in de mail' })
  const r = await metOrganisatie(org, (tx) => verwerkInkomend(tx, org, m, 'webhook'))
  return { verwerking: r.verwerking, dubbel: r.dubbel, gestopt: r.reeksen.length }
})
