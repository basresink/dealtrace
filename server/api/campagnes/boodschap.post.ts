// POST /api/campagnes/boodschap {kanaal, toon, winpuntId, brancheId}: een boodschap per kanaal met
// stijlscore voor de wizard (Schrijver, mandaat A). 402 met de tekst uit 11.4 als de credits op zijn.
import { boodschap } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.boodschapAI')
  const b = await readBody<any>(event)
  const kanaal = ['mail', 'linkedin', 'kaart'].includes(b?.kanaal) ? b.kanaal : 'mail'
  const toon = ['Zakelijk', 'Persoonlijk', 'Kort'].includes(b?.toon) ? b.toon : 'Zakelijk'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = await boodschap(tx, ctx.organisatie.id, ctx.gebruiker, { kanaal, toon, winpuntId: b?.winpuntId ?? null, brancheId: b?.brancheId ?? null })
    if (!r) throw createError({ statusCode: 422, statusMessage: 'Het AI-antwoord was niet bruikbaar. Probeer het opnieuw of gebruik de vaste tekst.' })
    return r
  })
})
