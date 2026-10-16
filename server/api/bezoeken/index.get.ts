// GET /api/bezoeken?datum=&gebruiker=&...filters: de bezoekdag (F10). Route, dagstatistiek, kansen
// langs de route, bellijst naast de bezoeken en te plannen bezoeken. Standaard "mijn"; een
// salesmanager kiest een teamlid (403 daarbuiten). Met bezoeken.periode ook de werkweek (weekdagen) voor de
// dag- en weekindeling; weergave=week toont die week in de routelijst.
import { sql } from 'drizzle-orm'
import { nlMoment } from '../../../shared/datum'
import { kan } from '../../utils/accounts'
import { bezoekDag, bezoekWeek } from '../../utils/bezoeken'
import { metOrganisatie } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'bezoeken.route')
  const q = getQuery(event)
  const vandaag = nlMoment(new Date()).datum
  const dag = kan(ctx, 'bezoeken.periode') && typeof q.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.datum) ? q.datum : vandaag
  const alle = kan(ctx, 'bezoeken.kansenAlle')
  const getal = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    let wie = ctx.gebruiker.id
    if (typeof q.gebruiker === 'string' && q.gebruiker && q.gebruiker !== wie) {
      const [u] = (await tx.execute(sql`select id, team_id from users where id = ${q.gebruiker}`)).rows as any[]
      const team = ctx.gebruiker.rol === 'beheerder' || (ctx.gebruiker.rol === 'salesmanager' && u?.team_id && (await eigenTeams(tx, ctx.gebruiker.id)).includes(u.team_id))
      if (!u || !team) throw createError({ statusCode: 403, statusMessage: 'Deze route valt buiten je team' })
      wie = u.id
    }
    const [g] = (await tx.execute(sql`select id, name, werkplek, data from users where id = ${wie}`)).rows as any[]
    const r = await bezoekDag(tx, { id: g.id, naam: g.name, werkplek: g.werkplek, data: g.data ?? {}, niveau: ctx.gebruiker.niveau as any }, dag, {
      alleenMijn: !alle || q.alleenMijn !== '0', alleenProspects: !alle || q.alleenProspects !== '0', maxOmrij: alle ? getal(q.maxOmrij, 20) : 20,
      aantal: !alle ? 3 : q.aantal === 'alles' ? null : getal(q.aantal, 10), bron: alle ? (q.bron as string) || null : null, klasse: alle ? (q.klasse as string) || null : null,
      brancheId: alle ? (q.branche as string) || null : null, ongepland: kan(ctx, 'bezoeken.eigenRegels') && q.ongepland === '1',
    }, new Date(), { bellijst: kan(ctx, 'bezoeken.bellijst'), teplannen: kan(ctx, 'bezoeken.teplannen'), kansenAlle: alle })
    const team = ['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol) ? (await tx.execute(sql`select id, name from users where werkplek = 'buitendienst' and status = 'actief' order by name`)).rows as any[] : []
    const weekdagen = kan(ctx, 'bezoeken.periode') ? await bezoekWeek(tx, { id: g.id, data: g.data ?? {} }, dag) : []
    return {
      ...r, weekdagen, weergave: weekdagen.length && q.weergave === 'week' ? 'week' : 'dag', gebruiker: { id: g.id, naam: g.name },
      team: team.map((u) => ({ id: u.id, naam: u.name })),
      kaartapp: (ctx.gebruiker.data as any)?.kaartapp ?? 'google',
      kan: { kansenAlle: alle, bellijst: kan(ctx, 'bezoeken.bellijst'), teplannen: kan(ctx, 'bezoeken.teplannen'), periode: kan(ctx, 'bezoeken.periode'), eigenRegels: kan(ctx, 'bezoeken.eigenRegels'), analyse: kan(ctx, 'regio.analyse'), inloop: kan(ctx, 'bezoeken.kansenAlle') },
    }
  })
})
