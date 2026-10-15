// POST /api/mij/vandaag-volgorde {volgorde}: eigen volgorde van de blokken 6 tot en met 8 op Vandaag (Gevorderd).
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const BLOKKEN = ['agents', 'datakwaliteit', 'week']

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisFunctie(event, 'vandaag.indeling')
  const { volgorde } = await readBody<{ volgorde?: string[] }>(event)
  if (!Array.isArray(volgorde) || volgorde.length !== BLOKKEN.length || !BLOKKEN.every((b) => volgorde.includes(b))) throw createError({ statusCode: 422, statusMessage: 'Ongeldige volgorde' })
  return metOrganisatie(organisatie.id, async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, gebruiker.id))
    await tx.update(schema.users).set({ data: { ...(u!.data ?? {}), vandaagVolgorde: volgorde } as any, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, gebruiker.id))
    return { volgorde }
  })
})
