// POST /api/platform/werk-in/modus {modus, reden}: wisselen tussen meekijken en wijzigen.
// Naar "Ook wijzigen" vraagt herbevestiging (428) en een nieuwe reden.
import { geldigeReden, type WerkModus } from '../../../../shared/werkIn'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder, vereisHerbevestiging } from '../../../utils/platform'
import { leesWerkInInhoud, zetWerkIn } from '../../../utils/werkIn'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  if (!ctx.werkIn) throw createError({ statusCode: 409, statusMessage: 'Je werkt niet in een organisatie' })
  const b = await readBody<{ modus?: string; reden?: string }>(event)
  const modus: WerkModus = b.modus === 'wijzigen' ? 'wijzigen' : 'meekijken'
  if (!geldigeReden(b.reden)) throw createError({ statusCode: 400, statusMessage: 'Geef een reden van minstens 5 tekens' })
  if (modus === 'wijzigen') vereisHerbevestiging(ctx)
  const oud = (await leesWerkInInhoud(event))!
  const reden = b.reden.trim()
  await alsPlatform(async (tx) => {
    await platformAudit(tx, event, ctx, { organisatieId: oud.organisatieId, handeling: 'werkin.modus', object: oud.organisatieId, voor: { modus: oud.modus }, na: { modus }, reden })
    await meldBeheerders(tx, oud.organisatieId, `${ctx.gebruiker.naam} van Dealtrace wisselt naar ${modus === 'wijzigen' ? 'ook wijzigen' : 'alleen meekijken'}`, `Reden: ${reden}.`, '/instellingen/audit')
  })
  // Zelfde start: de tijdslimiet van 8 uur loopt door.
  const inhoud = await zetWerkIn(event, { founderId: ctx.gebruiker.id, organisatieId: oud.organisatieId, modus, reden, start: oud.start })
  return { modus, tot: inhoud.tot }
})
