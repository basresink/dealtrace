// POST /api/eigen-velden: nieuw veld (beheerder). Sleutel uit de naam, uniek per object.
// "Filterbaar aan" maakt een expressie-index (dealtrace_index_eigen_veld).
import { eq, sql } from 'drizzle-orm'
import { sleutelUitNaam } from '../../../shared/eigenVelden'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { MAX_VELDEN_PER_OBJECT, leesDefinitie } from '../../utils/eigenVeldBeheer'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'eigenVelden.beheren')
  const b = await readBody<any>(event)
  const def = leesDefinitie(b)
  const object = def.object ?? 'account'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const bestaand = await tx.select({ sleutel: schema.eigenVelden.sleutel }).from(schema.eigenVelden).where(eq(schema.eigenVelden.object, object))
    if (bestaand.length >= MAX_VELDEN_PER_OBJECT) throw createError({ statusCode: 409, statusMessage: `Hooguit ${MAX_VELDEN_PER_OBJECT} eigen velden per object` })
    const sleutel = b.sleutel ? String(b.sleutel) : sleutelUitNaam(def.naam, bestaand.map((x) => x.sleutel))
    if (bestaand.some((x) => x.sleutel === sleutel)) throw createError({ statusCode: 409, statusMessage: `De sleutel ${sleutel} bestaat al` })
    const [v] = await tx.insert(schema.eigenVelden).values({ organisationId: ctx.organisatie.id, object, sleutel, naam: def.naam, type: def.type, sectie: def.sectie, volgorde: def.volgorde ?? 0, data: def.data }).returning()
    if (def.data.filterbaar) await tx.execute(sql`select dealtrace_index_eigen_veld(${ctx.organisatie.id}, ${object}, ${sleutel}, ${def.type})`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'eigenVeld.aanmaken', resourceType: 'eigen_velden', resourceId: v!.id, changes: { object, sleutel, naam: def.naam, type: def.type } })
    return v
  })
})
