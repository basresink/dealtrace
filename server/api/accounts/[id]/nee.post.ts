// POST /api/accounts/:id/nee {reden, toelichting?, verlorenAan?, terugOp?, afkoeling?}: "Zet nee"
// (7.2, F03). Reden uit de vaste lijst; bij "Anders" is een toelichting verplicht.
// De terugkomdatum volgt de terugkomregel en valt nooit binnen de afkoelperiode.
import { isNeeReden } from '../../../../shared/nbStatus'
import { terugkomTekst } from '../../../../shared/verkoopverhaal'
import { metOrganisatie } from '../../../utils/db'
import { alsHttpFout, zetNee } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'account.nee')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ reden?: string; toelichting?: string; verlorenAan?: string; terugOp?: string; afkoeling?: Record<string, number> }>(event)
  if (!isNeeReden(b?.reden)) throw createError({ statusCode: 422, statusMessage: 'Kies een reden voor nee' })
  if (b.reden === 'Anders' && !b.toelichting?.trim()) throw createError({ statusCode: 422, statusMessage: 'Geef een toelichting bij "Anders"' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = await zetNee(tx, id, { reden: b.reden!, toelichting: b.toelichting?.trim(), verlorenAan: b.verlorenAan || null, terugOp: b.terugOp, afkoeling: b.afkoeling }, ctx.gebruiker.id).catch(alsHttpFout)
    return { ...r, tekst: terugkomTekst(r.terugOp, r.regel) }
  })
})
