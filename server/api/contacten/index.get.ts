// GET /api/contacten?q&rol&soort&mijn&bereikbaarheid&laatsteContact&toestemming&sort&pagina: de contactlijst (F04).
// Oude parameters (zonderEmail, zonderTelefoon, geenContact, top, limiet) blijven werken.
// Levert ook de tellers per filterwaarde (meerekenend), het totaal, de stand per rol en per
// zichtbare rij open inzichten en laatste activiteit van het account. Vijf queries, geen N+1.
import { CONTACT_SORTERINGEN, contactFiltersUitQuery, contactTellers, pasContactFiltersToe, sorteerContacten } from '../../../shared/contactFilters'
import { effectiefNiveau, eigenVeldenVoor, kan } from '../../utils/accounts'
import { contactExtra, contactRijen, laatsteActiviteit } from '../../utils/contactLijst'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const PER_PAGINA = 50

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const q = getQuery(event) as Record<string, string>
  const filters = kan(ctx, 'contacten.filters')
  const f = contactFiltersUitQuery(q)
  // Beginner: zoeken, rol, prospects of klanten en "Van mijn accounts" (F04).
  if (!filters) { f.bereikbaarheid = []; f.laatsteContact = []; f.toestemming = [] }
  const sort = (CONTACT_SORTERINGEN as readonly string[]).includes(q.sort ?? '') ? q.sort! : 'rol'
  const fctx = { gebruikerId: ctx.gebruiker.id, nu: new Date() }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
    const alle = await contactRijen(tx, velden)
    let lijst = alle
    if (q.top === '1') {
      // Oude top-variant: beslissers en beïnvloeders van je eigen accounts op score.
      lijst = alle.filter((c) => c.status === 'actief' && ['beslisser', 'beinvloeder'].includes(c.rol) && c.eigenaarId === ctx.gebruiker.id).sort((a, b) => b.score - a.score).slice(0, 12)
    } else lijst = pasContactFiltersToe(alle, f, fctx)
    const extra = await contactExtra(tx, lijst.map((c) => c.accountId), fctx.nu)
    const verrijkt = lijst.map((c) => ({ ...c, inzichten: extra.inzichten.get(c.accountId) ?? 0, laatsteActiviteitOp: laatsteActiviteit(extra.activiteit.get(c.accountId), c.laatsteContactOp) }))
    const gesorteerd = q.top === '1' ? verrijkt : sorteerContacten(verrijkt, sort)
    const pagina = Math.max(1, Number(q.pagina) || 1)
    const limiet = Number(q.limiet) || (q.pagina ? pagina * PER_PAGINA : 200)
    return {
      contacten: gesorteerd.slice(0, limiet),
      aantal: gesorteerd.length,
      meer: gesorteerd.length > limiet,
      totaal: alle.length,
      stand: {
        beslissers: lijst.filter((c) => c.rol === 'beslisser').length,
        champions: lijst.filter((c) => c.rol === 'champion').length,
        beinvloeders: lijst.filter((c) => c.rol === 'beinvloeder').length,
        accounts: new Set(lijst.map((c) => c.accountId)).size,
      },
      tellers: contactTellers(alle, f, fctx),
      sort,
      kan: { filters, weergaven: kan(ctx, 'prospects.weergaven'), export: kan(ctx, 'prospects.export'), verhuizen: kan(ctx, 'contacten.verhuizen') },
    }
  })
})
