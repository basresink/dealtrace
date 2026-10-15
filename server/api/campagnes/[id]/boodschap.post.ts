// POST /api/campagnes/:id/boodschap {kanaal, toon}: een nieuwe boodschap voor dit kanaal, bewaard in de
// campagne met de gebruikte versies van het verkoopverhaal (vvVersies). 402 zonder credits.
import { sql } from 'drizzle-orm'
import { boodschap, laad, magWijzigen } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.boodschapAI')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  const kanaal = ['mail', 'linkedin', 'kaart'].includes(b?.kanaal) ? b.kanaal : 'mail'
  const toon = ['Zakelijk', 'Persoonlijk', 'Kort'].includes(b?.toon) ? b.toon : 'Zakelijk'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const c = await laad(tx, id)
    if (!(await magWijzigen(tx, ctx.gebruiker, c))) throw createError({ statusCode: 403, statusMessage: 'Alleen de eigenaar of de salesmanager wijzigt deze campagne' })
    const r = await boodschap(tx, ctx.organisatie.id, ctx.gebruiker, { kanaal, toon, winpuntId: c.data?.winpuntId ?? null, brancheId: c.data?.brancheId ?? null })
    if (!r) throw createError({ statusCode: 422, statusMessage: 'Het AI-antwoord was niet bruikbaar. Probeer het opnieuw of gebruik de vaste tekst.' })
    await tx.execute(sql`update campagnes set data = jsonb_set(data || ${JSON.stringify({ vvVersies: r.vvVersies })}::jsonb, '{boodschap}', coalesce(data->'boodschap', '{}'::jsonb) || ${JSON.stringify({ [kanaal]: r.tekst })}::jsonb), versie = versie + 1, updated_at = now() where id = ${id}`)
    return r
  })
})
