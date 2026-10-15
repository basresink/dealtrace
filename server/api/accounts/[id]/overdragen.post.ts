// POST /api/accounts/:id/overdragen {naar, naarGebruikerId?, ontvanger?, vervolgstap, alsNieuweKansBijKlant?,
// idempotentieSleutel}: de overdracht in één transactie (gat 1); daarna, los daarvan, het versturen naar
// DealDrive. 409 als er al een overdracht loopt (of al_klant); 422 zonder gehouden eerste afspraak met vervolg.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { draagOver, magAccount, overdrachtUit, verstuurOverdracht } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'overdracht.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  const org = ctx.organisatie.id
  const r = await metOrganisatie(org, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is van een collega buiten je team' })
    return draagOver(tx, org, { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, email: ctx.gebruiker.email }, id, {
      naar: b?.naar, naarGebruikerId: b?.naarGebruikerId ?? null, ontvanger: typeof b?.ontvanger === 'string' ? b.ontvanger.trim() || null : null,
      vervolgstap: { omschrijving: String(b?.vervolgstap?.omschrijving ?? ''), datum: b?.vervolgstap?.datum ?? null, soort: b?.vervolgstap?.soort ?? null },
      alsNieuweKansBijKlant: !!b?.alsNieuweKansBijKlant, sleutel: typeof b?.idempotentieSleutel === 'string' ? b.idempotentieSleutel : null,
    })
  })
  // Versturen is een aparte stap: een storing bij DealDrive draait de overdracht niet terug.
  if (r.naar === 'dealdrive' && r.status === 'klaar') {
    const uitkomst = await metOrganisatie(org, (tx) => verstuurOverdracht(tx, r.id)).catch(() => null)
    const na = await metOrganisatie(org, async (tx) => overdrachtUit(((await tx.execute(sql`select * from overdrachten where id = ${r.id}`)).rows as any[])[0]))
    if (uitkomst === 'al_klant') return { ...na, tekst: 'Dit bedrijf is al klant in DealDrive. Overdragen als nieuwe kans bij een bestaande klant?' }
    return { ...r, ...na }
  }
  return r
})
