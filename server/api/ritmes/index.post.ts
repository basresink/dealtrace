// POST /api/ritmes {naam, stappen, parkeerDagen, werkplek?}: een nieuw hercontactritme (soort winback), te kiezen
// bij een terugkomregel. Salesmanager en beheerder; 422 bij een ongeldig ritme, 409 bij een bestaande naam.
import { sql } from 'drizzle-orm'
import { valideerRitme, type RitmeStap } from '../../../shared/hercontact'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'ritme.beheer')
  const b = await readBody<any>(event)
  const stappen: RitmeStap[] = (Array.isArray(b?.stappen) ? b.stappen : []).slice(0, 20).map((s: any, i: number) => ({ volgnummer: i + 1, dagOffset: Number(s?.dagOffset), kanaal: s?.kanaal, ...(s?.instructie ? { instructie: String(s.instructie).slice(0, 200) } : {}) }))
  const nieuw = { naam: String(b?.naam ?? '').trim().slice(0, 80), stappen, parkeerDagen: Number(b?.parkeerDagen) }
  const fouten = valideerRitme(nieuw)
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
  const werkplek = ['binnendienst', 'buitendienst'].includes(b?.werkplek) ? b.werkplek : 'alle'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if ((await tx.execute(sql`select 1 from hercontactritmes where lower(naam) = lower(${nieuw.naam})`)).rows.length) throw createError({ statusCode: 409, statusMessage: 'Er is al een ritme met deze naam' })
    const [r] = await tx.insert(schema.hercontactritmes).values({ organisationId: ctx.organisatie.id, naam: nieuw.naam, bron: 'winback', data: { stappen, parkeerDagen: nieuw.parkeerDagen, werkplek } }).returning({ id: schema.hercontactritmes.id })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'ritme.nieuw', resourceType: 'hercontactritmes', resourceId: r!.id, changes: { naar: nieuw } })
    return { id: r!.id, versie: 1 }
  })
})
