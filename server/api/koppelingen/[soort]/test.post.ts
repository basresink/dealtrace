// POST /api/koppelingen/:soort/test: de verbinding testen; de melding in gewone taal (P20).
import { sql } from 'drizzle-orm'
import { adapterVoor, crmRij } from '../../../utils/crm'
import { crmSoortUit } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crm')
  const soort = crmSoortUit(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const k = await crmRij(tx, soort)
    if (!k || k.status === 'uit') return { ok: false, melding: 'Er is nog geen CRM gekoppeld. Verbind je CRM om te beginnen.' }
    try { const r = await (await adapterVoor(tx, k)).test(); await tx.execute(sql`update koppelingen set getest_op = now() where id = ${k.id}`); return r } catch (e: any) { return { ok: false, melding: e?.message ?? 'De verbinding werkt niet.' } }
  })
})
