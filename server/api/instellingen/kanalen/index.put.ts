// PUT /api/instellingen/kanalen {frequentieplafond?, uit?} (beheerder): frequentieplafond (1 tot 10 werkdagen, 1 tot 5 berichten) en welke kanalen uit staan.
import { sql } from 'drizzle-orm'
import { KANALEN } from '../../../../shared/nbStatus'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.kanalen')
  const b = await readBody<any>(event)
  const org = ctx.organisatie.id
  const zet: Record<string, unknown> = {}
  // De afkoeling wijzig je alleen op Instellingen, Terugkomen: daar zie je ook welke prospects verschuiven.
  if (b?.afkoeling != null) throw createError({ statusCode: 409, statusMessage: 'De afkoeling wijzig je op Instellingen, Terugkomen' })
  if (b?.frequentieplafond) {
    const w = Math.round(Number(b.frequentieplafond.werkdagen)); const m = Math.round(Number(b.frequentieplafond.maxBerichten))
    if (!(w >= 1 && w <= 10 && m >= 1 && m <= 5)) throw createError({ statusCode: 400, statusMessage: 'Kies 1 tot 10 werkdagen en 1 tot 5 berichten' })
    zet.frequentieplafond = { werkdagen: w, maxBerichten: m }
  }
  if (Array.isArray(b?.uit)) zet.kanalenUit = b.uit.filter((k: string) => (KANALEN as readonly string[]).includes(k))
  return metOrganisatie(org, async (tx) => {
    for (const [key, value] of Object.entries(zet)) {
      await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${org}, ${key}, ${JSON.stringify(value)}::jsonb) on conflict (organisation_id, key) do update set value = excluded.value`)
    }
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'kanalen.wijzig', resourceType: 'org_settings', resourceId: 'kanalen', changes: zet })
    return { ok: true, tekst: 'Kanalen bewaard.' }
  })
})
