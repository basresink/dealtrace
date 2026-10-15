// GET /api/agenda?van=&tot=&gebruiker=: afspraken, belblokken, bezet uit de gekoppelde agenda en
// conflicten. Standaard je eigen agenda; een salesmanager ziet ook zijn teamleden (403 daarbuiten).
import { sql } from 'drizzle-orm'
import { nlMoment, plusDagen, nlTijdstip } from '../../../shared/datum'
import { kan } from '../../utils/accounts'
import { agendaVoor, meetingsoorten } from '../../utils/agenda'
import { metOrganisatie } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const q = getQuery(event)
  const vandaag = nlMoment(new Date()).datum
  const van = typeof q.van === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.van) ? q.van : vandaag
  const tot = typeof q.tot === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.tot) ? q.tot : plusDagen(van, 7)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const alle = (await tx.execute(sql`select id, name, role, team_id, werkplek, status from users where status = 'actief' and role <> 'founder' order by name`)).rows as any[]
    const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
    const zichtbaar = alle.filter((u) => u.id === ctx.gebruiker.id || ctx.gebruiker.rol === 'beheerder' || (ctx.gebruiker.rol === 'salesmanager' && u.team_id && teams.includes(u.team_id)) || (kan(ctx, 'agenda.voorCollega') && u.werkplek === 'buitendienst'))
    const gevraagd = typeof q.gebruiker === 'string' && q.gebruiker ? q.gebruiker.split(',') : [ctx.gebruiker.id]
    if (gevraagd.some((g) => !zichtbaar.some((u) => u.id === g))) throw createError({ statusCode: 403, statusMessage: 'Deze agenda valt buiten je team' })
    const a = await agendaVoor(tx, gevraagd, nlTijdstip(van, 0), nlTijdstip(tot, 0))
    const eersten = a.afspraken.filter((x) => x.soort.type === 'klant' && x.status === 'gepland').length
    return {
      van, tot, ...a, gebruikers: zichtbaar.map((u) => ({ id: u.id, naam: u.name, werkplek: u.werkplek })), meetingsoorten: (await meetingsoorten(tx)).filter((m) => m.actief),
      titel: `${a.afspraken.length === 1 ? '1 afspraak' : `${a.afspraken.length} afspraken`} in deze periode${eersten && eersten !== a.afspraken.length ? `, waarvan ${eersten} met klanten` : ''}.`,
      kan: { aanDeBeurt: kan(ctx, 'agenda.aanDeBeurt'), voorCollega: kan(ctx, 'agenda.voorCollega'), koppeling: kan(ctx, 'agenda.koppeling') },
    }
  })
})
