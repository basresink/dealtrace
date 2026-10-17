// GET /api/data-kwaliteit: de gaten in de gegevens die je mag zien (accountmanager eigen accounts,
// salesmanager de accounts van zijn teams, beheerder alles). Eén query per categorie plus één voor de
// noemers (geen N+1), binnen metOrganisatie (RLS). Per categorie het aantal, hooguit 50 regels (naam,
// account of plaats, wat er ontbreekt, link) en, waar de prospectlijst een passend filter heeft, de link
// naar die gefilterde lijst. Eigen velden met "Meenemen in Datakwaliteit" worden een categorie
// "Zonder <veldnaam>" (prospects of contacten).
// ?categorie=<sleutel> geeft alleen die categorie, met hooguit FLYOUT_MAX regels (voor de flyout).
import { sql, type SQL } from 'drizzle-orm'
import {
  eigenVeldCategorie, FLYOUT_MAX, KWALITEIT_CATEGORIEEN, filterLink, kwaliteitScore, teltMee,
  type Basis, type KwaliteitCategorie, type KwaliteitRij, type KwaliteitSleutel,
} from '../../shared/datakwaliteit'
import { effectiefNiveau, eigenVeldenVoor, kan } from '../utils/accounts'
import { metOrganisatie } from '../utils/db'
import { eigenTeams } from '../utils/gebruikers'
import { vereisFunctie } from '../utils/sessie'

type Rij = Omit<KwaliteitRij, 'ontbreekt'> & { ontbreekt: string | null; totaal: number }
type Categorie = Omit<KwaliteitCategorie, 'sleutel'> & { sleutel: string; eigenVeld?: string }

const MAX = 50

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'data.kwaliteit')
  const rol = ctx.gebruiker.rol
  const manager = rol === 'salesmanager' || rol === 'beheerder' || rol === 'founder'
  const alleFilters = kan(ctx, 'prospects.filtersAlle')
  const gevraagd = typeof getQuery(event).categorie === 'string' ? String(getQuery(event).categorie) : null

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
    // Een gedeactiveerde prospect telt niet mee: hij staat ook niet in de standaardlijst van /prospects/alle (zelfde aantal).
    const accScope = sql`${van(sql`a.owner_id`)} and a.gedeactiveerd_op is null`
    const prospect = sql`a.account_kind = 'prospect' and ${accScope}`
    const actiefContact = sql`c.status <> 'vertrokken'`
    const datum = (kolom: SQL) => sql`to_char(${kolom} at time zone 'Europe/Amsterdam', 'DD-MM-YYYY')`
    const contactNaam = sql`trim(coalesce(c.first_name, '') || ' ' || c.last_name)`

    const rijen = async (q: SQL) => (await tx.execute(q)).rows as unknown as Rij[]
    // Prospects met een voorwaarde: naam, plaats, wat er ontbreekt en de accountkaart.
    const prospects = (voorwaarde: SQL, max: number, ontbreekt: SQL = sql`null`) => rijen(sql`select a.id, a.name as naam, null as account, a.city as plaats, ${ontbreekt} as ontbreekt,
        '/accounts/' || a.id as link, count(*) over()::int as totaal
      from accounts a where ${prospect} and (${voorwaarde}) order by a.name limit ${max}`)
    // Actieve contacten met een voorwaarde: naam, account en de contactkaart.
    const contacten = (voorwaarde: SQL, max: number, ontbreekt: SQL = sql`null`) => rijen(sql`select c.id, ${contactNaam} as naam, a.name as account, null as plaats, ${ontbreekt} as ontbreekt,
        '/contacten/' || c.id as link, count(*) over()::int as totaal
      from contacts c join accounts a on a.id = c.account_id
      where ${accScope} and ${actiefContact} and (${voorwaarde}) order by a.name, c.last_name limit ${max}`)
    // Leeg eigen veld: geen sleutel, een lege tekst of een lege meerkeuze.
    const leegVeld = (alias: 'a' | 'c', sleutel: string) => sql`coalesce(nullif(${sql.raw(alias)}.data->'customFields'->>${sleutel}, '[]'), '') = ''`

    const queries: Record<KwaliteitSleutel, (max: number) => Promise<Rij[]>> = {
      zonderBeslisser: (max) => prospects(sql`not exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact} and c.rol = 'beslisser')`, max,
        sql`case when exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact}) then 'Beslisser' else 'Beslisser (nog geen contactpersoon)' end`),
      zonderTelefoon: (max) => prospects(sql`coalesce(a.data->>'telefoon', '') = '' and not exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact} and (coalesce(c.data->>'telefoon', '') <> '' or coalesce(c.data->>'mobiel', '') <> ''))`, max,
        sql`'Telefoonnummer bij account en contacten'`),
      zonderEmail: (max) => prospects(sql`coalesce(a.data->>'email', '') = '' and not exists (select 1 from contacts c where c.account_id = a.id and ${actiefContact} and coalesce(c.email, '') <> '')`, max,
        sql`'E-mailadres bij account en contacten'`),
      zonderWebsite: (max) => prospects(sql`coalesce(a.data->>'website', '') = ''`, max),
      zonderBranche: (max) => prospects(sql`coalesce(a.data->>'branche', '') = '' and a.vv_branche_id is null`, max),
      zonderKlasse: (max) => prospects(sql`coalesce(a.klasse, '') = ''`, max),
      zonderReis: (max) => prospects(sql`a.reis_id is null or a.fase_id is null`, max, sql`case when a.reis_id is null then 'Reis' else 'Fase' end`),
      geenContact90: (max) => prospects(sql`a.laatste_contact_op is null or a.laatste_contact_op < now() - interval '90 days'`, max,
        sql`case when a.laatste_contact_op is null then 'Nog nooit contact' else 'Laatste contact ' || ${datum(sql`a.laatste_contact_op`)} end`),
      // Zonder eigenaar valt buiten elk team; alleen de salesmanager en de beheerder zien deze.
      zonderEigenaar: async (max) => (manager ? rijen(sql`select a.id, a.name as naam, null as account, a.city as plaats, null as ontbreekt, '/accounts/' || a.id as link, count(*) over()::int as totaal
        from accounts a where a.account_kind = 'prospect' and a.owner_id is null order by a.name limit ${max}`) : []),
      // Een zichtbaar account met hetzelfde domein of KvK-nummer als een ander account in de organisatie.
      dubbel: (max) => rijen(sql`select a.id, a.name as naam, null as account, a.city as plaats, 'Zelfde ' || d.waarop || ' als ' || d.naam as ontbreekt, '/accounts/' || a.id as link, count(*) over()::int as totaal
        from accounts a
        join lateral (select b.name as naam, case when coalesce(a.kvk, '') <> '' and b.kvk = a.kvk then 'KvK-nummer' else 'domein' end as waarop
          from accounts b where b.id <> a.id and ((coalesce(a.domein, '') <> '' and lower(b.domein) = lower(a.domein)) or (coalesce(a.kvk, '') <> '' and b.kvk = a.kvk))
          order by b.name limit 1) d on true
        where ${accScope} order by lower(coalesce(a.domein, a.kvk, '')), a.name limit ${max}`),
      contactZonderFunctie: (max) => contacten(sql`coalesce(c.data->>'functie', '') = '' or c.rol = 'onbekend'`, max,
        sql`case when coalesce(c.data->>'functie', '') = '' and c.rol = 'onbekend' then 'Functie en rol' when coalesce(c.data->>'functie', '') = '' then 'Functie' else 'Rol in het buying committee' end`),
      contactZonderConsent: (max) => contacten(sql`coalesce(c.email, '') <> '' and coalesce(c.data->'consent'->'email'->>'status', 'onbekend') = 'onbekend'`, max),
      takenZonderDatum: (max) => rijen(sql`select t.id, t.title as naam, a.name as account, null as plaats, null as ontbreekt, '/acties?taak=' || t.id as link, count(*) over()::int as totaal
        from tasks t left join accounts a on a.id = t.account_id
        where ${van(sql`t.owner_id`)} and t.status in ('open', 'bezig') and t.due_date is null order by t.created_at desc limit ${max}`),
      afsprakenZonderVerslag: (max) => rijen(sql`select ap.id, coalesce(ms.naam, 'Afspraak') || ' van ' || ${datum(sql`ap.start_at`)} as naam, a.name as account, null as plaats, null as ontbreekt,
          case when ap.account_id is not null then '/accounts/' || ap.account_id || '?tab=afspraken' else '/agenda?datum=' || to_char(ap.start_at at time zone 'Europe/Amsterdam', 'YYYY-MM-DD') end as link, count(*) over()::int as totaal
        from appointments ap left join accounts a on a.id = ap.account_id left join meetingsoorten ms on ms.id = ap.meetingsoort_id
        where ${van(sql`ap.owner_id`)} and ap.end_at < now() and ap.status in ('gepland', 'afgerond') and coalesce(ap.data->'verslag'->>'tekst', '') = '' order by ap.start_at desc limit ${max}`),
    }

    // Eigen velden met "Meenemen in Datakwaliteit" die jouw niveau mag zien.
    const niveau = effectiefNiveau(ctx)
    const velden = [...await eigenVeldenVoor(tx, 'account', niveau), ...await eigenVeldenVoor(tx, 'contact', niveau)].filter(teltMee)
    const veldCategorieen: Categorie[] = velden.map(eigenVeldCategorie)
    const queryVoor = (c: Categorie): ((max: number) => Promise<Rij[]>) => {
      if (!c.eigenVeld) return queries[c.sleutel as KwaliteitSleutel]
      const k = c.eigenVeld
      return c.basis === 'contacten' ? (max) => contacten(leegVeld('c', k), max) : (max) => prospects(leegVeld('a', k), max)
    }

    const vast: Categorie[] = KWALITEIT_CATEGORIEEN.filter((c) => !c.alleenManager || manager)
    const zichtbaar: Categorie[] = [...vast, ...veldCategorieen]
    const regels = (r: Rij[], c: Categorie): KwaliteitRij[] => r.map(({ id, naam, account, plaats, ontbreekt, link }) => ({ id, naam, account, plaats, ontbreekt: ontbreekt ?? c.ontbreekt, link }))

    // De flyout vraagt één categorie met meer regels.
    if (gevraagd) {
      const c = zichtbaar.find((x) => x.sleutel === gevraagd)
      if (!c) throw createError({ statusCode: 404, statusMessage: 'Deze controle bestaat niet of is niet voor jou' })
      const r = await queryVoor(c)(FLYOUT_MAX)
      const aantal = r[0]?.totaal ?? 0
      return { sleutel: c.sleutel, aantal, regels: regels(r, c), meer: Math.max(0, aantal - r.length) }
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

    const uitkomsten = await opVolgorde(zichtbaar.map((c) => () => queryVoor(c)(MAX)))
    const categorieen = zichtbaar.map((c, i) => {
      const r = uitkomsten[i]!
      const aantal = r[0]?.totaal ?? 0
      const voorbeelden = regels(r, c)
      return {
        sleutel: c.sleutel, groep: c.groep, titel: c.titel, uitleg: c.uitleg, icoon: c.icoon, basis: c.basis, ontbreekt: c.ontbreekt, eigenVeld: c.eigenVeld ?? null,
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
