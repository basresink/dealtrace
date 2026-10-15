// GET /api/mij/instellingen: je persoonlijke instellingen met de versie voor de sync-wachtrij.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  return metOrganisatie(organisatie.id, async (tx) => {
    const [p] = await tx.select().from(schema.persoonlijkeInstellingen).where(eq(schema.persoonlijkeInstellingen.id, gebruiker.id))
    const [v] = await tx.select().from(schema.serverRecords).where(eq(schema.serverRecords.key, `persoonlijke_instellingen:${gebruiker.id}`))
    return { id: gebruiker.id, data: p?.data ?? {}, versie: v?.version ?? 0 }
  })
})
