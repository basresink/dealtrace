// PUT /api/instellingen/verkoopverhaal/mappings: branche naar SBI en trefwoorden, verliesreden naar
// terugkomregel en ambitiedoelen (eigen aanvullingen, altijd bewerkbaar). Beheerder.
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { zetAanvullingen } from '../../../utils/vvProjectie'
import { vereisFunctie } from '../../../utils/sessie'

const lijst = (v: unknown) => (Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 20) : [])
export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.mappings')
  const b = await readBody<any>(event)
  const a = {
    ...(Array.isArray(b?.brancheMapping) ? { brancheMapping: b.brancheMapping.map((m: any) => ({ brancheId: String(m.brancheId), sbiCodes: lijst(m.sbiCodes).filter((x) => /^\d{2,5}$/.test(x)), trefwoorden: lijst(m.trefwoorden) })) } : {}),
    ...(Array.isArray(b?.redenmapping) ? { redenmapping: b.redenmapping.map((m: any) => ({ bronSoort: String(m.bronSoort), reden: String(m.reden), terugkomregelId: m.terugkomregelId ? String(m.terugkomregelId) : null })) } : {}),
    ...(Array.isArray(b?.ambitiedoelen) ? { ambitiedoelen: b.ambitiedoelen.map((d: any) => ({ id: String(d.id), naam: String(d.naam), doel: Number(d.doel) || 0, eenheid: String(d.eenheid ?? 'aantal'), jaar: d.jaar ? Number(d.jaar) : null, stand: d.stand === '' || d.stand == null ? null : Number(d.stand) })) } : {}),
  }
  await metOrganisatie(ctx.organisatie.id, async (tx) => {
    await zetAanvullingen(tx, ctx.organisatie.id, a)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'verkoopverhaal.mappings', resourceType: 'vv_branche_mapping', resourceId: 'mappings', changes: { onderdelen: Object.keys(a) } })
  })
  return { ok: true }
})
