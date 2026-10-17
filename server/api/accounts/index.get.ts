// GET /api/accounts?soort=prospect|klant&...filters&sort&pagina: rijen, tellers en
// opties. Filters en tellers rekenen op de server met shared/accountFilters.
import { and, count, inArray, isNotNull, lt, lte, max, notInArray, sql } from 'drizzle-orm'
import { actiefTellers, filterTellers, filtersUitQuery, pasFiltersToe, sorteer, type Sortering } from '../../../shared/accountFilters'
import { accountRijen, effectiefNiveau, eigenVeldenVoor, kan, primairContact } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { lopendeReeksen } from '../../utils/opvolgreeksOverzicht'
import { eigenTeams } from '../../utils/gebruikers'
import { terugkomControleLui } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'

type Tx = Parameters<Parameters<typeof metOrganisatie>[1]>[0]

const PER_PAGINA = 25
const DAG = 24 * 3600 * 1000
/** Activiteiten van het systeem tellen niet als laatste activiteit. */
const SYSTEEM_SOORTEN = ['import', 'reis', 'gedeactiveerd', 'geheractiveerd']

/**
 * Extra's voor de zichtbare rijen in drie gegroepeerde queries (geen N+1): open
 * inzichten, de laatste activiteit (zonder import en reisstappen) en hoeveel dagen de oudste open taak over tijd is.
 */
async function rijExtra(tx: Tx, ids: string[], nu: Date) {
  const leeg = { inzichten: new Map<string, number>(), activiteit: new Map<string, string>(), dagenOver: new Map<string, number>() }
  if (!ids.length) return leeg
  const inz = await tx.select({ id: schema.signals.accountId, n: count() }).from(schema.signals)
    .where(and(inArray(schema.signals.accountId, ids), inArray(schema.signals.status, ['nieuw', 'gelezen']))).groupBy(schema.signals.accountId)
  const act = await tx.select({ id: schema.activiteiten.accountId, op: max(schema.activiteiten.op) }).from(schema.activiteiten)
    .where(and(inArray(schema.activiteiten.accountId, ids), notInArray(schema.activiteiten.soort, SYSTEEM_SOORTEN), lte(schema.activiteiten.op, nu.toISOString()))).groupBy(schema.activiteiten.accountId)
  const over = await tx.select({ id: schema.tasks.accountId, op: sql<string>`min(${schema.tasks.dueDate})` }).from(schema.tasks)
    .where(and(inArray(schema.tasks.accountId, ids), inArray(schema.tasks.status, ['open', 'bezig']), isNotNull(schema.tasks.dueDate), lt(schema.tasks.dueDate, nu.toISOString())))
    .groupBy(schema.tasks.accountId)
  for (const r of inz) if (r.id) leeg.inzichten.set(r.id, Number(r.n))
  for (const r of act) if (r.id && r.op) leeg.activiteit.set(r.id, new Date(r.op).toISOString())
  for (const r of over) {
    const dagen = r.id && r.op ? Math.floor((nu.getTime() - Date.parse(r.op)) / DAG) : 0
    if (r.id && dagen >= 1) leeg.dagenOver.set(r.id, dagen)
  }
  return leeg
}

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
    const zichtbaar = resultaat.slice(0, pagina * PER_PAGINA)
    const extra = await rijExtra(tx, zichtbaar.map((r) => r.id), fctx.nu)
    // F7: de lopende opvolgreeks per zichtbare rij (stap x van y en de volgende stap).
    const reeksen = await lopendeReeksen(tx, zichtbaar.map((r) => r.id), fctx.nu)
    // Fases van alle reistemplates (standaard eerst), voor het faselabel op de rij.
    const faseLabels = new Map<string, { label: string; kleur: string | null }>()
    if (reisFilter) {
      const templates = await tx.select({ isStandaard: schema.reistemplates.isStandaard, data: schema.reistemplates.data }).from(schema.reistemplates)
      for (const t of templates.sort((a, b) => Number(b.isStandaard) - Number(a.isStandaard))) {
        for (const f of t.data.fases ?? []) if (!faseLabels.has(f.id)) faseLabels.set(f.id, { label: f.label, kleur: f.kleur ?? null })
      }
    }
    return {
      totaal: rijen.filter((r) => !r.gedeactiveerd).length,
      aantal: resultaat.length,
      rijen: zichtbaar.map((r) => {
        const actief = r.contacten.filter((c) => c.status !== 'vertrokken')
        const laatste = [extra.activiteit.get(r.id), r.laatsteContactOp].filter((t): t is string => !!t).map((t) => new Date(t).toISOString()).sort().at(-1) ?? null
        return {
          ...r,
          eigenaar: r.ownerId ? namen.get(r.ownerId) ?? null : null,
          contacten: actief.slice(0, 3),
          contactenTotaal: actief.length,
          primairContact: primairContact(actief as (typeof actief[number] & { id: string })[])?.id ?? null,
          inzichten: extra.inzichten.get(r.id) ?? 0,
          laatsteActiviteitOp: laatste,
          nextActionDagenOver: extra.dagenOver.get(r.id) ?? null,
          fase: r.faseId ? faseLabels.get(r.faseId) ?? null : null,
          reeks: reeksen.get(r.id) ?? null,
        }
      }),
      meer: resultaat.length > pagina * PER_PAGINA,
      tellers: filterTellers(rijen, filters, fctx, mogelijk),
      // 0064: het filter Status (actief, gedeactiveerd, alle) en de gekozen stand.
      actief: filters.actief ?? 'actief',
      actiefTellers: actiefTellers(rijen, filters, fctx),
      klassen,
      fases,
      eigenVelden: filterbaar.map((v) => ({ sleutel: v.sleutel, naam: v.naam, type: v.type, opties: v.data.opties ?? [] })),
      kan: { alleFilters, filterVelden, weergaven: kan(ctx, 'prospects.weergaven'), opgeslagen: kan(ctx, 'prospects.opgeslagenFilters'), export: kan(ctx, 'prospects.export'), reisFilter },
    }
  })
})
