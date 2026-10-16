// GET /api/platform/ai: de AI-koppeling van het platform en de afwijkingen per klant: provider, regio,
// "geen training", modellen per soort en de vingerafdruk van de sleutel (nooit de sleutel). Plus llm_prijzen.
import { sql } from 'drizzle-orm'
import { AI_SOORT, AI_SOORTEN } from '../../../../shared/credits'
import { STANDAARD_MODEL } from '../../../utils/aiKoppeling'
import { ontsleutel } from '../../../utils/geheimen'
import { vingerafdruk } from '../../../utils/salesdnaWebhook'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const rijen = (await tx.execute(sql`select l.*, o.name from llm_connections l left join organisations o on o.id = l.organisation_id order by l.organisation_id nulls first`)).rows as any[]
    const uit = (r: any) => { const s = ontsleutel(r.sleutel, 'llm')?.sleutel; return { organisatieId: r.organisation_id, klant: r.name ?? null, provider: r.provider, regio: r.regio, geenTraining: r.geen_training, modellen: r.modellen ?? {}, vingerafdruk: s ? vingerafdruk(s) : null, getestOp: r.getest_op } }
    const prijzen = (await tx.execute(sql`select model, invoer_cent_mtok, uitvoer_cent_mtok, peildatum::text as peildatum from llm_prijzen order by model, peildatum desc`)).rows as any[]
    return {
      modus: (process.env.AI_PROVIDER ?? 'mock') === 'mock' ? 'mock' : 'echt', omgeving: !!process.env.ANTHROPIC_API_KEY,
      platform: rijen.find((r) => !r.organisation_id) ? uit(rijen.find((r) => !r.organisation_id)) : null,
      klanten: rijen.filter((r) => r.organisation_id).map(uit),
      soorten: AI_SOORTEN.map((s) => ({ soort: s, naam: AI_SOORT[s].naam })), standaardModel: STANDAARD_MODEL,
      prijzen: prijzen.map((p) => ({ model: p.model, invoer: p.invoer_cent_mtok, uitvoer: p.uitvoer_cent_mtok, peildatum: p.peildatum })),
    }
  })
})
