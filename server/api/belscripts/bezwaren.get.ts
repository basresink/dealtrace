// GET /api/belscripts/bezwaren: de top 5 bezwaren van de laatste 90 dagen uit de belgesprekken,
// met het antwoord dat erbij hoort (Expert en salesmanager). Een antwoord zonder verwijzing naar
// het verhaal krijgt "geen bron in de waarde".
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { verkoopverhaal } from '../../utils/reis'
import { leesAlsDeKlantZegt } from '../../../shared/verkoopverhaal'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'belscript.beheer') && !kan(ctx, 'belscript.vergelijken')) weigerFunctie('belscript.vergelijken', 'niveau')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = (await tx.execute(sql`select z->>'bezwaar' as bezwaar, z->>'argumentRef' as ref, count(*)::int as aantal
      from activiteiten, jsonb_array_elements(coalesce(data->'script'->'bezwaren', '[]'::jsonb)) z
      where op >= ${new Date(Date.now() - 90 * 864e5).toISOString()} group by 1, 2 order by 3 desc limit 5`)).rows as { bezwaar: string; ref: string | null; aantal: number }[]
    const vv = await verkoopverhaal(tx)
    return rijen.map((r) => {
      const cc = r.ref ? vv.concurrenten.find((c) => c.id === r.ref) : undefined
      return { bezwaar: r.bezwaar, aantal: r.aantal, antwoordVoorstel: leesAlsDeKlantZegt(cc?.alsDeKlantZegt)?.antwoord ?? null, argumentRef: cc?.id ?? null, bron: cc ? `Verhaal: ${cc.naam}` : 'geen bron in de waarde' }
    })
  })
})
