// PUT /api/platform/credits/prijzen {soort, credits, geldigVanaf?}: de prijs per handeling met geldig-vanaf
// (standaard vandaag), zonder release. creditsVoor rekent vanaf die datum met de nieuwe prijs; een boeking
// van eerder houdt haar prijs. Founder met herbevestiging, platformaudit.
import { sql } from 'drizzle-orm'
import { AI_SOORTEN } from '../../../../shared/credits'
import { alsPlatform, platformAudit, requireFounder, vereisHerbevestiging } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ soort?: string; credits?: number; geldigVanaf?: string }>(event)
  if (!(AI_SOORTEN as readonly string[]).includes(b?.soort ?? '')) throw createError({ statusCode: 422, statusMessage: 'Onbekende AI-soort' })
  const credits = Number(b!.credits)
  if (!Number.isInteger(credits) || credits < 0 || credits > 1000) throw createError({ statusCode: 422, statusMessage: 'Een prijs is een heel getal van 0 tot 1000' })
  const vandaag = new Date().toISOString().slice(0, 10)
  const vanaf = b.geldigVanaf || vandaag
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vanaf) || vanaf < vandaag) throw createError({ statusCode: 422, statusMessage: 'Geldig vanaf is vandaag of later' })
  vereisHerbevestiging(ctx)
  return alsPlatform(async (tx) => {
    await tx.execute(sql`insert into credit_prijzen (soort, credits, geldig_vanaf, door) values (${b!.soort}, ${credits}, ${vanaf}, ${ctx.gebruiker.id})`)
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'credits.prijs', object: b!.soort, na: { credits, geldigVanaf: vanaf } })
    return { soort: b!.soort, credits, geldigVanaf: vanaf, tekst: `Vanaf ${vanaf} kost dit ${credits} ${credits === 1 ? 'credit' : 'credits'}.` }
  })
})
