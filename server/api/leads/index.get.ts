// GET /api/leads?ronde=&groep=: de leads van een ronde (standaard je laatste) met groep en
// bewijs. Gevorderd; een Beginner alleen als "Neem over" voor Beginner aanstaat.
import { and, desc, eq, ne } from 'drizzle-orm'
import { GROEP_VOLGORDE } from '../../../shared/leadGenerator'
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
    if (!ronde) return { ronde: null, zoekopdracht: null, leads: [] }
    const rijen = await tx.select().from(schema.leads).where(and(eq(schema.leads.rondeId, ronde.id), ne(schema.leads.status, 'afgewezen')))
    let leads = await leadsVoorScherm(tx, rijen, ronde.zoekopdracht)
    const groep = GROEP_VOLGORDE.find((g) => g === q.groep)
    if (groep) leads = leads.filter((l) => l.groep === groep)
    return { ronde: { id: ronde.id, gestartOp: ronde.gestartOp, bronnen: ronde.bronnen, aantal: ronde.aantal, kosten: ronde.kosten }, zoekopdracht: ronde.zoekopdracht, leads }
  })
})
