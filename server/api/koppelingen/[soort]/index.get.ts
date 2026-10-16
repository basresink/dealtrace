// GET /api/koppelingen/:soort: de stand van de CRM-koppeling zonder geheimen (P20). Beheerder en
// vanaf Expert lezen (wie synchroniseert of de bron gebruikt).
import { sql } from 'drizzle-orm'
import { kan } from '../../../utils/accounts'
import { crmStand } from '../../../utils/crm'
import { crmSoortUit } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisOrganisatie, weigerFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const soort = crmSoortUit(event)
  const inrichten = kan(ctx, 'koppeling.crm')
  if (!inrichten && !kan(ctx, 'koppeling.crmSync') && !kan(ctx, 'leadgenerator.crm')) weigerFunctie('koppeling.crmSync', 'niveau')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const s = await crmStand(tx, soort)
    const gebruikers = inrichten ? ((await tx.execute(sql`select id, name as naam, email, role from users where status = 'actief' and role <> 'founder' order by name`)).rows as any[]) : []
    return { ...s, kan: { inrichten, synchroniseren: inrichten || kan(ctx, 'koppeling.crmSync') }, gebruikers }
  })
})
