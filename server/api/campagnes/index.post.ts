// POST /api/campagnes: een campagne als concept (F12). 400 als een gekozen account in een ander ritme of
// een andere campagne zit (met de lijst). Alleen-Expert-onderdelen vallen weg voor lagere niveaus.
import { kan } from '../../utils/accounts'
import { schrijfAudit } from '../../utils/audit'
import { maak, soorten } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.maken')
  const b = await readBody<any>(event)
  if (!b?.bron?.soort) throw createError({ statusCode: 400, statusMessage: 'Kies een doelgroep' })
  const team = kan(ctx, 'campagnes.team')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const s = (await soorten(tx)).find((x) => x.sleutel === b.soort)
    if (s && !s.startsoort && !kan(ctx, 'campagnes.alleSoorten')) throw createError({ statusCode: 403, statusMessage: 'Deze soort komt vanaf Expert', data: { functie: 'campagnes.alleSoorten', reden: 'niveau' } })
    const inv = {
      ...b,
      tussendoelen: kan(ctx, 'campagnes.tussendoelen') ? b.tussendoelen : [],
      eigenaarId: team ? b.eigenaarId ?? ctx.gebruiker.id : ctx.gebruiker.id,
      verdeling: team ? b.verdeling ?? null : null,
    }
    const r = await maak(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, inv)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'campagne.maken', resourceType: 'campagnes', resourceId: r.id, changes: { soort: b.soort, accounts: r.accounts } })
    return r
  })
})
