// POST /api/whatsapp/sjablonen {naam, taal, tekst} (beheerder): een sjabloon als concept. Indienen bij de
// provider is een aparte stap; pas met status goedgekeurd is het kiesbaar.
import { sql } from 'drizzle-orm'
import { controleerSjabloon } from '../../../../shared/kanalen'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.whatsapp')
  const b = await readBody<any>(event)
  const s = { naam: String(b?.naam ?? '').trim(), taal: String(b?.taal ?? 'nl').trim(), tekst: String(b?.tekst ?? '').trim() }
  const fouten = controleerSjabloon(s)
  if (fouten.length) throw createError({ statusCode: 400, statusMessage: fouten[0] })
  const org = ctx.organisatie.id
  return metOrganisatie(org, async (tx) => {
    const [r] = (await tx.execute(sql`insert into whatsapp_sjablonen (organisation_id, naam, taal, tekst, door) values (${org}, ${s.naam}, ${s.taal}, ${s.tekst}, ${ctx.gebruiker.id})
      on conflict (organisation_id, naam, taal) do update set tekst = excluded.tekst, status = 'concept', extern_id = null, reden = null, updated_at = now() returning id, status`)).rows as any[]
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'whatsapp.sjabloon', resourceType: 'whatsapp_sjablonen', resourceId: r.id, changes: { naam: s.naam, taal: s.taal } })
    return { id: r.id, status: r.status, tekst: 'Sjabloon bewaard. Dien het in bij de provider.' }
  })
})
