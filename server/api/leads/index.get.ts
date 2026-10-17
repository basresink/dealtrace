// GET /api/leads?ronde=&groep=: de leads van een ronde (standaard je laatste) met groep en
// bewijs, plus de afgewezen leads van die ronde met hun reden (Niet relevant, ook een eigen reden).
// Gevorderd; een Beginner alleen als "Voeg toe" (leads.overnemen) voor Beginner aanstaat.
import { desc, eq } from 'drizzle-orm'
import { GROEP_VOLGORDE, leadAfwijsTekst } from '../../../shared/leadGenerator'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { leadsVoorScherm } from '../../utils/leads'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'nav.leadgenerator') && !kan(ctx, 'leads.overnemen')) weigerFunctie('nav.leadgenerator', 'niveau')
  const q = getQuery(event)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const laatste = (eigen: boolean) => tx.select().from(schema.leadRondes).where(eigen ? eq(schema.leadRondes.gebruikerId, ctx.gebruiker.id) : undefined).orderBy(desc(schema.leadRondes.gestartOp)).limit(1)
    const [ronde] = q.ronde ? await tx.select().from(schema.leadRondes).where(eq(schema.leadRondes.id, String(q.ronde))) : (await laatste(true)).length ? await laatste(true) : await laatste(false)
    if (!ronde) return { ronde: null, zoekopdracht: null, leads: [], afgewezen: [] }
    const alle = await tx.select().from(schema.leads).where(eq(schema.leads.rondeId, ronde.id))
    const rijen = alle.filter((l) => l.status !== 'afgewezen')
    const afgewezen = alle.filter((l) => l.status === 'afgewezen').map((l) => ({
      id: l.id, naam: l.naam, plaats: l.plaats, reden: l.data.afwijsreden === 'Anders' ? 'Andere reden' : l.data.afwijsreden ?? 'Andere reden',
      toelichting: l.data.afwijsToelichting ?? null, tekst: leadAfwijsTekst(l.data), op: l.data.afgewezenOp ?? l.updatedAt,
    })).sort((a, b) => String(b.op).localeCompare(String(a.op)))
    let leads = await leadsVoorScherm(tx, rijen, ronde.zoekopdracht)
    const groep = GROEP_VOLGORDE.find((g) => g === q.groep)
    if (groep) leads = leads.filter((l) => l.groep === groep)
    return { ronde: { id: ronde.id, gestartOp: ronde.gestartOp, bronnen: ronde.bronnen, aantal: ronde.aantal, kosten: ronde.kosten }, zoekopdracht: ronde.zoekopdracht, leads, afgewezen }
  })
})
