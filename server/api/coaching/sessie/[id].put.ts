// PUT /api/coaching/sessie/:id {punten?, gesprekken?}: coachingpunten bewerken en delen (P21). Een punt is
// pas zichtbaar voor de accountmanager met gedeeld; delen meldt "Coachingpunt gedeeld".
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { vereisTeamlid } from '../../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ punten?: { tekst: string; onderbouwing?: any; artikelSleutel?: string | null; gedeeld?: boolean }[]; gesprekken?: string[] }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = (await tx.execute(sql`select * from coaching_sessies where id = ${id}`)).rows as any[]
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Sessie onbekend' })
    await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, s.gebruiker_id)
    const punten = b?.punten ? b.punten.filter((p) => p.tekst?.trim()).slice(0, 3).map((p) => ({ tekst: p.tekst.trim().slice(0, 300), onderbouwing: p.onderbouwing ?? null, artikelSleutel: p.artikelSleutel ?? null, gedeeld: !!p.gedeeld })) : s.data?.punten ?? []
    const nieuwGedeeld = punten.filter((p: any) => p.gedeeld).length > (s.data?.punten ?? []).filter((p: any) => p.gedeeld).length
    await tx.execute(sql`update coaching_sessies set data = data || ${JSON.stringify({ punten, ...(b?.gesprekken ? { gesprekken: b.gesprekken.slice(0, 5) } : {}) })}::jsonb, updated_at = now() where id = ${id}`)
    if (nieuwGedeeld) await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${ctx.organisatie.id}, ${s.gebruiker_id}, 'systeem', 'Coachingpunt gedeeld', 'Je salesmanager deelde een coachingpunt met je.', '/resultaten', now(), '{}'::jsonb)`)
    return { id, punten }
  })
})
