// GET /api/accounts?soort=prospect|klant&...filters&sort&pagina: rijen, tellers en
// opties. Filters en tellers rekenen op de server met shared/accountFilters.
import { sql } from 'drizzle-orm'
import { filterTellers, filtersUitQuery, pasFiltersToe, sorteer, type Sortering } from '../../../shared/accountFilters'
import { accountRijen, effectiefNiveau, eigenVeldenVoor, kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { terugkomControleLui } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'

const PER_PAGINA = 25

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.lijst')
  const q = getQuery(event) as Record<string, any>
  const soort = q.soort === 'klant' ? 'klant' : 'prospect'
  const filters = filtersUitQuery(q)
  const alleFilters = kan(ctx, 'prospects.filtersAlle')
  const filterVelden = kan(ctx, 'eigenVelden.filteren')
  // Beginner: zoeken, klasse, status en "Van mij" (F03).
  if (!alleFilters) { filters.aanleiding = []; filters.laatsteContact = []; filters.bereikbaarheid = [] }
  if (!filterVelden) filters.cf = {}
  const reisFilter = kan(ctx, 'reis.overzicht')
  if (!reisFilter) filters.fase = []
  const niveau = effectiefNiveau(ctx)
  const sortering = (['naam', 'laatsteContact', 'score', 'klasse', 'dagenInFase'].includes(q.sort) ? q.sort : 'score') as Sortering

  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (soort === 'prospect') await terugkomControleLui(tx, ctx.organisatie.id)
    const [standaard] = reisFilter ? await tx.select().from(schema.reistemplates).where(sql`${schema.reistemplates.isStandaard}`) : []
    const fases = standaard ? standaard.data.fases.map((f) => ({ id: f.id, label: f.label, kleur: f.kleur })) : []
    const velden = await eigenVeldenVoor(tx, 'account', niveau)
    const rijen = await accountRijen(tx, soort, velden)
    const teamIds = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : ctx.gebruiker.teamId ? [ctx.gebruiker.teamId] : []
    const fctx = { gebruikerId: ctx.gebruiker.id, teamIds, nu: new Date() }
    const [klasseRij] = await tx.select().from(schema.orgSettings).where(sql`${schema.orgSettings.key} = 'klassen'`)
    const klassen = ((klasseRij?.value as any[]) ?? []).filter((k) => !k.tabblad || k.tabblad === (soort === 'klant' ? 'Klanten' : 'Prospects'))
    const filterbaar = filterVelden ? velden.filter((v) => v.data.filterbaar && ['keuzelijst', 'meerkeuze', 'janee'].includes(v.type)) : []
    const mogelijk: Record<string, string[]> = {
      status: soort === 'klant' ? ['klant'] : ['nieuw', 'in reis', 'wachtend', 'nee', 'gescoord'],
      ...(reisFilter && soort === 'prospect' ? { fase: fases.map((f) => f.id) } : {}),
      klasse: [...klassen.map((k) => k.id), 'geen'],
      ...(alleFilters ? { aanleiding: ['met'], laatsteContact: ['nooit', '30', '90'], bereikbaarheid: ['zonderTelefoon', 'zonderEmail', 'zonderBeslisser'] } : {}),
      ...Object.fromEntries(filterbaar.map((v) => [`cf.${v.sleutel}`, v.type === 'janee' ? ['ja', 'nee'] : (v.data.opties ?? []).map((o: any) => o.waarde)])),
    }
    const resultaat = sorteer(pasFiltersToe(rijen, filters, fctx), sortering, klassen.map((k) => k.id))
    const pagina = Math.max(1, Number(q.pagina) || 1)
    const namen = new Map((await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users)).map((u) => [u.id, u.naam]))
    return {
      totaal: rijen.length,
      aantal: resultaat.length,
      rijen: resultaat.slice(0, pagina * PER_PAGINA).map((r) => ({ ...r, eigenaar: r.ownerId ? namen.get(r.ownerId) ?? null : null, contacten: r.contacten.filter((c) => c.status !== 'vertrokken').slice(0, 3) })),
      meer: resultaat.length > pagina * PER_PAGINA,
      tellers: filterTellers(rijen, filters, fctx, mogelijk),
      klassen,
      fases,
      eigenVelden: filterbaar.map((v) => ({ sleutel: v.sleutel, naam: v.naam, type: v.type, opties: v.data.opties ?? [] })),
      kan: { alleFilters, filterVelden, weergaven: kan(ctx, 'prospects.weergaven'), opgeslagen: kan(ctx, 'prospects.opgeslagenFilters'), export: kan(ctx, 'prospects.export'), reisFilter },
    }
  })
})
