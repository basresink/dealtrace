// PUT /api/accounts/:id/band {letter, ja, bron?}: één BAND-letter zetten. Bij minimaal
// 3 van 4 en status nieuw meldt Dealtrace `gekwalificeerd` (zoals de knop Kwalificeer).
import { eq } from 'drizzle-orm'
import { BAND_LETTERS, bandGekwalificeerd, type Band } from '../../../../shared/bandKwalificatie'
import { metOrganisatie, schema } from '../../../utils/db'
import { alsHttpFout, meldGebeurtenis } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.kwalificeer')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ letter?: string; ja?: boolean; bron?: string }>(event)
  if (!(BAND_LETTERS as readonly string[]).includes(b?.letter ?? '')) throw createError({ statusCode: 422, statusMessage: 'Kies behoefte, autoriteit, noodzaak of draagvlak' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const band: Band = { ...(a.data?.band ?? {}), [b.letter!]: { ja: !!b.ja, bron: b.bron?.slice(0, 200) || 'hand', op: new Date().toISOString() } }
    await tx.update(schema.accounts).set({ data: { ...(a.data ?? {}), band }, updatedAt: new Date().toISOString() }).where(eq(schema.accounts.id, id))
    let gemeld = null
    if (bandGekwalificeerd(band) && a.nbStatus === 'nieuw' && a.accountKind === 'prospect') {
      gemeld = await meldGebeurtenis(tx, { accountId: id, gebeurtenis: 'gekwalificeerd', door: ctx.gebruiker.id, reden: 'BAND minimaal 3 van 4' }).catch(alsHttpFout)
    }
    return { band, gemeld }
  })
})
