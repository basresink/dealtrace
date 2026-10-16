// POST /api/coaching/:gebruiker/plan {start}: "Plan coachingsgesprek" als interne meeting met de kaart als agenda.
import { sql } from 'drizzle-orm'
import { planAfspraak } from '../../../utils/agenda'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { vereisTeamlid } from '../../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  const b = await readBody<{ start?: string }>(event)
  if (!b?.start || Number.isNaN(Date.parse(b.start))) throw createError({ statusCode: 422, statusMessage: 'Kies een moment' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const u = await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, getRouterParam(event, 'gebruiker')!)
    const [soort] = (await tx.execute(sql`select id from meetingsoorten where type = 'intern' and actief order by (slug = 'coachingsgesprek') desc, naam limit 1`)).rows as any[]
    if (!soort) throw createError({ statusCode: 422, statusMessage: 'Er is geen interne meetingsoort' })
    const [s] = (await tx.execute(sql`select data from coaching_sessies where gebruiker_id = ${u.id} order by datum desc limit 1`)).rows as any[]
    const agenda = ['Cijfers tegen norm en team', ...((s?.data?.punten ?? []) as any[]).map((p) => `Coachingpunt: ${p.tekst}`), 'Afspraken'].join('\n')
    const r = await planAfspraak(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, rol: ctx.gebruiker.rol, mag: { voorCollega: false } }, { meetingsoortId: soort.id, start: new Date(b.start!).toISOString(), duurMin: 30, beschrijving: `Coachingsgesprek met ${u.name.replace(/^Testgebruiker /, '')}\n${agenda}`, collegaUitnodigen: [u.id] })
    return { afspraakId: r.id, tekst: 'Coachingsgesprek gepland.' }
  })
})
