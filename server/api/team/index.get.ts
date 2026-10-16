// GET /api/team?team=&periode=: de teamtabel, aandachtspunten, werkverdeling, goedkeuringen en de
// telefoonstapels (P21). Salesmanager alleen zijn eigen teams (403 bij een ander team); beheerder alles.
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { teamOverzicht, zichtbareTeams } from '../../utils/team'
import { periodeUitQuery } from '../../utils/teamApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.team')
  const q = getQuery(event)
  const p = periodeUitQuery(q, 'vandaag')
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const teams = await zichtbareTeams(tx, g)
    const teamId = typeof q.team === 'string' && q.team ? q.team : teams[0]?.id
    if (!teamId) return { team: null, teams: [], rijen: [], aandachtspunten: [], werkverdeling: [], goedkeuringen: [], kop: 'Je bent nog geen eigenaar van een team.', periode: p, stapels: { zonderVerslag: [], nietOvergedragen: [], achterOpRitme: [] } }
    return { ...(await teamOverzicht(tx, g, teamId, p)), periode: p }
  })
})
