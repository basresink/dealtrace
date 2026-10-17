// POST /api/regels/:id/droogloop {regel?}: wat de regel (of de versie in bewerking) nu
// zou doen. Meer dan 50 taken voor één persoon zet vraagtBevestiging. Met de geraakte accounts
// (hooguit 25), wie de taak krijgt en met welk winpunt als gespreksonderwerp.
import { eq } from 'drizzle-orm'
import { droogloop, type MotorAccount } from '../../../../shared/regelPatronen'
import { eigenaarVoor } from '../../../../shared/motor'
import { metOrganisatie, schema } from '../../../utils/db'
import { laadMotorInvoer, regelUitRij } from '../../../utils/motor'
import { magRegelsLezen, schoonRegel } from '../../../utils/regels'
import { vereisOrganisatie, weigerFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!magRegelsLezen(ctx)) weigerFunctie('regels.lezen', 'niveau')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event).catch(() => ({}))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [rij] = await tx.select().from(schema.activityRules).where(eq(schema.activityRules.id, id))
    if (!rij) throw createError({ statusCode: 404, statusMessage: 'Regel onbekend' })
    const oud = regelUitRij(rij)
    const regel = b?.regel ? { ...schoonRegel(b.regel, oud), id: oud.id, scope: oud.scope, eigenaarId: oud.eigenaarId, teamId: oud.teamId } : oud
    const { invoer } = await laadMotorInvoer(tx, ctx.organisatie.id, new Date())
    // B05: dezelfde poort als de motor (lopend ritme, matrix en cadans per klasse, nooit twee ritmes).
    const eigenaar = (a: MotorAccount) => eigenaarVoor(a, regel, invoer.gebruikers, invoer.beheerderId)
    const d = droogloop(regel, invoer.accounts, invoer.nu, { laatst: invoer.laatst, open: invoer.open }, eigenaar, { belmatrix: invoer.belmatrix, afspraakmatrix: invoer.afspraakmatrix, ritmeVan: invoer.ritmeVan }, invoer.winpunten)
    const namen = new Map(invoer.gebruikers.map((g) => [g.id, g.naam]))
    const winpunt = new Map((invoer.winpunten ?? []).map((w) => [w.id, w.titel]))
    return {
      ...d, perPersoon: Object.entries(d.perPersoon).map(([id, n]) => ({ id, naam: namen.get(id) ?? id, taken: n })).sort((a, b) => b.taken - a.taken),
      accounts: d.accounts.slice(0, 25).map((a) => ({ id: a.id, naam: a.naam, eigenaar: a.ownerId ? namen.get(a.ownerId) ?? null : null, reden: a.reden, maaktTaak: a.maaktTaak, winpunt: a.winpuntId ? winpunt.get(a.winpuntId) ?? null : null })),
      meerAccounts: Math.max(0, d.accounts.length - 25),
    }
  })
})
