// POST /api/analyse/voorstellen/:id {besluit: accepteer|wijs-af|later}: het verbetervoorstel van de Coach (P21).
// Accepteer maakt een conceptversie van de reis met het voorstel als notitie; Later komt na 30 dagen terug.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'analyse.verbetervoorstel')
  const id = getRouterParam(event, 'id')!
  const { besluit } = await readBody<{ besluit?: string }>(event)
  if (!['accepteer', 'wijs-af', 'later'].includes(besluit ?? '')) throw createError({ statusCode: 422, statusMessage: 'Kies Accepteer, Wijs af of Later' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = (await tx.execute(sql`select * from signals where id = ${id} and type = 'verbetervoorstel' and owner_id = ${ctx.gebruiker.id}`)).rows as any[]
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Voorstel onbekend' })
    let conceptId: string | null = null
    if (besluit === 'accepteer') {
      const [r] = (await tx.execute(sql`select * from reistemplates where id = ${s.data?.reisId}`)).rows as any[]
      if (r) {
        conceptId = crypto.randomUUID()
        await tx.execute(sql`insert into reistemplates (id, organisation_id, naam, status, versie, is_standaard, doelgroep_id, data)
          values (${conceptId}, ${r.organisation_id}, ${`${r.naam} (concept)`}, 'concept', ${Number(r.versie) + 1}, false, ${r.doelgroep_id}, ${JSON.stringify({ ...r.data, basisId: r.id, verbetervoorstel: { tekst: s.data?.voorstel, onderbouwing: s.data?.onderbouwing, signalId: id } })}::jsonb)`)
      }
    }
    const status = besluit === 'accepteer' ? 'geaccepteerd' : besluit === 'wijs-af' ? 'afgewezen' : 'later'
    await tx.execute(sql`update signals set status = ${status}, data = data || ${JSON.stringify({ besluit: { door: ctx.gebruiker.id, op: new Date().toISOString(), conceptId, ...(status === 'later' ? { terugOp: new Date(Date.now() + 30 * 864e5).toISOString() } : {}) } })}::jsonb, updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'verbetervoorstel.besluit', resourceType: 'signals', resourceId: id, changes: { besluit, conceptId } })
    return { status, conceptId }
  })
})
