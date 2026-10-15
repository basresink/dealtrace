// POST /api/mij/gezien: de toast "... staat nu voor je aan" is getoond.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  await metOrganisatie(organisatie.id, async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, gebruiker.id))
    const data = { ...(u!.data ?? {}) } as any
    delete data.nogTonen
    await tx.update(schema.users).set({ data }).where(eq(schema.users.id, gebruiker.id))
  })
  return { ok: true }
})
