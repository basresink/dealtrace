// GET /api/tasks: taken met filters (in de URL), groepen, tellers en horizon (F06).
// Standaard "Van mij"; de salesmanager kiest teamleden (alleen zijn teams, server-side).
// Met `per` (taken.vue) krijgt elke groep een eerste portie; `toon=Groep:n,...` vraagt per groep meer.
// Zonder `per` komen alle taken mee (API-gebruik en tests). De horizon rekent alleen bij weergave=horizon.
// Periode: periode=vandaag|week|achterstallig (statkaarten), periode=morgen|deze-week|volgende-week, of een eigen
// periode met van=&tot= (ISO-datums); die kijkt ook terug en neemt afgeronde taken in die periode mee.
import { and, inArray, isNull, or, sql } from 'drizzle-orm'
import { GROEPEN, groepVan, horizon, isAchterstallig, ordenTaken } from '../../../shared/taken'
import { nlMoment, nlTijdstip, plusDagen } from '../../../shared/datum'
import { inBereik, periodeBereik, taakDag } from '../../../shared/takenPeriode'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const q = getQuery(event) as Record<string, string | undefined>
  const nu = new Date()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
    const users = await tx.select({ id: schema.users.id, naam: schema.users.name, teamId: schema.users.teamId }).from(schema.users)
    const teamleden = ctx.gebruiker.rol === 'beheerder' ? users.map((u) => u.id) : users.filter((u) => u.teamId && teams.includes(u.teamId)).map((u) => u.id)
    const eigenaar = q.eigenaar ?? 'mij'
    const owners = eigenaar === 'mij' ? [ctx.gebruiker.id] : eigenaar === 'team' ? [...new Set([ctx.gebruiker.id, ...teamleden])] : teamleden.includes(eigenaar) ? [eigenaar] : [ctx.gebruiker.id]
    const bereik = periodeBereik(q, nu)
    const status = q.status === 'klaar' ? ['klaar'] : ['open', 'bezig']
    // Een eigen periode haalt ook de afgeronde taken op waarvan de dag in die periode valt.
    const dag = sql`coalesce(${schema.tasks.dueDate}, ${schema.tasks.updatedAt})`
    const afgerondInPeriode = bereik?.eigen && q.status !== 'klaar'
      ? and(sql`${schema.tasks.status} = 'klaar'`, bereik.van ? sql`${dag} >= ${nlTijdstip(bereik.van, 0).toISOString()}` : undefined, bereik.tot ? sql`${dag} < ${nlTijdstip(plusDagen(bereik.tot, 1), 0).toISOString()}` : undefined)
      : undefined
    const rijen = await tx.select().from(schema.tasks).where(and(afgerondInPeriode ? or(inArray(schema.tasks.status, status), afgerondInPeriode) : inArray(schema.tasks.status, status), or(inArray(schema.tasks.ownerId, owners), owners.includes(ctx.gebruiker.id) ? isNull(schema.tasks.ownerId) : undefined)))
    const accountIds = [...new Set(rijen.map((t) => t.accountId).filter(Boolean))] as string[]
    const accounts = accountIds.length ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, faseId: schema.accounts.faseId, reisId: schema.accounts.reisId, nbStatus: schema.accounts.nbStatus, klasse: schema.accounts.klasse }).from(schema.accounts).where(inArray(schema.accounts.id, accountIds)) : []
    const contactIds = [...new Set(rijen.map((t) => t.contactId).filter(Boolean))] as string[]
    const contacten = contactIds.length ? await tx.select({ id: schema.contacts.id, voornaam: schema.contacts.firstName, achternaam: schema.contacts.lastName }).from(schema.contacts).where(inArray(schema.contacts.id, contactIds)) : []
    const contactPer = new Map(contacten.map((c) => [c.id, `${c.voornaam ?? ''} ${c.achternaam}`.trim()]))
    const reizen = await tx.select({ id: schema.reistemplates.id, data: schema.reistemplates.data }).from(schema.reistemplates)
    const fase = (a?: typeof accounts[number]) => { const f = reizen.find((r) => r.id === a?.reisId)?.data.fases.find((x) => x.id === a?.faseId); return f ? { id: f.id, label: f.label, kleur: f.kleur } : null }
    const per = new Map(accounts.map((a) => [a.id, a]))
    const herkomst = (t: typeof rijen[number]) => { const h = (t.data as any)?.herkomst; return typeof h === 'string' ? h : h?.bron ?? (t.signalId ? 'inzicht' : t.ruleId ? 'regel' : 'handmatig') }
    let lijst = rijen.map((t) => ({
      id: t.id, title: t.title, status: t.status, actionType: t.actionType, priority: t.priority, dueDate: t.dueDate, ownerId: t.ownerId, accountId: t.accountId,
      contact: t.contactId && contactPer.has(t.contactId) ? { id: t.contactId, naam: contactPer.get(t.contactId)! } : null,
      account: t.accountId ? { id: t.accountId, naam: per.get(t.accountId)?.naam ?? null, fase: fase(per.get(t.accountId)), status: per.get(t.accountId)?.nbStatus ?? null } : null,
      herkomst: herkomst(t), poging: (t.data as any)?.poging ?? null, reeks: (t.data as any)?.reeks?.n ? { id: (t.data as any).reeks.id, n: (t.data as any).reeks.n, van: (t.data as any).reeks.van } : null, waarom: (t.data as any)?.waarom ?? null, eigenaar: users.find((u) => u.id === t.ownerId)?.naam ?? null,
      achterstallig: t.status !== 'klaar' && isAchterstallig(t, nu), groep: t.status === 'klaar' ? 'Afgerond' as const : groepVan(t, nu), aanleiding: (t.data as any)?.aanleiding ?? null,
      dag: taakDag(t),
    }))
    const v = nlMoment(nu).datum
    // De statkaarten tellen alleen open taken, ook als een eigen periode afgeronde taken meeneemt.
    const open = lijst.filter((t) => t.status !== 'klaar')
    const tellers = {
      vandaag: open.filter((t) => t.dueDate && nlMoment(new Date(t.dueDate)).datum === v).length,
      komende7: open.filter((t) => t.dueDate && nlMoment(new Date(t.dueDate)).datum > v && Date.parse(t.dueDate) <= nu.getTime() + 7 * 864e5).length,
      achterstallig: open.filter((t) => t.achterstallig).length,
      open: open.length,
    }
    // Filters
    const lijstVan = (k: string) => (q[k] ? q[k]!.split(',') : [])
    if (q.periode === 'vandaag') lijst = lijst.filter((t) => t.achterstallig || (t.dueDate && nlMoment(new Date(t.dueDate)).datum === v))
    if (q.periode === 'week') lijst = lijst.filter((t) => t.dueDate && Date.parse(t.dueDate) <= nu.getTime() + 7 * 864e5 && !t.achterstallig && nlMoment(new Date(t.dueDate)).datum > v)
    if (q.periode === 'achterstallig') lijst = lijst.filter((t) => t.achterstallig)
    if (bereik) lijst = lijst.filter((t) => inBereik(t.dag, bereik))
    if (lijstVan('prioriteit').length) lijst = lijst.filter((t) => lijstVan('prioriteit').includes(t.priority))
    if (lijstVan('actiesoort').length) lijst = lijst.filter((t) => lijstVan('actiesoort').includes(t.actionType))
    if (lijstVan('fase').length) lijst = lijst.filter((t) => t.account?.fase && lijstVan('fase').includes(t.account.fase.id))
    if (q.q) lijst = lijst.filter((t) => `${t.title} ${t.account?.naam ?? ''} ${t.contact?.naam ?? ''}`.toLowerCase().includes(q.q!.toLowerCase()))
    const geordend = ordenTaken(lijst, nu)
    const h = kan(ctx, 'taken.horizon') && q.weergave === 'horizon' ? horizon(geordend, nu) : null
    const portieGrootte = Number(q.per) > 0 ? Math.min(Number(q.per), 500) : 0
    const toon = new Map((q.toon ?? '').split(',').map((x) => x.split(':')).filter((x) => x.length === 2 && Number(x[1]) > 0).map(([g, n]) => [g!, Number(n)]))
    const portie = (g: string) => (portieGrootte ? Math.max(portieGrootte, toon.get(g) ?? 0) : Infinity)
    return {
      // Eén definitie met de statkaarten: "vandaag" is wat vandaag vervalt; over tijd staat apart in de uitleg.
      titel: tellers.vandaag ? `${tellers.vandaag} ${tellers.vandaag === 1 ? 'taak' : 'taken'} vandaag.` : tellers.achterstallig ? 'Niets nieuws voor vandaag.' : 'Niets te doen.',
      tellers,
      periode: bereik,
      groepen: [...GROEPEN, 'Afgerond' as const].map((g) => { const alle = geordend.filter((t) => t.groep === g); return { naam: g, totaal: alle.length, taken: alle.slice(0, portie(g)) } }).filter((g) => g.totaal),
      horizon: h,
      teamleden: users.filter((u) => teamleden.includes(u.id) && u.id !== ctx.gebruiker.id).map((u) => ({ id: u.id, naam: u.naam })),
      kan: { horizon: kan(ctx, 'taken.horizon'), bulk: kan(ctx, 'taken.bulk'), herhaling: kan(ctx, 'taken.herhaling'), team: ctx.gebruiker.rol === 'salesmanager' || ctx.gebruiker.rol === 'beheerder', verwijderen: ctx.gebruiker.rol === 'beheerder' },
    }
  })
})
