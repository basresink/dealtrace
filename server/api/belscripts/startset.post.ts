// POST /api/belscripts/startset: "Kopieer uit startset" zet de ontbrekende startscripts terug.
import { and, eq, isNotNull } from 'drizzle-orm'
import { STARTSET_SCRIPTS } from '../../../shared/belscripts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.beheer')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const bestaand = new Set((await tx.select({ s: schema.belscripts.startset, st: schema.belscripts.status }).from(schema.belscripts).where(and(isNotNull(schema.belscripts.startset)))).filter((x) => x.st !== 'gearchiveerd').map((x) => x.s))
    let n = 0
    for (const [i, s] of STARTSET_SCRIPTS.entries()) {
      const sleutel = `start-${i + 1}`
      if (bestaand.has(sleutel)) continue
      await tx.update(schema.belscripts).set({ startset: null }).where(and(eq(schema.belscripts.startset, sleutel)))
      const [b] = await tx.insert(schema.belscripts).values({ organisationId: ctx.organisatie.id, naam: s.naam, doel: s.doel, status: 'actief', versie: 1, startset: sleutel, data: s.data }).returning({ id: schema.belscripts.id })
      await tx.insert(schema.belscriptVersies).values({ organisationId: ctx.organisatie.id, belscriptId: b!.id, versie: 1, naam: s.naam, doel: s.doel, data: s.data, geactiveerdDoor: ctx.gebruiker.id })
      n++
    }
    return { toegevoegd: n }
  })
})
