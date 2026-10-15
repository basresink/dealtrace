// GET /api/vandaag: alle blokken van Vandaag in één antwoord (F01). De laptop (P07) en de
// telefoon (P32) gebruiken hetzelfde. Blokken zonder bron laten we weg.
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { nlMoment, plusDagen, volgendeWerkdag } from '../../shared/datum'
import { ordenTaken, isAchterstallig } from '../../shared/taken'
import { groetVoor, kiesAanleidingVanDeDag, samenvattingsregel, vandaagKicker } from '../../shared/vandaag'
import { kan } from '../utils/accounts'
import { metOrganisatie, schema } from '../utils/db'
import { eigenTeams } from '../utils/gebruikers'
import { vereisFunctie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.vandaag')
  const q = getQuery(event)
  const nu = typeof q.dag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.dag) ? new Date(`${q.dag}T08:00:00Z`) : new Date()
  const v = nlMoment(nu).datum
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const mijn = ctx.gebruiker.id
    const taken = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.ownerId, mijn), inArray(schema.tasks.status, ['open', 'bezig'])))
    const accounts = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, ownerId: schema.accounts.ownerId, nbStatus: schema.accounts.nbStatus, terugOp: schema.accounts.terugOp, vvBrancheId: schema.accounts.vvBrancheId, faseId: schema.accounts.faseId, reisId: schema.accounts.reisId, kind: schema.accounts.accountKind, data: schema.accounts.data }).from(schema.accounts)
    const per = new Map(accounts.map((a) => [a.id, a]))
    const eigen = accounts.filter((a) => a.ownerId === mijn)
    const vv = (await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'verkoopverhaal')))[0]?.value as any
    const voorrang = new Set(((vv?.branches ?? []) as any[]).filter((b) => b.focus === 'primair').map((b) => b.id))
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
    const prio: { soort: string; tekst: string; link: string }[] = []
    for (const s of signals.filter((x) => x.status === 'nieuw' && x.relevanceScore >= 75 && x.id !== aanleiding?.id).slice(0, 2)) prio.push({ soort: 'aanleiding', tekst: s.title, link: `/acties?tab=inzichten&inzicht=${s.id}` })
    for (const a of eigen.filter((x) => x.terugOp && x.terugOp <= v && ['wachtend', 'nee'].includes(x.nbStatus))) prio.push({ soort: 'terug', tekst: `${a.naam} komt vandaag terug`, link: `/accounts/${a.id}` })
    for (const t of taken.filter((x) => x.actionType !== 'taak' && /bevestig|overdr/i.test(x.title))) prio.push({ soort: 'afspraak', tekst: t.title, link: `/acties?taak=${t.id}` })

    const gevorderd = ctx.gebruiker.niveau !== 'beginner' || ctx.organisatie.iedereenAlles
    const [mij] = await tx.select({ werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, mijn))
    const werkplek = mij?.werkplek ?? 'binnendienst'
    const belTaken = vandaagEnEerder.filter((t) => t.actionType === 'bellen').length
    const bezoekTaken = vandaagEnEerder.filter((t) => t.actionType === 'bezoek').length

    // Door agents en de motor gedaan sinds gisteren.
    const gisteren = new Date(nu.getTime() - 24 * 3600_000).toISOString()
    const motorTaken = (await tx.execute(sql`select count(*)::int n from tasks where owner_id = ${mijn} and rule_id is not null and created_at >= ${gisteren}`)).rows[0] as { n: number }
    const motorInzichten = (await tx.execute(sql`select count(*)::int n from signals where owner_id = ${mijn} and created_at >= ${gisteren}`)).rows[0] as { n: number }
    const geparkeerd = (await tx.execute(sql`select count(*)::int n from reisgeschiedenis r join accounts a on a.id = r.account_id where a.owner_id = ${mijn} and r.gebeurtenis = 'geparkeerd' and r.op >= ${gisteren}`)).rows[0] as { n: number }

    // Datakwaliteit: de drie grootste gaten bij je actieve prospects.
    const actief = eigen.filter((a) => a.kind === 'prospect' && ['nieuw', 'in reis'].includes(a.nbStatus))
    const contacten = actief.length ? await tx.select({ accountId: schema.contacts.accountId, rol: schema.contacts.rol, status: schema.contacts.status, email: schema.contacts.email, data: schema.contacts.data }).from(schema.contacts).where(inArray(schema.contacts.accountId, actief.map((a) => a.id))) : []
    const cs = (id: string) => contacten.filter((c) => c.accountId === id && c.status !== 'vertrokken')
    const gaten = [
      { sleutel: 'zonderTelefoon', tekst: 'actieve prospects zonder telefoonnummer', aantal: actief.filter((a) => !a.data?.telefoon && !cs(a.id).some((c) => c.data?.telefoon || c.data?.mobiel)).length, knop: 'Verrijk' },
      { sleutel: 'zonderBeslisser', tekst: 'actieve prospects zonder beslisser', aantal: actief.filter((a) => !cs(a.id).some((c) => c.rol === 'beslisser')).length, knop: 'Maak taak' },
      { sleutel: 'zonderEmail', tekst: 'actieve prospects zonder e-mailadres', aantal: actief.filter((a) => !a.data?.email && !cs(a.id).some((c) => c.email)).length, knop: 'Verrijk' },
    ].filter((g) => g.aantal > 0).sort((a, b) => b.aantal - a.aantal).slice(0, 3)

    // Jouw week: vijf werkdagen met aantallen taken.
    const week: { datum: string; taken: number; afspraken: number; belblokken: number; regiodagen: number }[] = []
    let d = v
    for (let i = 0; i < 5; i++) {
      week.push({ datum: d, taken: taken.filter((t) => t.dueDate && nlMoment(new Date(t.dueDate)).datum === d).length, afspraken: 0, belblokken: 0, regiodagen: 0 })
      d = volgendeWerkdag(d)
    }

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
    const volgorde = ((mij?.data as any)?.vandaagVolgorde as string[] | undefined) ?? ['agents', 'datakwaliteit', 'week']
    const aanleidingAccount = aanleiding?.accountId ? per.get(aanleiding.accountId) : null
    // P10: het belblok van vandaag dat nog loopt, met zijn open gesprekken.
    const [blokVandaag] = (await tx.execute(sql`select s.id, s.start_op, (select count(*)::int from tasks t where t.belblok_id = s.id and t.status in ('open', 'bezig')) as n
      from belblok_sessies s where s.gebruiker_id = ${ctx.gebruiker.id} and s.status in ('gepland', 'bezig') and s.eind_op > now() and s.start_op < now() + interval '18 hours' order by s.start_op limit 1`)).rows as { id: string; start_op: string; n: number }[]
    return {
      kop: {
        groet: `${groetVoor(nu)}, ${ctx.gebruiker.naam.replace(/^Test(gebruiker|founder)\s+/, '').split(' ')[0]}.`,
        kicker: vandaagKicker(nu),
        samenvatting: samenvattingsregel({ taken: vandaagEnEerder.length, uitCampagnes: vandaagEnEerder.filter((t) => t.campaignId).length, volgendeKoud: volgendeKoud ? `${String(nlMoment(new Date(volgendeKoud.dueDate!)).uur).padStart(2, '0')}:${String(nlMoment(new Date(volgendeKoud.dueDate!)).minuut).padStart(2, '0')}` : null }),
      },
      aanleiding: aanleiding ? { id: aanleiding.id, titel: aanleiding.title, bron: aanleiding.bron, waarom: aanleiding.data?.waarom ?? null, bewijs: aanleiding.data?.bewijs ?? [], relevantie: aanleiding.relevanceScore, account: aanleidingAccount ? { id: aanleidingAccount.id, naam: aanleidingAccount.naam } : null } : null,
      taken: { lijst: geordend.slice(0, 8).map(taakUit), meer: Math.max(0, geordend.length - 8), totaal: geordend.length },
      afspraken: { lijst: [] as unknown[], totaal: 0 },
      prio: prio.slice(0, 4),
      werkblok: werkplek === 'buitendienst'
        ? { soort: 'bezoekdag', titel: 'BEZOEKDAG', tekst: bezoekTaken ? `${bezoekTaken} ${bezoekTaken === 1 ? 'bezoek' : 'bezoeken'} vandaag · nog geen regiodag gepland` : 'Nog geen regiodag gepland', knop: { tekst: 'Open bezoeken', naar: '/acties?actiesoort=bezoek' } }
        : blokVandaag
          ? { soort: 'belblok', titel: 'BELBLOK', tekst: `${new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(blokVandaag.start_op))} · ${blokVandaag.n} ${blokVandaag.n === 1 ? 'gesprek' : 'gesprekken'}`, knop: { tekst: 'Start belblok', naar: `/belblokken/${blokVandaag.id}` } }
          : { soort: 'belblok', titel: 'BELBLOK', tekst: belTaken ? `${belTaken} ${belTaken === 1 ? 'gesprek' : 'gesprekken'} · ongeveer ${belTaken * 8} min · nog geen belblok gepland` : 'Nog geen belblok gepland', knop: { tekst: belTaken ? 'Plan een belblok' : 'Naar belblokken', naar: '/belblokken' } },
      concepten: { aantal: taken.filter((t) => (t.data as any)?.concept).length },
      agents: gevorderd && kan(ctx, 'vandaag.agentsGedaan') ? { taken: motorTaken.n, inzichten: motorInzichten.n, geparkeerd: geparkeerd.n } : null,
      datakwaliteit: gevorderd ? gaten : null,
      week: gevorderd && kan(ctx, 'vandaag.week') ? week : null,
      team: kan(ctx, 'vandaag.team') ? team : null,
      volgorde,
      kan: { indeling: kan(ctx, 'vandaag.indeling'), nieuwProspect: kan(ctx, 'prospects.nieuw') },
    }
  })
})
