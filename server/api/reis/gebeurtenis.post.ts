// POST /api/reis/gebeurtenis {accountId, gebeurtenis, reden?, faseId?}: het meldpunt (F05).
// De enige plek waar fases veranderen. "handmatig" (Fase corrigeren) vraagt een reden
// en vanaf Gevorderd; "gekwalificeerd" is de knop Kwalificeer. Instap (import,
// lead overgenomen) meldt de aanmaker zelf, niet de client.
import { isGebeurtenis } from '../../../shared/nbStatus'
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { alsHttpFout, meldGebeurtenis } from '../../utils/reis'
import { vereisFunctie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.zien')
  const b = await readBody<{ accountId?: string; gebeurtenis?: string; reden?: string; faseId?: string }>(event)
  if (!b?.accountId) throw createError({ statusCode: 422, statusMessage: 'accountId ontbreekt' })
  if (!isGebeurtenis(b.gebeurtenis)) throw createError({ statusCode: 422, statusMessage: 'Onbekende gebeurtenis' })
  if (b.gebeurtenis === 'import' || b.gebeurtenis === 'lead-overgenomen') throw createError({ statusCode: 422, statusMessage: 'Instap meldt de import of de leadgenerator zelf' })
  if (b.gebeurtenis === 'handmatig') {
    if (!kan(ctx, 'reis.faseCorrigeren')) weigerFunctie('reis.faseCorrigeren', 'niveau')
    if (!b.reden?.trim()) throw createError({ statusCode: 422, statusMessage: 'Geef een reden bij Fase corrigeren' })
  }
  if (b.gebeurtenis === 'gekwalificeerd' && !kan(ctx, 'reis.kwalificeer')) weigerFunctie('reis.kwalificeer', 'niveau')
  return metOrganisatie(ctx.organisatie.id, (tx) => meldGebeurtenis(tx, {
    accountId: b.accountId!, gebeurtenis: b.gebeurtenis as any, reden: b.reden?.trim().slice(0, 500) || null, naarFaseId: b.faseId,
    door: ctx.gebruiker.id, context: { rol: ctx.gebruiker.werkplek ?? null },
  }).catch(alsHttpFout))
})
