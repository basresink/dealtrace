// POST /api/mij/dagritme-mail/voorbeeld: stuur de weekreview, weekstart of dagstart nu als voorbeeld naar
// je eigen adres (zonder RESEND_API_KEY via de mock-outbox). Geeft onderwerp en tekst terug.
import { DAGRITME_MAILS, type DagritmeMail } from '../../../../shared/dagritmeMail'
import { metOrganisatie } from '../../../utils/db'
import { gebruikerVan, maakDagritmeMail } from '../../../utils/dagritmeWeek'
import { stuurMeldingMail } from '../../../utils/mailer'
import { vereisFunctie } from '../../../utils/sessie'
import { kan } from '../../../utils/accounts'

const FUNCTIE: Record<DagritmeMail, string> = { weekreview: 'dagritme.weekreview', weekstart: 'dagritme.weekstart', dagstart: 'dagritme.dagstart' }

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.mail')
  const b = await readBody<{ soort?: string }>(event)
  const soort = String(b?.soort ?? '') as DagritmeMail
  if (!(DAGRITME_MAILS as readonly string[]).includes(soort)) throw createError({ statusCode: 422, statusMessage: 'Kies weekreview, weekstart of dagstart' })
  if (!kan(ctx, FUNCTIE[soort])) throw createError({ statusCode: 403, statusMessage: 'Deze functie staat voor jou nog niet aan', data: { reden: 'niveau' } })
  const basis = process.env.URL || getRequestURL(event).origin
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const g = await gebruikerVan(tx, ctx.gebruiker.id)
    if (!g.email) throw createError({ statusCode: 422, statusMessage: 'Je account heeft geen e-mailadres' })
    const mail = await maakDagritmeMail(tx, ctx.organisatie!.id, g.id, soort, new Date(), basis)
    await stuurMeldingMail(g.email, mail.onderwerp, mail.tekst)
    return { aan: g.email, ...mail }
  })
})
