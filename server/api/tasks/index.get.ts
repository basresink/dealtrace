// GET /api/tasks: taken met filters (in de URL), groepen, tellers en horizon (F06).
// Standaard "Van mij"; de salesmanager kiest teamleden (alleen zijn teams, server-side).
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { GROEPEN, groepVan, horizon, isAchterstallig, ordenTaken } from '../../../shared/taken'
import { nlMoment } from '../../../shared/datum'
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
    const status = q.status === 'klaar' ? ['klaar'] : ['open', 'bezig']
    const rijen = await tx.select().from(schema.tasks).where(and(inArray(schema.tasks.status, status), or(inArray(schema.tasks.ownerId, owners), owners.includes(ctx.gebruiker.id) ? isNull(schema.tasks.ownerId) : undefined)))
    const accountIds = [...new Set(rijen.map((t) => t.accountId).filter(Boolean))] as string[]
    const accounts = accountIds.length ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, faseId: schema.accounts.faseId, reisId: schema.accounts.reisId, nbStatus: schema.accounts.nbStatus, klasse: schema.accounts.klasse }).from(schema.accounts).where(inArray(schema.accounts.id, accountIds)) : []
    const reizen = await tx.select({ id: schema.reistemplates.id, data: schema.reistemplates.data }).from(schema.reistemplates)
    const fase = (a?: typeof accounts[number]) => { const f = reizen.find((r) => r.id === a?.reisId)?.data.fases.find((x) => x.id === a?.faseId); return f ? { id: f.id, label: f.label, kleur: f.kleur } : null }
    const per = new Map(accounts.map((a) => [a.id, a]))
    const herkomst = (t: typeof rijen[number]) => { const h = (t.data as any)?.herkomst; return typeof h === 'string' ? h : h?.bron ?? (t.signalId ? 'inzicht' : t.ruleId ? 'regel' : 'handmatig') }
    let lijst = rijen.map((t) => ({
      id: t.id, title: t.title, status: t.status, actionType: t.actionType, priority: t.priority, dueDate: t.dueDate, ownerId: t.ownerId, accountId: t.accountId,
      account: t.accountId ? { id: t.accountId, naam: per.get(t.accountId)?.naam ?? null, fase: fase(per.get(t.accountId)), status: per.get(t.accountId)?.nbStatus ?? null } : null,
      herkomst: herkomst(t), poging: (t.data as any)?.poging ?? null, waarom: (t.data as any)?.waarom ?? null, eigenaar: users.find((u) => u.id === t.ownerId)?.naam ?? null,
      achterstallig: isAchterstallig(t, nu), groep: groepVan(t, nu), aanleiding: (t.data as any)?.aanleiding ?? null,
    }))
    const v = nlMoment(nu).datum
    const tellers = {
      vandaag: lijst.filter((t) => t.dueDate && nlMoment(new Date(t.dueDate)).datum === v).length,
      komende7: lijst.filter((t) => t.dueDate && nlMoment(new Date(t.dueDate)).datum > v && Date.parse(t.dueDate) <= nu.getTime() + 7 * 864e5).length,
      achterstallig: lijst.filter((t) => t.achterstallig).length,
      open: lijst.length,
    }
    // Filters
    const lijstVan = (k: string) => (q[k] ? q[k]!.split(',') : [])
    if (q.periode === 'vandaag') lijst = lijst.filter((t) => t.achterstallig || (t.dueDate && nlMoment(new Date(t.dueDate)).datum === v))
    if (q.periode === 'week') lijst = lijst.filter((t) => t.dueDate && Date.parse(t.dueDate) <= nu.getTime() + 7 * 864e5 && !t.achterstallig && nlMoment(new Date(t.dueDate)).datum > v)
    if (q.periode === 'achterstallig') lijst = lijst.filter((t) => t.achterstallig)
    if (lijstVan('prioriteit').length) lijst = lijst.filter((t) => lijstVan('prioriteit').includes(t.priority))
    if (lijstVan('actiesoort').length) lijst = lijst.filter((t) => lijstVan('actiesoort').includes(t.actionType))
    if (lijstVan('herkomst').length) lijst = lijst.filter((t) => lijstVan('herkomst').includes(t.herkomst))
    if (lijstVan('fase').length) lijst = lijst.filter((t) => t.account?.fase && lijstVan('fase').includes(t.account.fase.id))
    if (q.q) lijst = lijst.filter((t) => `${t.title} ${t.account?.naam ?? ''}`.toLowerCase().includes(q.q!.toLowerCase()))
    const geordend = ordenTaken(lijst, nu)
    const h = kan(ctx, 'taken.horizon') ? horizon(geordend, nu) : null
    return {
      titel: tellers.vandaag + tellers.achterstallig ? `${tellers.vandaag + tellers.achterstallig} ${tellers.vandaag + tellers.achterstallig === 1 ? 'taak' : 'taken'} vandaag${tellers.achterstallig ? `, ${tellers.achterstallig} over tijd` : ''}.` : 'Niets te doen.',
      tellers,
      groepen: GROEPEN.map((g) => ({ naam: g, taken: geordend.filter((t) => t.groep === g) })).filter((g) => g.taken.length),
      horizon: h,
      teamleden: users.filter((u) => teamleden.includes(u.id) && u.id !== ctx.gebruiker.id).map((u) => ({ id: u.id, naam: u.naam })),
      kan: { horizon: kan(ctx, 'taken.horizon'), bulk: kan(ctx, 'taken.bulk'), herhaling: kan(ctx, 'taken.herhaling'), team: ctx.gebruiker.rol === 'salesmanager' || ctx.gebruiker.rol === 'beheerder', verwijderen: ctx.gebruiker.rol === 'beheerder' },
    }
  })
})
