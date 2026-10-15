// POST /api/mij/toon-minder {functie, verborgen}: zelf een functie verbergen of
// weer tonen. Nooit iets aanzetten dat voor je niveau uit staat.
import { eq } from 'drizzle-orm'
import { beschikbaar, functie as zoekFunctie } from '../../../shared/functies'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie, stand } = await vereisFunctie(event, 'mij.toonMinder')
  const b = await readBody<{ functie?: string; verborgen?: boolean }>(event)
  const f = b.functie ? zoekFunctie(b.functie) : undefined
  if (!f || !f.zijbalk) throw createError({ statusCode: 400, statusMessage: 'Onbekende functie' })
  if (b.verborgen && !beschikbaar(f.sleutel, gebruiker, organisatie, stand).ok) throw createError({ statusCode: 422, statusMessage: 'Deze functie staat niet voor je aan' })
  if (f.sleutel === 'nav.vandaag') throw createError({ statusCode: 400, statusMessage: 'Vandaag kun je niet verbergen' })
  return metOrganisatie(organisatie.id, async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, gebruiker.id))
    const data = { ...(u!.data ?? {}) } as any
    const set = new Set<string>(data.verborgen ?? [])
    if (b.verborgen) set.add(f.sleutel)
    else set.delete(f.sleutel)
    data.verborgen = [...set]
    await tx.update(schema.users).set({ data, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, gebruiker.id))
    return { verborgen: data.verborgen }
  })
})
