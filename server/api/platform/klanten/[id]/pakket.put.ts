// PUT /api/platform/klanten/:id/pakket {pakket, bevestigd}: met wat de klant wint en
// verliest; verlagen vraagt herbevestiging binnen 15 minuten (428).
import { eq } from 'drizzle-orm'
import { isVerlaging, pakketVerschil } from '../../../../../shared/pakket'
import { PAKKETTEN, type Pakket } from '../../../../../shared/types'
import { schema } from '../../../../utils/db'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder, vereisHerbevestiging } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ pakket?: string; bevestigd?: boolean }>(event)
  const naar = b.pakket as Pakket
  if (!PAKKETTEN.includes(naar)) throw createError({ statusCode: 400, statusMessage: 'Onbekend pakket' })
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const van = o.pakket as Pakket
    const verschil = pakketVerschil(van, naar)
    if (!b.bevestigd) return { bevestigen: true, van, naar, ...verschil }
    if (isVerlaging(van, naar)) vereisHerbevestiging(ctx)
    if (van === naar) return { pakket: naar }
    await tx.update(schema.organisations).set({ pakket: naar, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'pakket.wijzigen', object: id, voor: { pakket: van }, na: { pakket: naar, ...verschil } })
    await meldBeheerders(tx, id, 'Je pakket is gewijzigd', `Je organisatie staat nu op ${naar[0]!.toUpperCase()}${naar.slice(1)}.`, '/instellingen/abonnement')
    return { pakket: naar, ...verschil }
  })
})
