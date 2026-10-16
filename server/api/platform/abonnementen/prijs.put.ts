// PUT /api/platform/abonnementen/prijs {pakket, prijsCent, seatCent, geldigVanaf}: een prijs als gegeven met
// geldig-vanaf (open vraag 10). 422 bij een datum in het verleden. Founder, platformaudit.
import { sql } from 'drizzle-orm'
import { PAKKETTEN } from '../../../../shared/types'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ pakket?: string; prijsCent?: number; seatCent?: number; geldigVanaf?: string }>(event)
  if (!PAKKETTEN.includes(b?.pakket as any)) throw createError({ statusCode: 422, statusMessage: 'Onbekend pakket' })
  const prijs = Number(b.prijsCent)
  const seat = Number(b.seatCent)
  if (!Number.isInteger(prijs) || prijs < 0 || !Number.isInteger(seat) || seat < 0) throw createError({ statusCode: 422, statusMessage: 'Prijzen zijn hele bedragen in centen' })
  const vanaf = String(b.geldigVanaf ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vanaf) || vanaf < new Date().toISOString().slice(0, 10)) throw createError({ statusCode: 422, statusMessage: 'Geldig vanaf is vandaag of later' })
  return alsPlatform(async (tx) => {
    await tx.execute(sql`insert into pakketprijzen (pakket, prijs_cent, seat_cent, geldig_vanaf, door) values (${b.pakket}, ${prijs}, ${seat}, ${vanaf}, ${ctx.gebruiker.id})`)
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'pakket.prijs', object: b.pakket, na: { prijsCent: prijs, seatCent: seat, geldigVanaf: vanaf } })
    return { ok: true, tekst: `De prijs van ${b.pakket} geldt vanaf ${vanaf}.` }
  })
})
