// PUT /api/eigen-velden/:id: wijzigen (beheerder). De sleutel blijft; een typewissel
// mag alleen als alle bestaande waarden geldig blijven (anders 422 met de records).
import { eq } from 'drizzle-orm'
import { typeWisselAfwijkend } from '../../../../shared/eigenVelden'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { leesDefinitie } from '../../../utils/eigenVeldBeheer'
import { vereisFunctie } from '../../../utils/sessie'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'eigenVelden.beheren')
  const id = getRouterParam(event, 'id')!
  const def = leesDefinitie(await readBody<any>(event))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [v] = await tx.select().from(schema.eigenVelden).where(eq(schema.eigenVelden.id, id))
    if (!v) throw createError({ statusCode: 404, statusMessage: 'Veld onbekend' })
    if (def.type !== v.type || JSON.stringify(def.data.opties) !== JSON.stringify(v.data?.opties ?? [])) {
      const tabel = v.object === 'account' ? schema.accounts : v.object === 'contact' ? schema.contacts : null
      if (tabel) {
        const rijen = await tx.select({ id: tabel.id, data: tabel.data }).from(tabel)
        const waarden = rijen.map((r) => ({ id: r.id, waarde: (r.data as any)?.customFields?.[v.sleutel] })).filter((w) => w.waarde !== undefined)
        const afwijkend = typeWisselAfwijkend({ ...def, naam: def.naam }, waarden)
        if (afwijkend.length) throw createError({ statusCode: 422, statusMessage: `${afwijkend.length} bestaande waarden passen niet bij het nieuwe type`, data: { records: afwijkend.slice(0, 50) } })
      }
    }
    const [n] = await tx.update(schema.eigenVelden).set({ naam: def.naam, type: def.type, sectie: def.sectie, volgorde: def.volgorde ?? v.volgorde, data: def.data, updatedAt: new Date().toISOString() }).where(eq(schema.eigenVelden.id, id)).returning()
    if (def.data.filterbaar && !v.data?.filterbaar) await tx.execute(sql`select dealtrace_index_eigen_veld(${ctx.organisatie.id}, ${v.object}, ${v.sleutel}, ${def.type})`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'eigenVeld.wijzigen', resourceType: 'eigen_velden', resourceId: id, changes: { voor: { naam: v.naam, type: v.type }, na: { naam: def.naam, type: def.type } } })
    return n
  })
})
