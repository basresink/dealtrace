// Bezoekanalyse en meetinganalyse (F10, F09, F18): laadt accounts, afspraken, activiteiten, regio's
// en de afspraakmatrix voor het gekozen bereik en venster; het rekenwerk staat in
// shared/afspraakAnalyse.ts. Bereik: je eigen portefeuille, of als salesmanager je teams (de beheerder
// alles), eventueel één persoon daaruit.
import { sql } from 'drizzle-orm'
import {
  afspraakCijfers, bezoekKpi, cijfersPerSoort, dekkingPerAccount, klasseDekking, leesVenster, meetingKpi, regioDekking, regioRitme, regiodagenEnRoutes,
  type AnalyseAccount, type AnalyseAfspraak, type Bereik, type Moment,
} from '../../shared/afspraakAnalyse'
import { AFSPRAAKMATRIX_STANDAARD, geldendeCel, intervalDagen, jaartotaal, klasseCode, leesMatrix, ritmeLabel, type Klasse } from '../../shared/ritmematrix'
import type { Regio } from '../../shared/gebieden'
import { gebruikDb } from './db'
import { eigenTeams } from './gebruikers'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const lijstSql = (ids: string[]) => sql`string_to_array(${ids.join(',')}, ',')`
const kortNaam = (n: string) => String(n ?? '').replace(/^Testgebruiker /, '')

export interface Kijker { id: string; rol: string }

/** Wie telt mee: eigen, team (salesmanager: zijn teams, beheerder: iedereen) of één persoon uit het team. */
export async function analyseBereik(tx: Tx, g: Kijker, q: { scope?: unknown; persoon?: unknown }) {
  const manager = ['salesmanager', 'beheerder'].includes(g.rol)
  // Het teambeeld is voor de salesmanager en de beheerder; een accountmanager met een teamlink ziet zijn eigen beeld.
  const scope = q.scope === 'team' && manager ? 'team' : 'eigen'
  const gebruikers = await rijen(tx, sql`select id, name, team_id, role from users where status = 'actief' and role <> 'founder' order by name`)
  let leden: { id: string; naam: string }[] = []
  if (manager) {
    const teams = g.rol === 'beheerder' ? null : await eigenTeams(tx, g.id)
    leden = gebruikers.filter((u) => u.id !== g.id && (teams === null || teams.includes(u.team_id))).map((u) => ({ id: u.id, naam: kortNaam(u.name) }))
  }
  let eigenaren: string[] | null = [g.id]
  let persoon: string | null = null
  if (scope === 'team') {
    if (typeof q.persoon === 'string' && q.persoon) {
      if (!leden.some((l) => l.id === q.persoon)) fout(403, 'Deze persoon valt niet onder jou')
      persoon = q.persoon as string
      eigenaren = [persoon]
    } else eigenaren = g.rol === 'beheerder' ? null : [g.id, ...leden.map((l) => l.id)]
  }
  const namen = new Map(gebruikers.map((u) => [u.id as string, kortNaam(u.name)]))
  return { scope, manager, leden, persoon, eigenaren, gebruikers: eigenaren ?? gebruikers.map((u) => u.id as string), namen }
}

async function instelling<T>(tx: Tx, key: string): Promise<T | undefined> {
  const [r] = await rijen(tx, sql`select value from org_settings where key = ${key}`)
  return r?.value as T | undefined
}

async function laadAccounts(tx: Tx, eigenaren: string[] | null, klassen: Klasse[]): Promise<AnalyseAccount[]> {
  if (eigenaren && !eigenaren.length) return []
  const rs = await rijen(tx, sql`select id, name, account_kind, nb_status, fase_id, klasse, gebied_id, city, lat, lng, owner_id, laatste_contact_op from accounts ${eigenaren ? sql`where owner_id = any(${lijstSql(eigenaren)})` : sql``} order by name`)
  const code = new Map(klassen.map((k) => [k.id, klasseCode(k)]))
  return rs.map((a) => ({
    id: a.id, naam: a.name, soort: a.account_kind === 'klant' ? 'klant' : 'prospect', nbStatus: a.nb_status, faseId: a.fase_id,
    klasseCode: a.klasse ? code.get(a.klasse) ?? null : null, regioId: a.gebied_id ?? null, plaats: a.city ?? null,
    punt: a.lat != null && a.lng != null ? { lat: Number(a.lat), lng: Number(a.lng) } : null, ownerId: a.owner_id, laatsteContactOp: iso(a.laatste_contact_op),
  }))
}

/** Alle afspraken van de organisatie met soort, uitkomst, verslag, transcript en Notulist; gefilterd in de aanroeper. */
async function laadAfspraken(tx: Tx): Promise<(AnalyseAfspraak & { type: string; eind: string })[]> {
  const rs = await rijen(tx, sql`select ap.id, ap.account_id, ap.owner_id, ap.vorm, ap.status, ap.start_at, ap.end_at, ap.uitkomst_code,
      coalesce(length(trim(ap.data->'verslag'->>'tekst')), 0) > 0 as verslag, ap.data->'notulist' is not null as notulist,
      exists (select 1 from transcripten t where t.record_soort = 'appointments' and t.record_id = ap.id) as transcript,
      m.slug, m.naam, m.type, m.data->'uitkomsten' as uitkomsten
    from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id`)
  return rs.map((r) => {
    const u = ((r.uitkomsten ?? []) as any[]).find((x) => x.code === r.uitkomst_code)
    return {
      id: r.id, accountId: r.account_id ?? null, ownerId: r.owner_id, soortSlug: r.slug, soortNaam: r.naam, vorm: r.vorm, type: r.type,
      status: r.status, start: iso(r.start_at)!, eind: iso(r.end_at)!, uitkomstCode: r.uitkomst_code ?? null, uitkomstLabel: u?.label ?? r.uitkomst_code ?? null,
      gevolg: u?.gevolg?.type ?? null, verslag: !!r.verslag, transcript: !!r.transcript, notulist: !!r.notulist,
    }
  })
}

const inVenster = (start: string, b: Bereik) => { const t = Date.parse(start); return t >= b.vanMs && t <= b.totMs }
const accountLijst = <T extends { laatste: string | null }>(accounts: AnalyseAccount[], extra: (a: AnalyseAccount) => T) =>
  accounts.map((a) => ({ id: a.id, naam: a.naam, soort: a.soort, status: a.nbStatus ?? null, klasse: a.klasseCode ?? null, regioId: a.regioId ?? null, plaats: a.plaats ?? null, punt: a.punt ?? null, eigenaar: a.ownerId ?? null, ...extra(a) }))

/** De bezoekanalyse: dekking per regio, bezoeken in de periode, regiodagen en routes, kansen langs de route. */
export async function bezoekAnalyse(tx: Tx, g: Kijker, q: Record<string, unknown>, nu = new Date()) {
  const bereik = await analyseBereik(tx, g, q)
  const venster = leesVenster(q, nu)
  const regios = (await instelling<Regio[]>(tx, 'gebieden')) ?? []
  const klassen = (await instelling<Klasse[]>(tx, 'klassen')) ?? []
  const feestdagen = ((await instelling<{ feestdagen?: string[] }>(tx, 'werkdagen'))?.feestdagen ?? []) as string[]
  const accounts = await laadAccounts(tx, bereik.eigenaren, klassen)
  const ids = new Set(accounts.map((a) => a.id))
  const alle = await laadAfspraken(tx)
  const soorten = [...new Map(alle.filter((a) => a.vorm === 'bezoek').map((a) => [a.soortSlug, { slug: a.soortSlug, naam: a.soortNaam }])).values()]
  const bezoekSoorten = (await rijen(tx, sql`select slug, naam from meetingsoorten where vorm = 'bezoek' and actief order by naam`)).map((r) => ({ slug: r.slug as string, naam: r.naam as string }))
  const soort = typeof q.soort === 'string' && q.soort ? q.soort : null
  const bezoeken = alle.filter((a) => a.vorm === 'bezoek' && (!soort || a.soortSlug === soort))

  // Dekking: elk gehouden bezoek op een account in beeld, door wie dan ook; zonder soortfilter ook de bezoekactiviteiten.
  const momenten: Moment[] = bezoeken.filter((a) => a.status === 'afgerond' && a.accountId && ids.has(a.accountId)).map((a) => ({ accountId: a.accountId!, op: a.start, soort: a.soortNaam }))
  if (!soort && ids.size) {
    for (const r of await rijen(tx, sql`select account_id, op from activiteiten where ((soort in ('afspraak', 'bezoek') and kanaal = 'bezoek') or soort = 'bezoek') and account_id = any(${lijstSql([...ids])})`)) momenten.push({ accountId: r.account_id, op: iso(r.op)!, soort: null })
  }
  const dekking = dekkingPerAccount(accounts, momenten, venster, nu)

  // Bezoeken in de periode: gehouden door de mensen in beeld.
  const vanMij = (ownerId: string) => !bereik.eigenaren || bereik.eigenaren.includes(ownerId)
  const periode = bezoeken.filter((a) => vanMij(a.ownerId) && inVenster(a.start, venster))
  const cijfers = afspraakCijfers(periode, alle, nu)

  // Regiodagen en routes (tot en met vandaag) met de regio van het account per stop.
  const regioVanAccount = new Map((await rijen(tx, sql`select id, gebied_id, lat, lng from accounts`)).map((a) => [a.id as string, { regioId: a.gebied_id ?? null, punt: a.lat != null ? { lat: Number(a.lat), lng: Number(a.lng) } : null }]))
  const routeTot = venster.tot < venster.van ? venster.van : venster.tot
  const routes = regiodagenEnRoutes(regios, bereik.gebruikers, bezoeken.filter((a) => a.status !== 'geannuleerd' && vanMij(a.ownerId)).map((a) => ({ ownerId: a.ownerId, start: a.start, eind: a.eind, accountId: a.accountId, regioId: a.accountId ? regioVanAccount.get(a.accountId)?.regioId ?? null : null, punt: a.accountId ? regioVanAccount.get(a.accountId)?.punt ?? null : null })), venster.van, routeTot, feestdagen)

  // Kansen langs de route: inloopbezoeken, klaargezet en overgeslagen in de periode.
  const scopeSql = (kolom: ReturnType<typeof sql>) => (bereik.eigenaren ? sql`${kolom} = any(${lijstSql(bereik.eigenaren)})` : sql`true`)
  const van = new Date(venster.vanMs).toISOString()
  const tot = new Date(venster.totMs).toISOString()
  const klaar = await rijen(tx, sql`select status, count(*)::int as n from klaargezet_voor where ${scopeSql(sql`voor_gebruiker`)} and op between ${van} and ${tot} group by 1`)
  const klaarDoor = await rijen(tx, sql`select count(*)::int as n from klaargezet_voor where ${scopeSql(sql`van_gebruiker`)} and op between ${van} and ${tot}`)
  const overgeslagen = await rijen(tx, sql`select reden, count(*)::int as n from kans_overslaan where ${scopeSql(sql`gebruiker_id`)} and op between ${van} and ${tot} group by 1 order by 2 desc`)
  const inloop = periode.filter((a) => a.soortSlug === 'ongepland-bezoek' && a.status !== 'geannuleerd').length
  const klaarTel = (s: string) => klaar.find((r) => r.status === s)?.n ?? 0

  return {
    bereik: { scope: bereik.scope, manager: bereik.manager, leden: bereik.leden, persoon: bereik.persoon },
    venster, soort, soorten: bezoekSoorten.length ? bezoekSoorten : soorten,
    kpi: bezoekKpi(accounts, dekking, nu),
    regios: regioDekking(accounts, dekking, regios),
    geenRegios: regios.length === 0,
    accounts: accountLijst(accounts, (a) => { const d = dekking.get(a.id)!; return { dekking: d.status, laatste: d.laatste, laatsteSoort: d.soort, dagenGeleden: d.dagenGeleden } })
      .sort((x, y) => Number(!!x.laatste) - Number(!!y.laatste) || String(x.laatste ?? '').localeCompare(String(y.laatste ?? '')) || x.naam.localeCompare(y.naam)),
    cijfers,
    perSoort: cijfersPerSoort(periode, alle, nu),
    routes: { ...routes, dagen: routes.dagen.slice(0, 60).map((d) => ({ ...d, gebruiker: bereik.namen.get(d.gebruikerId) ?? '' })) },
    kansen: {
      inloop, klaargezetVoor: klaar.reduce((s, r) => s + r.n, 0), klaargezetOpen: klaarTel('open'), klaargezetIngepland: klaarTel('ingepland'), klaargezetVervallen: klaarTel('vervallen'),
      klaargezetDoor: klaarDoor[0]?.n ?? 0, overgeslagen: overgeslagen.reduce((s, r) => s + r.n, 0), redenen: overgeslagen.slice(0, 5).map((r) => ({ reden: r.reden || 'Zonder reden', aantal: r.n })),
    },
  }
}

/** De meetinganalyse: ritme per accountklasse tegen de afspraakmatrix, meetings in de periode per soort en per regio. */
export async function meetingAnalyse(tx: Tx, g: Kijker, q: Record<string, unknown>, nu = new Date()) {
  const bereik = await analyseBereik(tx, g, q)
  const venster = leesVenster(q, nu)
  const regios = (await instelling<Regio[]>(tx, 'gebieden')) ?? []
  const klassen = (await instelling<Klasse[]>(tx, 'klassen')) ?? []
  const matrix = leesMatrix(await instelling(tx, 'afspraakmatrix'), AFSPRAAKMATRIX_STANDAARD).matrix
  const accounts = await laadAccounts(tx, bereik.eigenaren, klassen)
  const ids = new Set(accounts.map((a) => a.id))
  const alle = await laadAfspraken(tx)
  const meetingSoorten = (await rijen(tx, sql`select slug, naam, vorm from meetingsoorten where vorm <> 'bezoek' and type = 'klant' and actief order by naam`)).map((r) => ({ slug: r.slug as string, naam: r.naam as string, vorm: r.vorm as string }))
  const soort = typeof q.soort === 'string' && q.soort ? q.soort : null
  const vorm = q.vorm === 'online' || q.vorm === 'telefoon' ? q.vorm : null
  const meetings = alle.filter((a) => a.vorm !== 'bezoek' && a.type === 'klant' && (!soort || a.soortSlug === soort) && (!vorm || a.vorm === vorm))

  // Laatste gehouden meeting per account (door wie dan ook); zonder filter ook de afspraakactiviteiten online en telefonisch.
  const laatste = new Map<string, string | null>()
  const zet = (id: string, op: string) => { if (Date.parse(op) <= nu.getTime() && (!laatste.get(id) || op > laatste.get(id)!)) laatste.set(id, op) }
  for (const a of meetings) if (a.status === 'afgerond' && a.accountId && ids.has(a.accountId)) zet(a.accountId, a.start)
  if (!soort && !vorm && ids.size) for (const r of await rijen(tx, sql`select account_id, max(op) as op from activiteiten where soort = 'afspraak' and kanaal in ('online', 'telefoon') and account_id = any(${lijstSql([...ids])}) group by 1`)) zet(r.account_id, iso(r.op)!)

  const klasseNamen = klassen.map((k) => ({ code: klasseCode(k) ?? k.id, naam: k.naam }))
  const ritme = (code: string) => {
    const cel = geldendeCel(matrix, 'meeting', code, AFSPRAAKMATRIX_STANDAARD)
    return { perJaar: jaartotaal(cel), interval: intervalDagen(cel), label: ritmeLabel(cel) }
  }
  const k = klasseDekking(accounts, laatste, klasseNamen, ritme, nu)

  const vanMij = (ownerId: string) => !bereik.eigenaren || bereik.eigenaren.includes(ownerId)
  const periode = meetings.filter((a) => vanMij(a.ownerId) && inVenster(a.start, venster))
  const cijfers = afspraakCijfers(periode, alle, nu)
  const perVorm = (['online', 'telefoon'] as const).map((v) => ({ vorm: v, ...afspraakCijfers(periode.filter((a) => a.vorm === v), alle, nu) }))

  return {
    bereik: { scope: bereik.scope, manager: bereik.manager, leden: bereik.leden, persoon: bereik.persoon },
    venster, soort, vorm, soorten: meetingSoorten,
    kpi: meetingKpi(k.rijen, cijfers.afgerond, venster.dagen),
    klassen: k.rijen, zonderKlasse: k.zonderKlasse,
    regios: regioRitme(accounts, k.status, regios), geenRegios: regios.length === 0,
    accounts: accountLijst(accounts, (a) => {
      const l = laatste.get(a.id) ?? null
      return { ritme: k.status.get(a.id) ?? null, laatste: l, dagenGeleden: l ? Math.max(0, Math.floor((nu.getTime() - Date.parse(l)) / 864e5)) : null }
    }).sort((x, y) => Number(!!x.laatste) - Number(!!y.laatste) || String(x.laatste ?? '').localeCompare(String(y.laatste ?? '')) || x.naam.localeCompare(y.naam)),
    cijfers, perSoort: cijfersPerSoort(periode, alle, nu), perVorm,
  }
}
