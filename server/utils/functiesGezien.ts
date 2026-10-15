// Houdt per gebruiker bij sinds wanneer elke functie aanstaat (users.data.functiesGezien),
// voor de toast "... staat nu voor je aan", de pil "nieuw" en "Voor jou" (4.4).
import { eq } from 'drizzle-orm'
import { functiesVoor, nieuwVoorMij } from '../../shared/functies'
import type { FunctieRegel, OrganisatieContext } from '../../shared/types'
import { metOrganisatie, schema } from './db'
import type { SessieGebruiker } from './sessie'

export async function werkFunctiesGezienBij(gebruiker: SessieGebruiker, organisatie: OrganisatieContext, stand: FunctieRegel[]) {
  const f = functiesVoor(gebruiker, organisatie, stand, gebruiker.verborgen)
  const data = gebruiker.data as any
  const r = nieuwVoorMij([...f.aan, ...f.verborgen], data.functiesGezien, new Date())
  let nogTonen = (data.nogTonen ?? []) as string[]
  if (r.gewijzigd) {
    nogTonen = [...new Set([...nogTonen, ...r.netAan])]
    await metOrganisatie(organisatie.id, async (tx) => {
      const [u] = await tx.select({ data: schema.users.data }).from(schema.users).where(eq(schema.users.id, gebruiker.id))
      await tx.update(schema.users).set({ data: { ...(u?.data ?? {}), functiesGezien: r.gezien, nogTonen } as any }).where(eq(schema.users.id, gebruiker.id))
    })
  }
  return { ...f, nieuw: r.nieuw, nogTonen }
}
