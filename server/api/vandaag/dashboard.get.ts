// GET /api/vandaag/dashboard: het dashboard onder het Vandaag-paneel ("Jouw resultaten · deze maand") en de
// twee AI-blokken eronder (Klaargezet door AI, Door AI agents gedaan). Apart van /api/vandaag zodat de dag
// zelf niet op deze cijfers wacht. Vier databasevragen: activiteiten, één telvraag, concepten en de tijdlijn.
// Cijfers volgen Mijn resultaten (shared/team: kpi en tempo); de prospectdekking volgt de funnelfilters.
import { sql } from 'drizzle-orm'
import { nlMoment, nlTijdstip, plusDagen } from '../../../shared/datum'
import { kpi, NORMEN, periodeVoor, tempo, type KpiActiviteit } from '../../../shared/team'
import { agentTellers, dashboardKop, type AgentGebeurtenis } from '../../../shared/vandaag'
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

type Rij = Record<string, any>
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const AGENT: Record<string, string> = { waarnemer: 'Waarnemer', verrijker: 'Verrijker', zoeker: 'Zoeker', schrijver: 'Schrijver', planner: 'Planner', notulist: 'Notulist', verzender: 'Verzender', profielbouwer: 'Profielbouwer', motor: 'Motor', bewaker: 'Bewaker' }
const agentNaam = (a: string | null | undefined) => (a ? AGENT[a] ?? a[0]!.toUpperCase() + a.slice(1) : 'Motor')
const HANDELING: Record<string, string> = {
  'taken.landen': 'Zette taken in je agenda', 'ai:concept': 'Schreef een concept', 'pitstop:mail': 'Schreef een opvolgmail', 'ai:belscript': 'Schreef een belscript',
  'ai:dossier': 'Ververste het dossier', 'ai:zoekronde': 'Draaide een zoekronde', 'bellen plannen': 'bellen plannen', 'bezoek plannen': 'een bezoek plannen',
}

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.vandaag')
  const nu = new Date()
  const vandaag = nlMoment(nu).datum
  const week = periodeVoor('week', vandaag)
  const maand = periodeVoor('maand', vandaag)
  const van = week.van < maand.van ? week.van : maand.van
  const vanTijd = nlTijdstip(van, 0).toISOString()
  const maandTijd = nlTijdstip(maand.van, 0).toISOString()
  const zeven = new Date(nu.getTime() - 7 * 864e5).toISOString()
  const gisteren = new Date(nu.getTime() - 24 * 3600_000).toISOString()
  const dertig = new Date(nu.getTime() - 30 * 864e5).toISOString()
  const mijn = ctx.gebruiker.id
  const magCijfers = kan(ctx, 'nav.resultaten')
  const magDekking = kan(ctx, 'funnel.filters')
  const magConcepten = kan(ctx, 'concepten.inbox')
  const gevorderd = ctx.gebruiker.niveau !== 'beginner' || ctx.organisatie.iedereenAlles
  const magAgents = gevorderd && kan(ctx, 'vandaag.agentsGedaan')

  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = async (q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

    let cijfers = null
    if (magCijfers) {
      // Activiteiten van deze week en maand; dezelfde velden als Mijn resultaten (server/utils/team ruw).
      const acts: KpiActiviteit[] = (await rijen(sql`select a.door, a.op, a.soort, a.uitkomst, a.account_id, coalesce(c.rol = 'beslisser', false) as beslisser, coalesce(a.kanaal = 'intern', false) as intern
        from activiteiten a left join contacts c on c.id = a.contact_id where a.door = ${mijn} and a.op >= ${vanTijd}`))
        .map((a) => ({ door: a.door, op: iso(a.op), soort: a.soort, uitkomst: a.uitkomst, accountId: a.account_id, beslisser: !!a.beslisser, intern: !!a.intern }))
      const kWeek = kpi(mijn, week, acts)
      const kMaand = kpi(mijn, maand, acts)
      const t = tempo(kWeek, ctx.gebruiker.werkplek)
      const [n] = await rijen(sql`select
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect')::int as prospects,
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect' and nb_status = 'in reis')::int as in_reis,
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect' and nb_status in ('nieuw', 'gescoord'))::int as nieuw,
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect' and nb_status in ('wachtend', 'nee'))::int as wacht,
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect' and nb_status in ('nieuw', 'in reis', 'gescoord'))::int as actief,
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect' and nb_status in ('nieuw', 'in reis', 'gescoord') and laatste_contact_op >= ${dertig})::int as recent,
        (select count(*) from accounts where owner_id = ${mijn} and account_kind = 'prospect' and nb_status in ('nieuw', 'in reis', 'gescoord') and laatste_contact_op is null)::int as zonder_contact,
        (select count(*) from overdrachten where door = ${mijn} and op >= ${maandTijd})::int as overdrachten,
        (select count(*) from signals where owner_id = ${mijn} and created_at >= ${zeven})::int as inzichten,
        (select count(*) from signals where owner_id = ${mijn} and created_at >= ${zeven} and status = 'nieuw')::int as inzichten_open,
        (select count(*) from tasks where owner_id = ${mijn} and status = 'klaar' and updated_at >= ${zeven})::int as taken_klaar,
        (select count(*) from tasks where owner_id = ${mijn} and status in ('open', 'bezig'))::int as taken_open,
        (select count(*) from tasks where owner_id = ${mijn} and status in ('open', 'bezig') and due_date < ${nlTijdstip(vandaag, 0).toISOString()})::int as taken_verlopen`)
      const s = n as Record<string, number>
      const anders = Math.max(0, s.prospects! - s.in_reis! - s.nieuw! - s.wacht!)
      const stand = { prospects: s.prospects!, zonderContact: s.zonder_contact!, inzichtenOpen: s.inzichten_open!, verlopen: s.taken_verlopen!, afsprakenMaand: kMaand.afspraken, tempo: { stand: t.stand, pogingen: kWeek.pogingen }, conversie: kMaand.gesprekNaarAfspraak }
      cijfers = {
        ...dashboardKop(stand),
        verdeling: {
          totaal: s.prospects!,
          delen: [
            { sleutel: 'inReis', label: 'in reis', aantal: s.in_reis! },
            { sleutel: 'nieuw', label: 'nieuw of gescoord', aantal: s.nieuw! },
            { sleutel: 'wacht', label: 'wachtend of nee', aantal: s.wacht! },
            ...(anders ? [{ sleutel: 'over', label: 'overgedragen', aantal: anders }] : []),
          ],
          dekking: magDekking ? { procent: s.actief ? Math.round((s.recent! / s.actief) * 100) : 0, recent: s.recent!, actief: s.actief!, zonderContact: s.zonder_contact! } : null,
        },
        gesprekken: { aantal: kWeek.gesprekken, pogingen: kWeek.pogingen, norm: t.norm, procent: t.procent, stand: t.stand },
        afspraken: { aantal: kMaand.afspraken, gesprekken: kMaand.gesprekken },
        conversie: { procent: Math.round(kMaand.gesprekNaarAfspraak.waarde * 100), noemer: kMaand.gesprekNaarAfspraak.noemer ?? 0, norm: Math.round(NORMEN.gesprekNaarAfspraak * 100) },
        overdrachten: s.overdrachten!,
        inzichten: { aantal: s.inzichten!, open: s.inzichten_open! },
        taken: { klaar: s.taken_klaar!, open: s.taken_open!, verlopen: s.taken_verlopen! },
      }
    }

    // Klaargezet door AI: concepten die op goedkeuring wachten en taakvoorstellen met een concept.
    let klaargezet = null
    if (magConcepten) {
      const l = await rijen(sql`(select 'concept' as bron, r.id, r.agent, r.concept->>'type' as type, r.account_id, a.name as account,
          coalesce(r.concept->>'onderwerp', r.concept->>'tekst', r.concept->'blokken'->>'opening', r.handeling) as regel, r.op, count(*) over () as totaal
        from concepten r left join accounts a on a.id = r.account_id where r.gebruiker_id = ${mijn} and r.status = 'klaar' order by r.op desc limit 5)
        union all
        (select 'taak' as bron, t.id, 'schrijver' as agent, 'taak' as type, t.account_id, a.name as account, t.title as regel, t.created_at as op, count(*) over () as totaal
        from tasks t left join accounts a on a.id = t.account_id where t.owner_id = ${mijn} and t.status in ('open', 'bezig') and t.data ? 'concept' order by t.created_at desc limit 3)`)
      const tel = (b: string) => Number(l.find((x) => x.bron === b)?.totaal ?? 0)
      klaargezet = {
        totaal: tel('concept') + tel('taak'), concepten: tel('concept'), taken: tel('taak'),
        lijst: l.map((x) => ({ bron: x.bron as 'concept' | 'taak', id: x.id as string, agent: agentNaam(x.agent), type: x.type as string, account: x.account ?? null, accountId: x.account_id ?? null, regel: String(x.regel ?? '').replace(/\s+/g, ' ').trim(), op: iso(x.op) }))
          .sort((a, b) => b.op.localeCompare(a.op)),
      }
    }

    // Door AI agents gedaan sinds gisteren: logboek van de agents, taken van de motor, inzichten en geparkeerde accounts.
    let agents = null
    if (magAgents) {
      const l = await rijen(sql`select * from (select u.*, count(*) over (partition by u.soort) as n, row_number() over (order by u.op desc) as r, row_number() over (partition by u.soort order by u.op desc) as rs from (
          select case when r.uitkomst = 'geblokkeerd' then 'tegengehouden' when r.agent = 'verrijker' or r.handeling = 'ai:dossier' then 'verrijkt' when r.agent = 'schrijver' then 'concept' when r.uitkomst = 'als_taak' then 'taak' else 'overig' end as soort,
            r.agent, r.handeling, r.uitkomst, r.reden, null as titel, a.name as account, r.account_id, r.op
          from agent_runs r left join accounts a on a.id = r.account_id
          where r.op >= ${gisteren} and r.uitkomst <> 'fout' and not (r.agent = 'waarnemer' and r.handeling like 'inzicht%') and (a.owner_id = ${mijn} or r.gebruiker_id = ${mijn})
          union all
          select 'taak', 'motor', null, null, null, t.title, a.name, t.account_id, t.created_at from tasks t left join accounts a on a.id = t.account_id
          where t.owner_id = ${mijn} and t.rule_id is not null and t.created_at >= ${gisteren}
          union all
          select 'inzicht', coalesce(s.agent, case when s.bron = 'extern' then 'waarnemer' else 'motor' end), null, null, null, s.title, a.name, s.account_id, s.created_at from signals s left join accounts a on a.id = s.account_id
          where s.owner_id = ${mijn} and s.created_at >= ${gisteren}
          union all
          select 'geparkeerd', case when g.door = 'motor' then 'motor' else 'jij' end, null, null, g.reden, null, a.name, g.account_id, g.op from reisgeschiedenis g join accounts a on a.id = g.account_id
          where a.owner_id = ${mijn} and g.gebeurtenis = 'geparkeerd' and g.op >= ${gisteren}
        ) u) x where r <= 6 or rs = 1 order by op desc`)
      const actie = (x: Rij): string => {
        if (x.soort === 'tegengehouden') return `Hield ${HANDELING[x.handeling] ?? x.handeling} van de ${agentNaam(x.agent)} tegen${x.reden ? `: ${x.reden}` : ''}`
        if (x.soort === 'taak' && x.titel) return `Zette een taak klaar: ${x.titel}`
        if (x.soort === 'inzicht') return `Nieuw inzicht: ${x.titel}`
        if (x.soort === 'geparkeerd') return `Parkeerde het account${x.reden ? `: ${x.reden}` : ''}`
        return HANDELING[x.handeling] ?? String(x.handeling ?? 'Voerde een handeling uit')
      }
      const tellers: Record<string, number> = {}
      for (const x of l) tellers[x.soort] = Number(x.n)
      const tijdlijn: AgentGebeurtenis[] = l.filter((x) => Number(x.r) <= 6).map((x) => ({
        soort: x.soort, agent: x.soort === 'tegengehouden' ? 'Bewaker' : x.agent === 'jij' ? 'Jij' : agentNaam(x.agent), actie: actie(x), account: x.account ?? null, accountId: x.account_id ?? null, op: iso(x.op),
      }))
      agents = { tellers: agentTellers(tellers), tijdlijn, totaal: Object.values(tellers).reduce((a, b) => a + b, 0) }
    }

    return { cijfers, klaargezet, agents, sinds: plusDagen(vandaag, -1) }
  })
})
