// GET /api/platform/credits: per organisatie pot, verbruik, extra en open aanvragen; prijzen en credits per pakket.
// Alleen tellingen, nooit de inhoud van gesprekken (F23). 404 zonder founderrol.
import { sql } from 'drizzle-orm'
import { AI_SOORT, AI_SOORTEN, POT_PER_GEBRUIKER } from '../../../../shared/credits'
import { platformCredits } from '../../../utils/credits'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const orgs = (await tx.execute(sql`select * from dealtrace_platform_credits()`)).rows as any[]
    const { prijzen, perGebruiker } = await platformCredits(tx)
    return {
      organisaties: orgs.filter((o) => o.organisation_id !== 'org-dealtrace').map((o) => ({ id: o.organisation_id, naam: o.naam, pakket: o.pakket, maand: o.maand, toegekend: o.toegekend, extra: o.extra, verbruikt: o.verbruikt, openAanvragen: o.open_aanvragen, chats: o.chats })),
      prijzen: AI_SOORTEN.map((s) => ({ soort: s, naam: AI_SOORT[s].naam, standaard: AI_SOORT[s].credits, credits: prijzen[s] ?? AI_SOORT[s].credits })),
      pakketten: Object.entries(POT_PER_GEBRUIKER).map(([p, standaard]) => ({ pakket: p, standaard, perGebruiker: perGebruiker[p as keyof typeof perGebruiker] ?? standaard })),
    }
  })
})
