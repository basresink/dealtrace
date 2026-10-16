// Volgen op de server (F2 en F7): laadt de bestaande data van een account (of één contact binnen zijn account),
// werkt de opvolgreeks bij en rekent met volgendeStap() uit shared/ de volgende beste stap uit. Een keuze (Doe het
// nu, Plan in, Niet nu) maakt of verplaatst een taak en voedt de leerlus via volgen_keuzes.
import { and, eq, inArray, sql } from 'drizzle-orm'
import { nlMoment, voegWerkdagenToe, volgendWerkmoment, type WerkdagInstelling } from '../../shared/datum'
import { volgendVastBlok } from '../../shared/belblokken'
import { dagenInFase, fase as zoekFase } from '../../shared/reis'
import { FREQUENTIEPLAFOND_STANDAARD, KLASSEN_STANDAARD, klasseCode, type Klasse } from '../../shared/ritmematrix'
import { mandaatKeuzes } from '../../shared/opvolgreeks'
import { NIET_NU_DAGEN, NIET_NU_REDENEN, volgendeStap, type Kandidaat, type NietNuReden, type StapSoort } from '../../shared/volgendeStap'
import { laadAgentStand, mandaatVoor } from './agents/bewaker'
import { blokkenVan } from './bellen'
import { schema } from './db'
import { isAfgemeld } from './mail'
import { magVolgen, reeksVanAccount, sjablonen, werkReeksBij, type ReeksGebruiker } from './opvolgreeks'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const naam = (c: { firstName: string | null; lastName: string }) => [c.firstName, c.lastName].filter(Boolean).join(' ')
const NIET_OPGENOMEN = new Set(['geen_reactie', 'voicemail'])
const ACTIE_VAN_SOORT: Record<StapSoort, string> = { bellen: 'bellen', mail: 'mailen', linkedin: 'linkedin', bezoek: 'bezoek', taak: 'taak', wachten: 'taak' }

async function instelling<T>(tx: Tx, key: string): Promise<T | undefined> {
  return (await rijen(tx, sql`select value from org_settings where key = ${key}`))[0]?.value as T | undefined
}

/** Alles wat de flyout Volgen nodig heeft: stap, alternatieven, weging, Bewaker, reeks en sjablonen. */
export async function volgenVoor(tx: Tx, org: string, g: ReeksGebruiker, accountId: string, contactId: string | null, nu = new Date(), basisUrl?: string) {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) fout(404, 'Account onbekend')
  const account = a!
  const alleContacten = await tx.select().from(schema.contacts).where(eq(schema.contacts.accountId, accountId))
  if (contactId && !alleContacten.some((c) => c.id === contactId)) fout(422, 'Dit contact hoort niet bij het account')
  const contacten = alleContacten.filter((c) => c.status !== 'vertrokken')

  // De lopende reeks eerst bijwerken: stopt hij, dan telt dat al mee.
  const [lopend] = await rijen(tx, sql`select id from reeksen where account_id = ${accountId} and status = 'loopt'`)
  if (lopend) await werkReeksBij(tx, org, lopend.id, nu, { gebruiker: g, basisUrl })
  const reeks = await reeksVanAccount(tx, accountId, nu)

  const inst = ((await instelling<WerkdagInstelling>(tx, 'werkdagen')) ?? {}) as WerkdagInstelling
  const klassen = ((await instelling<Klasse[]>(tx, 'klassen')) ?? KLASSEN_STANDAARD) as Klasse[]
  const klasse = account.klasse ? klasseCode(klassen.find((k) => k.id === account.klasse) ?? { id: account.klasse, naam: account.klasse }) : null
  const [reis] = account.reisId ? await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, account.reisId)) : []
  const f = reis ? zoekFase(reis.data, account.faseId) : undefined
  const ritmeStand = (account.data as any)?.reis?.ritme ?? null
  const ritmeRij = ritmeStand?.ritmeId ? (await tx.select().from(schema.hercontactritmes).where(eq(schema.hercontactritmes.id, ritmeStand.ritmeId)))[0] : undefined

  const taken = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.accountId, accountId), inArray(schema.tasks.status, ['open', 'bezig'])))
  const sinds = new Date(nu.getTime() - 30 * 864e5).toISOString()
  const inzichten = await rijen(tx, sql`select s.id, s.title, s.relevance_score, s.created_at, s.contact_id,
      exists (select 1 from tasks t where t.signal_id = s.id and t.status in ('open', 'bezig')) as heeft_taak
    from signals s where s.account_id = ${accountId} and s.status in ('nieuw', 'gelezen') and s.created_at >= ${sinds} order by s.relevance_score desc limit 20`)
  const ids = contacten.map((c) => c.id)
  const belpogingen = ids.length ? await rijen(tx, sql`select contact_id, op, uitkomst from activiteiten where soort = 'gebeld' and contact_id in ${ids} and op >= ${new Date(nu.getTime() - 180 * 864e5).toISOString()}`) : []
  const momenten = await rijen(tx, sql`select op from activiteiten where account_id = ${accountId} and uitvoerder = 'mens' and op >= ${new Date(nu.getTime() - 21 * 864e5).toISOString()}
    and ((soort = 'gebeld' and coalesce(uitkomst, '') <> 'geen_reactie') or soort in ('mail', 'bericht', 'bezoek')) and coalesce(uitkomst, '') <> 'geen_reactie'`)
  const afgemeld = new Set<string>()
  for (const c of contacten) if (c.email && await isAfgemeld(tx, c.email)) afgemeld.add(c.id)
  const leerlus = Object.fromEntries((await rijen(tx, sql`select soort, count(*)::int as n from volgen_keuzes where gebruiker_id = ${g.id} and keuze = 'niet-nu' and reden = 'klopt-niet'
    and op >= ${new Date(nu.getTime() - 90 * 864e5).toISOString()} group by soort`)).map((r) => [r.soort, r.n]))
  const vandaag = nlMoment(nu).datum
  const onderdrukt = (await rijen(tx, sql`select stap_sleutel from volgen_keuzes where account_id = ${accountId} and keuze = 'niet-nu' and tot >= ${vandaag}`)).map((r) => r.stap_sleutel as string)
  const plafond = (await instelling<{ werkdagen: number; maxBerichten: number }>(tx, 'frequentieplafond')) ?? FREQUENTIEPLAFOND_STANDAARD

  const uitkomst = volgendeStap({
    nu, inst, focusContactId: contactId, plafond, leerlus, onderdrukt,
    account: {
      id: account.id, naam: account.name, nbStatus: account.nbStatus, data: { nee: (account.data as any)?.nee ?? null, wachtendTot: (account.data as any)?.wachtendTot ?? null }, klasse,
      fase: f ? { label: f.label, dagen: dagenInFase(account, nu), norm: f.verwachtVerblijfDagen ?? null, eind: !!f.eind } : null,
      ritme: ritmeStand ? { actief: !!ritmeStand.actief, naam: ritmeRij?.naam ?? null, stap: ritmeStand.stap, van: ritmeRij?.data.stappen.length ?? ritmeStand.stap, kanaal: ritmeStand.kanaal, volgendeOp: ritmeStand.volgendeOp } : null,
      terugOp: account.terugOp, terugkom: (account.data as any)?.terugkom ?? null,
    },
    contacten: contacten.map((c) => ({ id: c.id, naam: naam(c), rol: c.rol, belMeNiet: !!c.data?.belMeNiet, afgemeld: afgemeld.has(c.id), consentMail: c.data?.consent?.email?.status ?? null })),
    taken: taken.map((t) => ({ id: t.id, titel: t.title, actionType: t.actionType, dueDate: t.dueDate, priority: t.priority, contactId: t.contactId, ritmePoging: (t.data as any)?.poging ?? null, reeksId: (t.data as any)?.reeks?.id ?? null })),
    inzichten: inzichten.map((i) => ({ id: i.id, titel: i.title, relevantie: i.relevance_score, op: iso(i.created_at)!, contactId: i.contact_id, heeftTaak: !!i.heeft_taak })),
    belpogingen: belpogingen.map((p) => ({ contactId: p.contact_id, op: iso(p.op)!, opgenomen: !!p.uitkomst && !NIET_OPGENOMEN.has(p.uitkomst) })),
    contactmomenten: momenten.map((m) => iso(m.op)!),
    reeks: reeks && ['loopt', 'gepauzeerd'].includes(reeks.status) ? { id: reeks.id, naam: reeks.naam, status: reeks.status, contactId: reeks.contact?.id ?? null, volgende: reeks.volgende } : null,
  })

  const stand = await laadAgentStand(tx, org)
  const contact = contactId ? contacten.find((c) => c.id === contactId) ?? alleContacten.find((c) => c.id === contactId) : null
  return {
    account: { id: account.id, naam: account.name, status: account.nbStatus, klasse, fase: f?.label ?? null },
    contact: contact ? { id: contact.id, naam: naam(contact), rol: contact.rol } : null,
    ...uitkomst,
    reeks,
    sjablonen: await sjablonen(tx, org),
    contacten: contacten.map((c) => ({ id: c.id, naam: naam(c), rol: c.rol, email: !!c.email })),
    mandaten: mandaatKeuzes(mandaatVoor(stand, 'verzender', { id: g.id, niveau: g.niveau, data: g.data }, true)),
    kan: { wijzigen: await magVolgen(tx, g, account.ownerId) },
  }
}

/** Doe het nu, Plan in, een alternatief kiezen of Niet nu (met reden). De server rekent de stap opnieuw uit. */
export async function kiesStap(tx: Tx, org: string, g: ReeksGebruiker, accountId: string, b: { sleutel?: string; keuze?: string; reden?: string | null; contactId?: string | null }, nu = new Date()) {
  if (!['nu', 'plan', 'niet-nu', 'alternatief'].includes(b.keuze ?? '')) fout(400, 'Kies nu, plan, niet-nu of alternatief')
  const [a] = await tx.select({ ownerId: schema.accounts.ownerId }).from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) fout(404, 'Account onbekend')
  if (!(await magVolgen(tx, g, a!.ownerId))) fout(403, 'Alleen de eigenaar, zijn salesmanager of de beheerder kiest de stap op dit account')
  const v = await volgenVoor(tx, org, g, accountId, b.contactId ?? null, nu)
  const k: Kandidaat | undefined = [v.stap, ...v.alternatieven].find((x) => x.sleutel === b.sleutel)
  if (!k) fout(409, 'Deze stap is niet meer actueel. Vernieuw het venster.')
  const kand = k!
  const inst = ((await instelling<WerkdagInstelling>(tx, 'werkdagen')) ?? {}) as WerkdagInstelling
  const log = (keuze: string, extra: { reden?: string | null; tot?: string | null; taskId?: string | null } = {}) => tx.execute(sql`insert into volgen_keuzes (organisation_id, account_id, contact_id, gebruiker_id, stap_sleutel, soort, keuze, reden, tot, task_id, op)
    values (${org}, ${accountId}, ${kand.contactId}, ${g.id}, ${kand.sleutel}, ${kand.soort}, ${keuze}, ${extra.reden ?? null}, ${extra.tot ?? null}, ${extra.taskId ?? null}, ${nu.toISOString()})`)

  if (b.keuze === 'niet-nu') {
    if (!(NIET_NU_REDENEN as readonly string[]).includes(b.reden ?? '')) fout(422, 'Kies al gedaan, klopt niet of later')
    const tot = voegWerkdagenToe(nlMoment(nu).datum, NIET_NU_DAGEN[b.reden as NietNuReden], inst)
    await log('niet-nu', { reden: b.reden, tot })
    const tekst = b.reden === 'klopt-niet' ? 'Genoteerd. Deze stap weegt voortaan minder voor je.' : b.reden === 'later' ? `Deze stap komt terug op ${new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${tot}T12:00:00Z`))}.` : 'Genoteerd als al gedaan.'
    return { tekst, taskId: null }
  }
  if (kand.soort === 'wachten') fout(422, 'Bij wachten hoef je niets te doen')
  if (!kand.bewaker.mag) fout(409, `De Bewaker houdt dit tegen: ${kand.bewaker.tekst.replace(/^Tegengehouden: /, '')}`)
  // Een moment: nu (het volgende hele werkuur als het buiten werktijd is) of het volgende belblok.
  const plan = b.keuze === 'plan'
  let due = nu
  let tekst = 'Taak staat klaar.'
  if (plan) {
    const blok = kand.soort === 'bellen' ? volgendVastBlok(blokkenVan({ werkplek: g.werkplek, data: g.data }).blokken, nu, inst) : null
    due = blok?.start ?? volgendWerkmoment(new Date(nu.getTime() + 864e5), inst)
    tekst = blok ? `Ingepland in je belblok van ${blok.label}.` : `Ingepland op ${new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(due)}.`
  }
  let taskId = kand.taakId
  if (taskId) {
    if (plan) await tx.update(schema.tasks).set({ dueDate: due.toISOString(), updatedAt: nu.toISOString() }).where(eq(schema.tasks.id, taskId))
  } else {
    const waarom = kand.factoren.filter((x) => x.punten > 0).sort((x, y) => y.punten - x.punten).slice(0, 2).map((x) => x.label).join('; ')
    const [t] = await tx.insert(schema.tasks).values({
      organisationId: org, ownerId: g.id, accountId, contactId: kand.contactId, signalId: kand.inzichtId, actionType: ACTIE_VAN_SOORT[kand.soort], priority: kand.score >= 60 ? 'hoog' : 'middel',
      dueDate: due.toISOString(), title: kand.titel, onderwerp: `${accountId}:volgen-${kand.sleutel}`,
      data: { waarom: `Volgende beste stap (${kand.score} punten): ${waarom}.`, herkomst: { bron: 'volgen', inzichtId: kand.inzichtId, actiesoort: ACTIE_VAN_SOORT[kand.soort], uitvoerder: g.id } },
      createdAt: nu.toISOString(), updatedAt: nu.toISOString(),
    }).returning({ id: schema.tasks.id })
    taskId = t!.id
    if (!plan) tekst = 'Taak gemaakt. Rond hem af zodra het gedaan is.'
  }
  await log(b.keuze === 'alternatief' ? 'alternatief' : plan ? 'plan' : 'nu', { taskId })
  return { tekst, taskId }
}
