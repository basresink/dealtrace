// GET /api/data-kwaliteit: de gaten in de gegevens die je mag zien (accountmanager eigen accounts,
// salesmanager de accounts van zijn teams, beheerder alles). Eén query per categorie plus één voor de
// noemers (geen N+1), binnen metOrganisatie (RLS). Per categorie het aantal, hooguit 50 voorbeelden en,
// waar de prospectlijst een passend filter heeft, de link naar die gefilterde lijst.
import { sql, type SQL } from 'drizzle-orm'
import { KWALITEIT_CATEGORIEEN, filterLink, kwaliteitScore, type Basis, type KwaliteitSleutel } from '../../shared/datakwaliteit'
import { kan } from '../utils/accounts'
import { metOrganisatie } from '../utils/db'
import { eigenTeams } from '../utils/gebruikers'
import { vereisFunctie } from '../utils/sessie'

interface Voorbeeld { id: string; naam: string; sub: string | null; link: string }
interface Rij { id: string; naam: string; sub: string | null; link: string; totaal: number }

const MAX = 50

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'data.kwaliteit')
  const rol = ctx.gebruiker.rol
  const manager = rol === 'salesmanager' || rol === 'beheerder' || rol === 'founder'
  const alleFilters = kan(ctx, 'prospects.filtersAlle')

  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    // Wie je mag zien: null is alles, anders de eigenaren (jijzelf en de leden van je teams).
    let eigenaren: string[] | null = null
    let bereik: 'eigen' | 'team' | 'alles' = 'alles'
    if (rol === 'salesmanager') {
      const teams = await eigenTeams(tx, ctx.gebruiker.id)
      const leden = teams.length ? ((await tx.execute(sql`select id from users where team_id = any(string_to_array(${teams.join(',')}, ','))`)).rows as { id: string }[]).map((r) => r.id) : []
      eigenaren = [...new Set([ctx.gebruiker.id, ...leden])]
      bereik = 'team'
    } else if (rol !== 'beheerder' && rol !== 'founder') {
      eigenaren = [ctx.gebruiker.id]
      bereik = 'eigen'
    }
    const ids = (eigenaren ?? []).join(',')
    const van = (kolom: SQL) => (eigenaren ? sql`${kolom} = any(string_to_array(${ids}, ','))` : sql`true`)
    const accScope = van(sql`a.owner_id`)
    const prospect = sql`a.account_kind = 'prospect' and ${accScope}`
    const actiefContact = sql`c.status <> 'vertrokken'`

    const rijen = async (q: SQL) => (await tx.execute(q)).rows as unknown as Rij[]
    // Prospects met een voorwaarde: naam, plaats en de accountkaart.
    const prospects = (voorwaarde: SQL) => rijen(sql`select a.id, a.name as naam, a.city as sub, '/accounts/' || a.id as link, count(*) over()::int as totaal
      from accounts a where ${prospect} and (${voorwaarde}) order by a.name limit ${MAX}`)

    const queries: Record<KwaliteitSleutel, () => Promise<Rij[]>> = {
      zonderBeslisser: () => prospects(sql`not exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact} and c.rol = 'beslisser')`),
      zonderTelefoon: () => prospects(sql`coalesce(a.data->>'telefoon', '') = '' and not exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact} and (coalesce(c.data->>'telefoon', '') <> '' or coalesce(c.data->>'mobiel', '') <> ''))`),
      zonderEmail: () => prospects(sql`coalesce(a.data->>'email', '') = '' and not exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact} and coalesce(c.email, '') <> '')`),
      zonderWebsite: () => prospects(sql`coalesce(a.data->>'website', '') = ''`),
      zonderBranche: () => prospects(sql`coalesce(a.data->>'branche', '') = '' and a.vv_branche_id is null`),
      zonderKlasse: () => prospects(sql`coalesce(a.klasse, '') = ''`),
      zonderReis: () => prospects(sql`a.reis_id is null or a.fase_id is null`),
      geenContact90: () => prospects(sql`a.laatste_contact_op is null or a.laatste_contact_op < now() - interval '90 days'`),
      // Zonder eigenaar valt buiten elk team; alleen de salesmanager en de beheerder zien deze.
      zonderEigenaar: async () => (manager ? rijen(sql`select a.id, a.name as naam, a.city as sub, '/accounts/' || a.id as link, count(*) over()::int as totaal
        from accounts a where a.account_kind = 'prospect' and a.owner_id is null order by a.name limit ${MAX}`) : []),
      // Een zichtbaar account met hetzelfde domein of KvK-nummer als een ander account in de organisatie.
      dubbel: () => rijen(sql`select a.id, a.name as naam, 'Zelfde ' || d.waarop || ' als ' || d.naam as sub, '/accounts/' || a.id as link, count(*) over()::int as totaal
        from accounts a
        join lateral (select b.name as naam, case when coalesce(a.kvk, '') <> '' and b.kvk = a.kvk then 'KvK-nummer' else 'domein' end as waarop
          from accounts b where b.id <> a.id and ((coalesce(a.domein, '') <> '' and lower(b.domein) = lower(a.domein)) or (coalesce(a.kvk, '') <> '' and b.kvk = a.kvk))
          order by b.name limit 1) d on true
        where ${accScope} order by lower(coalesce(a.domein, a.kvk, '')), a.name limit ${MAX}`),
      contactZonderFunctie: () => rijen(sql`select c.id, trim(coalesce(c.first_name, '') || ' ' || c.last_name) as naam, a.name as sub, '/contacten/' || c.id as link, count(*) over()::int as totaal
        from contacts c join accounts a on a.id = c.account_id
        where ${accScope} and ${actiefContact} and (coalesce(c.data->>'functie', '') = '' or c.rol = 'onbekend') order by a.name, c.last_name limit ${MAX}`),
      contactZonderConsent: () => rijen(sql`select c.id, trim(coalesce(c.first_name, '') || ' ' || c.last_name) as naam, a.name as sub, '/contacten/' || c.id as link, count(*) over()::int as totaal
        from contacts c join accounts a on a.id = c.account_id
        where ${accScope} and ${actiefContact} and coalesce(c.email, '') <> '' and coalesce(c.data->'consent'->'email'->>'status', 'onbekend') = 'onbekend' order by a.name, c.last_name limit ${MAX}`),
      takenZonderDatum: () => rijen(sql`select t.id, t.title as naam, a.name as sub, '/acties?taak=' || t.id as link, count(*) over()::int as totaal
        from tasks t left join accounts a on a.id = t.account_id
        where ${van(sql`t.owner_id`)} and t.status in ('open', 'bezig') and t.due_date is null order by t.created_at desc limit ${MAX}`),
      afsprakenZonderVerslag: () => rijen(sql`select ap.id, coalesce(a.name, ms.naam, 'Afspraak') as naam, to_char(ap.start_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY') || coalesce(' · ' || ms.naam, '') as sub,
          case when ap.account_id is not null then '/accounts/' || ap.account_id || '?tab=afspraken' else '/agenda?datum=' || to_char(ap.start_at at time zone 'Europe/Amsterdam', 'YYYY-MM-DD') end as link, count(*) over()::int as totaal
        from appointments ap left join accounts a on a.id = ap.account_id left join meetingsoorten ms on ms.id = ap.meetingsoort_id
        where ${van(sql`ap.owner_id`)} and ap.end_at < now() and ap.status in ('gepland', 'afgerond') and coalesce(ap.data->'verslag'->>'tekst', '') = '' order by ap.start_at desc limit ${MAX}`),
    }

    // De noemers in één query.
    const [n] = (await tx.execute(sql`select
      (select count(*)::int from accounts a where ${prospect}) as prospects,
      (select count(*)::int from accounts a where ${accScope}) as accounts,
      (select count(*)::int from accounts a where a.account_kind = 'prospect' and (a.owner_id is null or ${accScope})) as onbeheerd,
      (select count(*)::int from contacts c join accounts a on a.id = c.account_id where ${accScope} and ${actiefContact}) as contacten,
      (select count(*)::int from contacts c join accounts a on a.id = c.account_id where ${accScope} and ${actiefContact} and coalesce(c.email, '') <> '') as "contactenMetMail",
      (select count(*)::int from tasks t where ${van(sql`t.owner_id`)} and t.status in ('open', 'bezig')) as taken,
      (select count(*)::int from appointments ap where ${van(sql`ap.owner_id`)} and ap.end_at < now() and ap.status in ('gepland', 'afgerond')) as afspraken`)).rows as unknown as Record<Basis, number>[]

    const zichtbaar = KWALITEIT_CATEGORIEEN.filter((c) => !c.alleenManager || manager)
    const uitkomsten = await opVolgorde(zichtbaar.map((c) => queries[c.sleutel]))
    const categorieen = zichtbaar.map((c, i) => {
      const r = uitkomsten[i]!
      const aantal = r[0]?.totaal ?? 0
      const voorbeelden: Voorbeeld[] = r.map(({ id, naam, sub, link }) => ({ id, naam, sub, link }))
      return {
        sleutel: c.sleutel, groep: c.groep, titel: c.titel, uitleg: c.uitleg, icoon: c.icoon,
        aantal, noemer: Number(n?.[c.basis] ?? 0), link: aantal ? filterLink(c, rol, alleFilters) : null,
        voorbeelden, meer: Math.max(0, aantal - voorbeelden.length),
      }
    })
    return {
      bereik,
      score: kwaliteitScore(categorieen),
      gaten: categorieen.reduce((s, c) => s + c.aantal, 0),
      categorieen,
    }
  })
})

/** Eén verbinding per transactie: de queries na elkaar, niet tegelijk. */
async function opVolgorde<T>(taken: (() => Promise<T>)[]): Promise<T[]> {
  const uit: T[] = []
  for (const t of taken) uit.push(await t())
  return uit
}
