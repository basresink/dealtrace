// GET /api/ritmes: hercontactritmes met rapport (lezen vanaf Gevorderd).
import { metOrganisatie, schema } from '../../utils/db'
import { ritmeRapport } from '../../../shared/hercontact'
import { kan } from '../../utils/accounts'
import { laadRitmes } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'ritme.lezen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const ritmes = await laadRitmes(tx)
    const accounts = await tx.select({ data: schema.accounts.data }).from(schema.accounts)
    const standen = accounts.map((a) => (a.data as any)?.reis?.ritme).filter(Boolean)
    return {
      ritmes: ritmes.map((r) => ({ ...r, rapport: ritmeRapport(standen.filter((s: any) => s.ritmeId === r.id)), inGebruik: standen.filter((s: any) => s.ritmeId === r.id && s.actief).length })),
      kan: { beheer: kan(ctx, 'ritme.beheer'), voorstellen: !kan(ctx, 'ritme.beheer') },
    }
  })
})
