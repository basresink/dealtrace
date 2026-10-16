// GET /api/vandaag: alle blokken van Vandaag in één antwoord (F01). De laptop (P07) en de
// telefoon (P32) gebruiken hetzelfde. Blokken zonder bron laten we weg. Het dashboard en de AI-blokken
// komen uit /api/vandaag/dashboard.
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { nlMoment, plusDagen } from '../../../shared/datum'
import { ordenTaken, isAchterstallig } from '../../../shared/taken'
import { groetVoor, kiesAanleidingVanDeDag, samenvattingsregel, vandaagKicker } from '../../../shared/vandaag'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { vereisFunctie } from '../../utils/sessie'
import { telefoonDag } from '../../utils/dagritme'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.vandaag')
  const q = getQuery(event)
  if (q.dag !== undefined && (typeof q.dag !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(q.dag) || Number.isNaN(Date.parse(q.dag)))) throw createError({ statusCode: 400, statusMessage: 'Ongeldige datum' })
  const echtNu = new Date()
  const dag = typeof q.dag === 'string' ? q.dag : nlMoment(echtNu).datum
  const isVandaag = dag === nlMoment(echtNu).datum
  // De laptop rekent (zoals in P07) vanaf de gekozen dag; de telefoon met het echte nu en de dag uit de URL.
  const nu = isVandaag ? echtNu : new Date(`${dag}T08:00:00Z`)
  const v = nlMoment(nu).datum
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const mijn = ctx.gebruiker.id
    const taken = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.ownerId, mijn), inArray(schema.tasks.status, ['open', 'bezig'])))
    const accounts = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, ownerId: schema.accounts.ownerId, nbStatus: schema.accounts.nbStatus, terugOp: schema.accounts.terugOp, vvBrancheId: schema.accounts.vvBrancheId, faseId: schema.accounts.faseId, reisId: schema.accounts.reisId, kind: schema.accounts.accountKind, data: schema.accounts.data }).from(schema.accounts)
    const per = new Map(accounts.map((a) => [a.id, a]))
    const eigen = accounts.filter((a) => a.ownerId === mijn)
    // Alleen de primaire branches (voorrang); niet het hele verkoopverhaal, dat zijn tien leesvragen.
    const voorrang = new Set(((await tx.execute(sql`select extern_id as id from vv_branches where actief and focus = 'primair'`)).rows as { id: string }[]).map((b) => b.id))
    const reizen = await tx.select({ id: schema.reistemplates.id, data: schema.reistemplates.data }).from(schema.reistemplates)
    const fase = (a?: typeof accounts[number]) => { const f = reizen.find((r) => r.id === a?.reisId)?.data.fases.find((x) => x.id === a?.faseId); return f ? { label: f.label, kleur: f.kleur } : null }

    // Taken: maximaal 8, achterstallig eerst; accounts in een primaire branche krijgen voorrang.
    const vandaagEnEerder = taken.filter((t) => !t.dueDate || nlMoment(new Date(t.dueDate)).datum <= v)
    const geordend = ordenTaken(vandaagEnEerder, nu).sort((a, b) => {
      const ach = Number(isAchterstallig(b, nu)) - Number(isAchterstallig(a, nu))
      if (ach) return ach
      return Number(voorrang.has(per.get(b.accountId ?? '')?.vvBrancheId ?? '')) - Number(voorrang.has(per.get(a.accountId ?? '')?.vvBrancheId ?? ''))
    })
    const taakUit = (t: typeof taken[number]) => ({
      id: t.id, title: t.title, actionType: t.actionType, priority: t.priority, dueDate: t.dueDate, achterstallig: isAchterstallig(t, nu),
      account: t.accountId ? { id: t.accountId, naam: per.get(t.accountId)?.naam ?? null, fase: fase(per.get(t.accountId)) } : null,
      poging: (t.data as any)?.poging ?? null, waarom: (t.data as any)?.waarom ?? null, concept: !!(t.data as any)?.concept, campagne: !!t.campaignId,
    })

    // Inzichten: aanleiding van de dag en prio.
    const signals = await tx.select().from(schema.signals).where(and(eq(schema.signals.ownerId, mijn), inArray(schema.signals.status, ['nieuw', 'gelezen'])))
    const aanleiding = kiesAanleidingVanDeDag(signals.map((s) => ({ ...s, createdAt: s.createdAt })), mijn, new Set(eigen.map((a) => a.id)), nu)
    // Prio (DealDrive-opzet): per regel de naam, de reden en een label; tekst en link blijven voor de telefoon.
    type Prio = { soort: string; tekst: string; link: string; naam: string; reden: string; label: string; labelSoort: 'hot' | 'risico' | 'info' }
    const prio: Prio[] = []
    for (const s of signals.filter((x) => x.status === 'nieuw' && x.relevanceScore >= 75 && x.id !== aanleiding?.id).slice(0, 2)) prio.push({ soort: 'aanleiding', tekst: s.title, link: `/acties?tab=inzichten&inzicht=${s.id}`, naam: (s.accountId && per.get(s.accountId)?.naam) || s.title, reden: s.accountId ? s.title : (s.data?.waarom ?? ''), label: s.relevanceScore >= 85 ? 'Hot' : 'Aanleiding', labelSoort: 'hot' })
    for (const a of eigen.filter((x) => x.terugOp && x.terugOp <= v && ['wachtend', 'nee'].includes(x.nbStatus))) prio.push({ soort: 'terug', tekst: `${a.naam} komt vandaag terug`, link: `/accounts/${a.id}`, naam: a.naam, reden: 'Komt vandaag terug uit de wachtstand', label: 'Terug', labelSoort: 'info' })
    for (const t of taken.filter((x) => x.actionType !== 'taak' && /bevestig|overdr/i.test(x.title))) prio.push({ soort: 'afspraak', tekst: t.title, link: `/acties?taak=${t.id}`, naam: (t.accountId && per.get(t.accountId)?.naam) || t.title, reden: t.title, label: 'Afspraak', labelSoort: 'risico' })
    for (const t of taken.filter((x) => isAchterstallig(x, nu) && x.priority === 'hoog' && !prio.some((p) => p.link === `/acties?taak=${x.id}`)).slice(0, 2)) prio.push({ soort: 'achter', tekst: t.title, link: `/acties?taak=${t.id}`, naam: (t.accountId && per.get(t.accountId)?.naam) || t.title, reden: t.title, label: 'Risico', labelSoort: 'risico' })

    // Inzichten bij prospects in de laatste 48 uur (eigen accounts), hoogste relevantie eerst, één per account.
    const grens48 = new Date(nu.getTime() - 48 * 3600_000).toISOString()
    const prospectSignalen = signals
      .filter((s) => s.id !== aanleiding?.id && s.accountId && per.get(s.accountId)?.kind === 'prospect' && s.createdAt >= grens48)
      .sort((a, b) => b.relevanceScore - a.relevanceScore || b.createdAt.localeCompare(a.createdAt))
      .filter((s, i, l) => l.findIndex((x) => x.accountId === s.accountId) === i).slice(0, 6)
      .map((s) => ({ id: s.id, titel: s.title, tekst: s.data?.waarom ?? null, bron: s.bron, bronNaam: (s.data as any)?.specifiekeBron ?? (s.agent ? s.agent[0]!.toUpperCase() + s.agent.slice(1) : s.bron === 'extern' ? 'Extern' : 'Intern'), op: s.createdAt, relevantie: s.relevanceScore, type: s.type, account: { id: s.accountId!, naam: per.get(s.accountId!)?.naam ?? '' } }))

    const [mij] = await tx.select({ werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, mijn))
    const werkplek = mij?.werkplek ?? 'binnendienst'
    const belTaken = vandaagEnEerder.filter((t) => t.actionType === 'bellen').length
    const bezoekTaken = vandaagEnEerder.filter((t) => t.actionType === 'bezoek').length

    // Team vandaag (salesmanager): wie loopt achter, wat wacht op goedkeuring.
    let team: { naam: string; open: number; achterstallig: number; inzichten: number }[] | null = null
    if (ctx.gebruiker.rol === 'salesmanager' || ctx.gebruiker.rol === 'beheerder') {
      const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, mijn) : null
      const leden = (await tx.select({ id: schema.users.id, naam: schema.users.name, teamId: schema.users.teamId, status: schema.users.status }).from(schema.users))
        .filter((u) => u.id !== mijn && u.status !== 'gearchiveerd' && (!teams || (u.teamId && teams.includes(u.teamId))))
      const open = leden.length ? await tx.select({ ownerId: schema.tasks.ownerId, dueDate: schema.tasks.dueDate }).from(schema.tasks).where(and(inArray(schema.tasks.ownerId, leden.map((l) => l.id)), inArray(schema.tasks.status, ['open', 'bezig']))) : []
      const wacht = leden.length ? await tx.select({ ownerId: schema.signals.ownerId }).from(schema.signals).where(and(inArray(schema.signals.ownerId, leden.map((l) => l.id)), eq(schema.signals.status, 'nieuw'), gte(schema.signals.createdAt, plusDagen(v, -14)))) : []
      team = leden.map((l) => ({ naam: l.naam, open: open.filter((t) => t.ownerId === l.id).length, achterstallig: open.filter((t) => t.ownerId === l.id && isAchterstallig(t, nu)).length, inzichten: wacht.filter((s) => s.ownerId === l.id).length }))
        .sort((a, b) => b.achterstallig - a.achterstallig)
    }

    const volgendeKoud = geordend.find((t) => t.actionType === 'bellen' && t.dueDate && Date.parse(t.dueDate) >= nu.getTime())
    const aanleidingAccount = aanleiding?.accountId ? per.get(aanleiding.accountId) : null
    // P10: het belblok van vandaag dat nog loopt, met zijn open gesprekken.
    // P32: de telefoonweergave uit dezelfde rekenkern; de laptop leest er de focusregel uit.
    const niveau = (ctx.organisatie.iedereenAlles ? 'expert' : ctx.gebruiker.niveau) as 'beginner' | 'gevorderd' | 'expert'
    const tel = await telefoonDag(tx, { id: mijn, werkplek, niveau }, dag, echtNu)
    const [blokVandaag] = (await tx.execute(sql`select s.id, s.start_op, (select count(*)::int from tasks t where t.belblok_id = s.id and t.status in ('open', 'bezig')) as n
      from belblok_sessies s where s.gebruiker_id = ${ctx.gebruiker.id} and s.status in ('gepland', 'bezig') and s.eind_op > now() and s.start_op < now() + interval '18 hours' order by s.start_op limit 1`)).rows as { id: string; start_op: string; n: number }[]
    return {
      kop: {
        groet: `${groetVoor(nu)}, ${ctx.gebruiker.naam.replace(/^Test(gebruiker|founder)\s+/, '').split(' ')[0]}.`,
        kicker: vandaagKicker(nu),
        samenvatting: samenvattingsregel({ taken: vandaagEnEerder.length, uitCampagnes: vandaagEnEerder.filter((t) => t.campaignId).length, volgendeKoud: volgendeKoud ? `${String(nlMoment(new Date(volgendeKoud.dueDate!)).uur).padStart(2, '0')}:${String(nlMoment(new Date(volgendeKoud.dueDate!)).minuut).padStart(2, '0')}` : null }),
      },
      aanleiding: aanleiding ? { id: aanleiding.id, titel: aanleiding.title, bron: aanleiding.bron, bronNaam: (aanleiding.data as any)?.specifiekeBron ?? (aanleiding.agent ? aanleiding.agent[0]!.toUpperCase() + aanleiding.agent.slice(1) : aanleiding.bron === 'extern' ? 'Extern' : 'Intern'), op: aanleiding.createdAt, waarom: aanleiding.data?.waarom ?? null, bewijs: aanleiding.data?.bewijs ?? [], relevantie: aanleiding.relevanceScore, account: aanleidingAccount ? { id: aanleidingAccount.id, naam: aanleidingAccount.naam } : null } : null,
      prospectSignalen,
      taken: { lijst: geordend.slice(0, 8).map(taakUit), meer: Math.max(0, geordend.length - 8), totaal: geordend.length },
      afspraken: { lijst: [] as unknown[], totaal: 0 },
      prio: prio.slice(0, 4),
      werkblok: werkplek === 'buitendienst'
        ? { soort: 'bezoekdag', titel: 'BEZOEKDAG', tekst: bezoekTaken ? `${bezoekTaken} ${bezoekTaken === 1 ? 'bezoek' : 'bezoeken'} vandaag · nog geen regiodag gepland` : 'Nog geen regiodag gepland', knop: { tekst: 'Open bezoeken', naar: '/acties?actiesoort=bezoek' } }
        : blokVandaag
          ? { soort: 'belblok', titel: 'BELBLOK', tekst: `${new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(blokVandaag.start_op))} · ${blokVandaag.n} ${blokVandaag.n === 1 ? 'gesprek' : 'gesprekken'}`, knop: { tekst: 'Start belblok', naar: `/belblokken/${blokVandaag.id}` } }
          : { soort: 'belblok', titel: 'BELBLOK', tekst: belTaken ? `${belTaken} ${belTaken === 1 ? 'gesprek' : 'gesprekken'} · ongeveer ${belTaken * 8} min · nog geen belblok gepland` : 'Nog geen belblok gepland', knop: { tekst: belTaken ? 'Plan een belblok' : 'Naar belblokken', naar: '/belblokken' } },
      team: kan(ctx, 'vandaag.team') ? team : null,
      kan: { nieuwProspect: kan(ctx, 'prospects.nieuw'), voorlezen: kan(ctx, 'vandaag.voorlezen'), week: kan(ctx, 'vandaag.dagkiezerWeek') },
      telefoon: { ...tel, vandaag: nlMoment(echtNu).datum, groet: `${groetVoor(echtNu)}, ${ctx.gebruiker.naam.replace(/^Test(gebruiker|founder)\s+/, '').split(' ')[0]}.`, werkplek, niveau },
    }
  })
})
