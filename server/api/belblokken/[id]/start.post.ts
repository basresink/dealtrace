// POST /api/belblokken/:id/start: de sessie start; de scriptversies liggen vast tot het einde
// van het blok, en met "Onderdruk meldingen" worden in-app meldingen vastgehouden.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { zetStil } from '../../../utils/bellen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select().from(schema.belblokSessies).where(eq(schema.belblokSessies.id, id))
    if (!s || s.gebruikerId !== ctx.gebruiker.id) throw createError({ statusCode: 404, statusMessage: 'Belblok onbekend' })
    if (s.status === 'klaar') throw createError({ statusCode: 409, statusMessage: 'Dit blok is al klaar' })
    const nu = new Date().toISOString()
    const versies = Object.fromEntries((await tx.select({ id: schema.belscripts.id, versie: schema.belscripts.versie }).from(schema.belscripts).where(eq(schema.belscripts.status, 'actief'))).map((x) => [x.id, x.versie]))
    const data = { ...s.data, scriptVersies: (s.data as any).scriptVersies ?? versies } as any
    await tx.update(schema.belblokSessies).set({ status: 'bezig', gestartOp: s.gestartOp ?? nu, data }).where(eq(schema.belblokSessies.id, id))
    if (s.data.stil) await zetStil(tx, ctx.gebruiker.id, { vanaf: s.gestartOp ?? nu, tot: s.eindOp })
    return { id, status: 'bezig' }
  })
})
