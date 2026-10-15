// GET /api/eigen-velden?object=account: definities. De beheerder ziet alles (ook
// gearchiveerd, met aantal ingevuld); anderen alleen wat hun niveau mag zien.
import { eq } from 'drizzle-orm'
import { VELD_OBJECTEN } from '../../../shared/eigenVelden'
import { effectiefNiveau, eigenVeldenVoor, kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const object = String(getQuery(event).object ?? 'account')
  if (!(VELD_OBJECTEN as readonly string[]).includes(object)) throw createError({ statusCode: 400, statusMessage: 'Onbekend object' })
  const beheer = kan(ctx, 'eigenVelden.beheren')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, object, effectiefNiveau(ctx), beheer)
    let ingevuld: Record<string, number> = {}
    if (beheer && (object === 'account' || object === 'contact')) {
      const tabel = object === 'account' ? schema.accounts : schema.contacts
      const rijen = await tx.select({ data: tabel.data }).from(tabel)
      for (const r of rijen) for (const k of Object.keys((r.data as any)?.customFields ?? {})) ingevuld[k] = (ingevuld[k] ?? 0) + 1
    }
    const voorstellen = beheer ? await tx.select().from(schema.eigenVeldVoorstellen).where(eq(schema.eigenVeldVoorstellen.status, 'open')) : []
    return { velden: velden.map((v) => ({ ...v, ingevuld: ingevuld[v.sleutel] ?? 0 })), voorstellen, kan: { beheren: beheer } }
  })
})
