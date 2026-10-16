// PUT /api/koppelingen/:soort {richting?, toewijzing?, eigenaarsregel?, overdracht?, slapendMaanden?}: alleen de
// beheerder (403 reden rol). 422 bij een onbekend Dealtrace-veld. Schrijven aanzetten legt het moment vast:
// alleen wat daarna gebeurt, gaat naar het CRM.
import { sql } from 'drizzle-orm'
import { CRM_OBJECTEN, magSchrijven, RICHTING_LABEL, toewijzingFouten, type Richting, type Toewijzing } from '../../../../shared/crm'
import { schrijfAudit } from '../../../utils/audit'
import { crmRij, crmStand, instellingenVan } from '../../../utils/crm'
import { crmSoortUit } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crm')
  const soort = crmSoortUit(event)
  const b = await readBody<{ richting?: Record<string, Richting>; toewijzing?: { bedrijven?: Toewijzing[]; contacten?: Toewijzing[] }; eigenaarsregel?: { terugval?: string | null }; overdracht?: boolean; slapendMaanden?: number }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const k = await crmRij(tx, soort)
    if (!k) throw createError({ statusCode: 409, statusMessage: 'Verbind eerst het CRM' })
    const oud = instellingenVan(k)
    const patch: Record<string, unknown> = {}
    const nu = new Date().toISOString()
    if (b?.richting) {
      const r = { ...oud.richting }
      for (const o of CRM_OBJECTEN) if (b.richting[o]) { if (!(b.richting[o]! in RICHTING_LABEL)) throw createError({ statusCode: 422, statusMessage: 'Kies Lezen, Schrijven of Beide' }); r[o] = b.richting[o]! }
      patch.richting = r
      patch.schrijvenSinds = { ...(oud.schrijvenSinds ?? {}), ...Object.fromEntries(CRM_OBJECTEN.filter((o) => magSchrijven(r[o]) && !magSchrijven(oud.richting[o])).map((o) => [o, nu])) }
    }
    if (b?.toewijzing) {
      const eigen = ((await tx.execute(sql`select sleutel from eigen_velden`)).rows as any[]).map((r) => r.sleutel)
      const t = { ...oud.toewijzing }
      for (const o of ['bedrijven', 'contacten'] as const) {
        if (!b.toewijzing[o]) continue
        const lijst = b.toewijzing[o]!.map((x) => ({ crmVeld: String(x.crmVeld ?? '').trim(), veld: String(x.veld ?? '').trim() })).filter((x) => x.crmVeld && x.veld)
        const f = toewijzingFouten(o, lijst, eigen)
        if (f.length) throw createError({ statusCode: 422, statusMessage: f[0], data: { fouten: f } })
        t[o] = lijst
      }
      patch.toewijzing = t
    }
    if (b?.eigenaarsregel && 'terugval' in b.eigenaarsregel) {
      const id = b.eigenaarsregel.terugval || null
      if (id && !((await tx.execute(sql`select 1 from users where id = ${id} and status = 'actief'`)).rows.length)) throw createError({ statusCode: 422, statusMessage: 'Deze gebruiker bestaat niet' })
      patch.eigenaarsregel = { ...oud.eigenaarsregel, terugval: id }
    }
    if (typeof b?.overdracht === 'boolean') patch.overdracht = b.overdracht
    if (b?.slapendMaanden != null) { if (![3, 6, 12].includes(Number(b.slapendMaanden))) throw createError({ statusCode: 422, statusMessage: 'Kies 3, 6 of 12 maanden' }); patch.slapendMaanden = Number(b.slapendMaanden) }
    await tx.execute(sql`update koppelingen set instellingen = instellingen || ${JSON.stringify(patch)}::jsonb, updated_at = now() where id = ${k.id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'koppeling.crm.instellingen', resourceType: 'koppelingen', resourceId: soort, changes: patch })
    return crmStand(tx, soort)
  })
})
