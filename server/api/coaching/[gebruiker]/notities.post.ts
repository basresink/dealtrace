// POST /api/coaching/:gebruiker/notities {soort, tekst, termijn?, sessieId?, sleutel?}: een afspraak (de
// accountmanager ziet hem, krijgt er een taak voor met de termijn als deadline en een melding
// "Coachingafspraak gedeeld" die naar die taak linkt) of een privénotitie (alleen managers).
// Afspraak, taak, melding en auditregel gaan in één transactie.
// Idempotent op de sleutel, zodat een afspraak uit de offline wachtrij precies één keer aankomt.
import { sql } from 'drizzle-orm'
import { afspraakAlsTaak } from '../../../utils/coaching'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { vereisTeamlid } from '../../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  const b = await readBody<{ soort?: string; tekst?: string; termijn?: string | null; sessieId?: string | null; sleutel?: string | null }>(event)
  if (b?.soort !== 'afspraak' && b?.soort !== 'prive') throw createError({ statusCode: 422, statusMessage: 'Kies afspraak of privé' })
  const tekst = b.tekst?.trim()
  if (!tekst) throw createError({ statusCode: 422, statusMessage: 'Schrijf de afspraak op' })
  if (b.termijn && !/^\d{4}-\d{2}-\d{2}$/.test(b.termijn)) throw createError({ statusCode: 422, statusMessage: 'Kies een termijn' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const u = await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, getRouterParam(event, 'gebruiker')!)
    if (b.sleutel) {
      const [al] = (await tx.execute(sql`select id from coaching_notities where data->>'sleutel' = ${b.sleutel}`)).rows as any[]
      if (al) return { id: al.id, herhaald: true }
    }
    const [n] = (await tx.execute(sql`insert into coaching_notities (organisation_id, gebruiker_id, manager_id, soort, tekst, termijn, sessie_id, data) values (${ctx.organisatie.id}, ${u.id}, ${ctx.gebruiker.id}, ${b.soort}, ${tekst.slice(0, 1000)}, ${b.termijn ?? null}, ${b.sessieId ?? null}, ${JSON.stringify(b.sleutel ? { sleutel: b.sleutel } : {})}::jsonb) returning id`)).rows as any[]
    if (b.soort !== 'afspraak') return { id: n.id }
    const taakId = await afspraakAlsTaak(tx, ctx.organisatie.id, ctx.gebruiker.id, u.id, { id: n.id, tekst: tekst.slice(0, 1000), termijn: b.termijn ?? null, sessieId: b.sessieId ?? null })
    return { id: n.id, taakId }
  })
})
